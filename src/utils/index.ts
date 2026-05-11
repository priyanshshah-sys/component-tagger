import {
  JSXOpeningElement,
  JSXMemberExpression,
  JSXIdentifier,
  JSXElement,
  JSXExpressionContainer,
  JSXFragment,
  StringLiteral,
  File,
  ImportDeclaration,
} from '@babel/types';
const colors = {
  red: (str: string | number) => `\x1b[31m${str}\x1b[0m`,
  green: (str: string | number) => `\x1b[32m${str}\x1b[0m`,
  yellow: (str: string | number) => `\x1b[33m${str}\x1b[0m`,
  blue: (str: string | number) => `\x1b[34m${str}\x1b[0m`,
  cyan: (str: string | number) => `\x1b[36m${str}\x1b[0m`,
} as const;
import picomatch from 'picomatch';
import {
  REACT_STRUCTURAL_COMPONENTS,
  THREE_FIBER_ELEMENTS,
  THREE_JS_IMPORT_PATTERNS,
} from '../constants';
import { ComponentTagOptions } from '../types';

/**
 * Extracts all identifiers imported from Three.js packages in the given AST
 * @param ast The parsed AST of the code
 * @returns Set of imported Three.js identifiers
 */
export function getThreeJSImports(ast: File): Set<string> {
  const threeJSImports = new Set<string>();

  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const importDeclaration = node as ImportDeclaration;
      const source = importDeclaration.source.value;

      // Check if the import source matches any Three.js pattern
      const isThreeJSImport = THREE_JS_IMPORT_PATTERNS.some(
        (pattern) => source === pattern || source.startsWith(pattern + '/'),
      );

      if (isThreeJSImport) {
        for (const specifier of importDeclaration.specifiers) {
          if (specifier.type === 'ImportSpecifier') {
            // Named import: import { Box, Mesh } from '@react-three/drei'
            threeJSImports.add(specifier.local.name);
          } else if (specifier.type === 'ImportDefaultSpecifier') {
            // Default import: import Canvas from '@react-three/fiber'
            threeJSImports.add(specifier.local.name);
          } else if (specifier.type === 'ImportNamespaceSpecifier') {
            // Namespace import: import * as THREE from 'three'
            // We'll handle this as a special case where we need to check for THREE.* usage
            threeJSImports.add(`${specifier.local.name}.*`);
          }
        }
      }
    }
  }

  return threeJSImports;
}

// Cache for extension matchers to avoid recreating them
const extensionMatcherCache = new Map<string, (filePath: string) => boolean>();

/**
 * Creates or retrieves a cached extension matcher
 */
function getExtensionMatcher(
  extensions: string[],
): (filePath: string) => boolean {
  const key = extensions.sort().join(',');
  if (!extensionMatcherCache.has(key)) {
    const patterns = extensions.map((ext) => `**/*${ext}`);
    const matcher = picomatch(patterns);
    extensionMatcherCache.set(key, matcher);
  }
  return extensionMatcherCache.get(key)!;
}

/**
 * Determines if a file should be processed based on its extension and path
 * @param filePath The path of the file to check
 * @param options Plugin options
 * @returns Boolean indicating if the file should be processed
 */
export function shouldProcessFile(
  filePath: string,
  options: ComponentTagOptions,
): boolean {
  const extensions = options.extensions || ['.jsx', '.tsx', '.js', '.ts'];
  const matcher = getExtensionMatcher(extensions);

  if (!matcher(filePath)) {
    return false;
  }

  const skipPatterns = ['.test.', '.spec.', '__tests__', '__mocks__'];
  const shouldSkip = skipPatterns.some((pattern) => filePath.includes(pattern));

  return !shouldSkip;
}

/**
 * Determines if an element should be tagged based on its name and options
 * @param elementName The name of the JSX element
 * @param options Plugin options
 * @param threeJSImports Set of imported Three.js identifiers
 * @returns Boolean indicating if the element should be tagged
 */
export function shouldTagElement(
  elementName: string,
  options: ComponentTagOptions,
  threeJSImports?: Set<string>,
): boolean {
  if (options.includeElements && options.includeElements.length > 0) {
    return options.includeElements.includes(elementName);
  }

  if (options.shouldTag) {
    return options.shouldTag(elementName);
  }

  if (
    options.excludeElements &&
    options.excludeElements.includes(elementName)
  ) {
    return false;
  }

  if (REACT_STRUCTURAL_COMPONENTS.has(elementName)) {
    return false;
  }

  // Skip Three.js elements that are actually imported from Three.js packages
  if (threeJSImports && isThreeJSElement(elementName, threeJSImports)) {
    return false;
  }

  return true;
}

/**
 * Checks if an element name matches any imported Three.js identifier
 * @param elementName The JSX element name to check
 * @param threeJSImports Set of imported Three.js identifiers
 * @returns Boolean indicating if the element is from Three.js imports
 */
function isThreeJSElement(
  elementName: string,
  threeJSImports: Set<string>,
): boolean {
  // Direct match for named/default imports
  if (threeJSImports.has(elementName)) {
    return true;
  }

  // Skip Three.js Fiber elements
  if (THREE_FIBER_ELEMENTS.includes(elementName)) {
    return true;
  }

  // Check for namespace imports (e.g., THREE.Box where THREE.* is imported)
  for (const importedIdentifier of threeJSImports) {
    if (importedIdentifier.endsWith('.*')) {
      const namespace = importedIdentifier.slice(0, -2); // Remove ".*"
      if (elementName.startsWith(`${namespace}.`)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Safely extracts a string value from a JSX attribute value
 * @param value The attribute value node
 * @returns The extracted string value or undefined
 */
function extractStringValue(
  value:
    | JSXElement
    | JSXExpressionContainer
    | JSXFragment
    | StringLiteral
    | null
    | undefined,
): string | undefined {
  if (!value) return undefined;

  if (value.type === 'StringLiteral') {
    return value.value;
  }

  if (value.type === 'JSXExpressionContainer') {
    const expr = value.expression;

    if (expr.type === 'StringLiteral') {
      return expr.value;
    }

    if (expr.type === 'TemplateLiteral' && expr.quasis.length === 1) {
      return expr.quasis[0].value.raw;
    }

    if (expr.type === 'BinaryExpression' && expr.operator === '+') {
      const left = expr.left.type === 'StringLiteral' ? expr.left.value : '';
      const right = expr.right.type === 'StringLiteral' ? expr.right.value : '';
      return left + right;
    }

    if (expr.type === 'Identifier') {
      return `[var:${expr.name}]`;
    }
  }

  return undefined;
}

/**
 * Extract attributes from JSX opening element
 * @param node The JSX opening element node
 * @param options Plugin options
 * @returns Record of attribute names and values
 */
export function extractAttributes(
  node: JSXOpeningElement,
  options: ComponentTagOptions,
  currentElement: JSXElement | undefined,
): Record<string, string> {
  const attributes: Record<string, string> = {};

  const defaultAttrs = [
    'className',
    'id',
    'src',
    'alt',
    'href',
    'type',
    'name',
    'value',
  ];
  const attrsToExtract = new Set([
    ...defaultAttrs,
    ...(options.extractAttributes || []),
  ]);

  for (const attr of node.attributes) {
    if (attr.type === 'JSXAttribute' && attr.name.type === 'JSXIdentifier') {
      const name = attr.name.name;

      if (!attrsToExtract.has(name)) continue;

      if (attr.value) {
        const stringValue = extractStringValue(attr.value);
        if (stringValue !== undefined) {
          attributes[name] = stringValue;
        }
      } else {
        attributes[name] = 'true';
      }
    } else if (attr.type === 'JSXSpreadAttribute') {
      attributes['[spread]'] = 'true';
    }
  }

  let textContent = '';
  if (currentElement && currentElement.children) {
    textContent = currentElement.children
      .map((child) => {
        if (child.type === 'JSXText') {
          return child.value.trim();
        } else if (child.type === 'JSXExpressionContainer') {
          if (child.expression.type === 'StringLiteral') {
            return child.expression.value;
          }
        }
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (textContent) {
    attributes['textContent'] = textContent;
  }

  return attributes;
}

/**
 * Get element name from JSX opening element
 * @param jsxNode The JSX opening element node
 * @returns The element name as a string
 */
export function getElementName(jsxNode: JSXOpeningElement): string {
  const name = jsxNode.name;

  if (name.type === 'JSXIdentifier') {
    return name.name;
  }

  if (name.type === 'JSXMemberExpression') {
    // Handle nested expressions like Namespace.Component
    return getMemberExpressionName(name);
  }

  // if (name.type === 'JSXNamespacedName') {
  //   return `${name.namespace.name}:${name.name.name}`;
  // }

  return 'Unknown';
}

/**
 * Recursively builds the full name of a JSX member expression
 * @param expr The JSX member expression
 * @returns The full dotted name
 */
function getMemberExpressionName(expr: JSXMemberExpression): string {
  // const propertyName = expr.property.name;

  /*
  else if (jsxNode.name.type === "JSXMemberExpression") {
                            const memberExpr = jsxNode.name;
                            elementName = `${(memberExpr.object as JSXIdentifier).name}.${(memberExpr.property as JSXIdentifier).name}`;
                        } */

  // if (expr.object.type === 'JSXMemberExpression') {
  //   return `${expr.object as JSXIdentifier}`
  //   return `${getMemberExpressionName(expr.object)}.${propertyName}`;
  // }

  // if (expr.object.type === 'JSXIdentifier') {
  //   return `${expr.object.name}.${propertyName}`;
  // }

  const propertyName = `${(expr.object as JSXIdentifier).name}.${(expr.property as JSXIdentifier).name}`;

  return propertyName;
}

/**
 * Sanitizes a string for use in HTML attributes
 * @param str The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeAttributeValue(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Creates a unique component ID based on file path and location
 * @param filePath The relative file path
 * @param line The line number
 * @param column The column number
 * @returns A unique component ID string
 */
export function createComponentId(
  filePath: string,
  line: number,
  column: number,
): string {
  return `${filePath}:${line}:${column}`;
}

/**
 * Logs a message if verbose mode is enabled
 * @param message The message to log
 * @param options Plugin options
 */
export function verboseLog(
  message: string,
  options: ComponentTagOptions,
): void {
  if (!options.verbose) {
    return;
  }

  // Determine message type and color
  let coloredMessage = message;
  if (message.includes('Error') || message.includes('error')) {
    coloredMessage = colors.red(message);
  } else if (message.includes('Tagged') || message.includes('Summary')) {
    coloredMessage = colors.green(message);
  } else if (message.includes('Processing') || message.includes('started')) {
    coloredMessage = colors.blue(message);
  } else {
    coloredMessage = colors.yellow(message);
  }

  // eslint-disable-next-line no-console
  console.log(`[component-tagger] ${coloredMessage}`);
}

/**
 * Checks if a file is a test file
 * @param filePath The file path to check
 * @returns Boolean indicating if it's a test file
 */
export function isTestFile(filePath: string): boolean {
  const testPatterns = ['.test.', '.spec.', '__tests__/', '__mocks__/'];
  return testPatterns.some((pattern) => filePath.includes(pattern));
}

/**
 * Generates a summary of the tagging operation
 * @param stats The statistics object
 * @returns A formatted string with the summary
 */
export function generateSummary(stats: {
  totalFiles: number;
  processedFiles: number;
  totalElements: number;
}): string {
  return colors.green(`Component Tagger Summary:
  - Total files scanned: ${colors.cyan(stats.totalFiles)}
  - Files processed: ${colors.cyan(stats.processedFiles)}
  - Elements tagged: ${colors.cyan(stats.totalElements)}`);
}

/**
 * Detects if the code contains Three.js imports
 * @param ast The parsed AST of the code
 * @returns Boolean indicating if Three.js imports are found
 */
export function hasThreeJSImports(ast: File): boolean {
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const importDeclaration = node as ImportDeclaration;
      const source = importDeclaration.source.value;

      // Check if the import source matches any Three.js pattern
      if (
        THREE_JS_IMPORT_PATTERNS.some(
          (pattern) => source === pattern || source.startsWith(pattern + '/'),
        )
      ) {
        return true;
      }
    }
  }
  return false;
}
