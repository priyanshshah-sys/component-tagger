import { transformCode } from '../core/transform';
import { ComponentTagOptions } from '../types';

// Define webpack loader this context interface
interface LoaderContext {
  resourcePath: string;
  _module?: {
    resource?: string;
  };
  query?: ComponentTagOptions;
}

/**
 * Strips Next.js-injected internal RSC boundary comment lines from the top
 * of a source file and returns both the cleaned source and the number of
 * lines that were removed (the line offset).
 *
 * Problem being solved:
 *   Next.js prepends internal marker comments to Client Component files
 *   during the CLIENT webpack compilation pass, e.g.:
 *     // (module __next_internal_client_entry_do_not_use__ ...)
 *   These lines are NOT present in the SERVER webpack compilation pass.
 *   Because the tagger reads JSX line numbers from Babel's AST (which are
 *   relative to the source it receives), the same JSX element gets different
 *   line numbers on server vs client — causing data-component-id /
 *   data-component-line to differ between the two compiled bundles.
 *   React hydration then detects the attribute mismatch and throws.
 *
 * Fix:
 *   Strip the injected lines before Babel parses the source so both passes
 *   see the same line numbers. Pass the removed line count as `lineOffset`
 *   to transformCode so all emitted line attributes reference the original
 *   source positions.
 *
 * @param source - Raw source received by the webpack loader
 * @returns normalizedSource (header stripped) and lineOffset (lines removed)
 */
function stripNextJsInjectedHeader(source: string): {
  normalizedSource: string;
  lineOffset: number;
} {
  const lines = source.split('\n');
  let injectedLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      // Next.js App Router RSC boundary marker (most common pattern)
      trimmed.startsWith('// (module __next_internal') ||
      // Alternative internal marker format
      trimmed.startsWith('// __next_internal') ||
      // Blank lines that follow an injected marker
      (injectedLines > 0 && trimmed === '')
    ) {
      injectedLines++;
    } else {
      // First non-injected line — stop scanning
      break;
    }
  }

  if (injectedLines === 0) {
    return { normalizedSource: source, lineOffset: 0 };
  }

  return {
    normalizedSource: lines.slice(injectedLines).join('\n'),
    lineOffset: injectedLines,
  };
}

/**
 * Custom JSX Loader that adds tracking attributes to JSX elements.
 *
 * Strips Next.js-injected RSC header lines before transformation so that
 * data-component-id and data-component-line values are identical between
 * the server and client webpack compilation passes, preventing React
 * hydration errors caused by mismatched attribute values.
 *
 * @param this - The webpack loader context
 * @param source - The source code to transform
 * @returns The transformed source code
 */
async function webPackLoader(
  this: LoaderContext,
  source: string,
): Promise<string> {
  // Get the current file path
  const filePath = this.resourcePath;

  // Get options from loader query or use defaults
  const options: ComponentTagOptions = {
    extensions: ['.jsx', '.tsx', '.js', '.ts'],
    verbose: false,
    attributePrefix: 'data-component',
    includeContentAttribute: true,
    maxContentLength: 1000,
    includeLegacyAttributes: true,
    sourceMaps: true,
    excludeDirectories: [],
    processNodeModules: false,
    ...this.query,
  };

  // Strip Next.js-injected RSC boundary lines so Babel sees the same
  // source on both the server and client webpack compilation passes.
  // The lineOffset corrects all emitted line-number attributes so they
  // still reference the original (unmodified) source positions.
  const { normalizedSource, lineOffset } = stripNextJsInjectedHeader(source);

  try {
    const result = await transformCode(normalizedSource, filePath, options, lineOffset);

    if (result) {
      return result.code;
    }

    return source;
  } catch {
    // Return original source on error to prevent build failures
    return source;
  }
}

export default webPackLoader;
