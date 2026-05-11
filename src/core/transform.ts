import * as path from 'path';
import { parse, ParserOptions } from '@babel/parser';
import { traverse } from '@babel/core';
import MagicString from 'magic-string';
import { JSXElement } from '@babel/types';
import { ComponentTagOptions } from '../types';
import {
  shouldProcessFile,
  shouldTagElement,
  extractAttributes,
  getElementName,
  sanitizeAttributeValue,
  createComponentId,
  verboseLog,
  getThreeJSImports,
} from '../utils';
import { SourceMap } from 'magic-string';

/**
 * Transforms code by adding component tags to JSX elements.
 *
 * @param code        The source code to transform (may have been pre-processed
 *                    by the caller to strip injected header lines).
 * @param id          The absolute file path/ID.
 * @param options     Plugin options.
 * @param lineOffset  Number of lines that were stripped from the top of the
 *                    original source before this function was called.
 *                    All emitted line-number attributes are shifted by this
 *                    value so they reference the original source positions.
 *                    Defaults to 0 (no adjustment — Vite / non-Next.js paths).
 * @returns Transformed code with source map, or null if no changes.
 */
export async function transformCode(
  code: string,
  id: string,
  options: ComponentTagOptions,
  lineOffset: number = 0,
): Promise<{ code: string; map: SourceMap | null } | null> {
  // File filtering
  if (!shouldProcessFile(id, options)) {
    return null;
  }

  if (id.includes('node_modules') && !options.processNodeModules) {
    return null;
  }

  if (
    options.excludeDirectories &&
    options.excludeDirectories.some((dir) => id.includes(dir))
  ) {
    return null;
  }

  const cwd = process.cwd();
  const relativePath = path.relative(cwd, id);
  const fileName = path.basename(id);

  verboseLog(`Processing file: ${relativePath}`, options);

  try {
    const parserOptions: ParserOptions = {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    };

    const ast = parse(code, parserOptions);

    // Collect Three.js imports for this file
    const threeJSImports = getThreeJSImports(ast);

    const magicString = new MagicString(code);
    let changedElementsCount = 0;
    let currentElement: JSXElement | null = null;

    traverse(ast, {
      JSXElement: (nodePath) => {
        currentElement = nodePath.node;
      },
      JSXOpeningElement: (nodePath) => {
        if (!currentElement) return;

        const jsxNode = nodePath.node;

        const elementName = getElementName(jsxNode);

        if (!shouldTagElement(elementName, options, threeJSImports)) {
          return;
        }

        const jsxAttributes = extractAttributes(
          jsxNode,
          options,
          currentElement,
        );
        const content: Record<PropertyKey, unknown> = { elementName };

        Object.entries(jsxAttributes).forEach(([key, value]) => {
          content[key] = value;
        });

        // Apply lineOffset so that line numbers reference the ORIGINAL source
        // positions, not the positions in the stripped/normalised source that
        // was passed to this function. This ensures data-component-id and
        // data-component-line are identical between the Next.js server and
        // client webpack compilation passes, preventing hydration errors.
        const rawLine    = jsxNode.loc?.start?.line    ?? 0;
        const rawEndLine = currentElement?.loc?.end?.line ?? rawLine;

        const line    = rawLine    + lineOffset;
        const col     = jsxNode.loc?.start?.column ?? 0;
        const endLine = rawEndLine + lineOffset;

        const dataComponentId = options.generateComponentId
          ? options.generateComponentId(relativePath, line, col)
          : createComponentId(relativePath, line, col);

        let attributesToAdd = ` ${options.attributePrefix}-id="${sanitizeAttributeValue(dataComponentId)}"`;

        if (options.includeLegacyAttributes) {
          attributesToAdd += ` ${options.attributePrefix}-path="${sanitizeAttributeValue(relativePath)}"`;
          attributesToAdd += ` ${options.attributePrefix}-line="${line}"`;
          attributesToAdd += ` ${options.attributePrefix}-end-line="${endLine}"`;
          attributesToAdd += ` ${options.attributePrefix}-file="${sanitizeAttributeValue(fileName)}"`;
          attributesToAdd += ` ${options.attributePrefix}-name="${sanitizeAttributeValue(elementName)}"`;
        }

        if (options.includeContentAttribute) {
          const contentJson = JSON.stringify(content);
          let encodedContent = encodeURIComponent(contentJson);

          if (
            options.maxContentLength &&
            encodedContent.length > options.maxContentLength
          ) {
            encodedContent =
              encodedContent.substring(0, options.maxContentLength) + '...';
          }

          attributesToAdd += ` ${options.attributePrefix}-content="${encodedContent}"`;
        }

        magicString.appendLeft(jsxNode.name.end ?? 0, attributesToAdd);
        verboseLog(attributesToAdd.toString(), options);
        changedElementsCount++;
      },
    });

    if (changedElementsCount > 0) {
      verboseLog(
        `Tagged ${changedElementsCount} components in ${relativePath}`,
        options,
      );

      return {
        code: magicString.toString(),
        map: options.sourceMaps
          ? magicString.generateMap({ hires: true })
          : null,
      };
    }

    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error processing file ${relativePath}:`, error);
    return null;
  }
}
