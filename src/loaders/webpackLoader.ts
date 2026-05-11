import * as fs from 'fs';
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
 * Finds the number of lines that Next.js has prepended to the source
 * before the actual file content begins.
 *
 * WHY THIS IS NEEDED:
 * Next.js modifies Client Component files during the CLIENT webpack
 * compilation pass by prepending RSC boundary/module wrapper code.
 * This shifts all JSX line numbers, causing data-component-id /
 * data-component-line to differ between server and client bundles:
 *
 *   Server pass receives:  original Sidebar.tsx — line 59 = the div
 *   Client pass receives:  [16 injected lines] + Sidebar.tsx — line 59
 *                          is now in injected code, div is at line 75
 *
 *   React hydration: "59:4" (server) ≠ "75:4" (client) → CRASH
 *
 * WHY NOT PATTERN MATCHING:
 * The injected content format varies across Next.js versions and is
 * not a simple comment — it can be multiple lines of actual JS code.
 * Pattern matching is fragile and produced lineOffset=0 in practice.
 *
 * CORRECT APPROACH:
 * Read the original file from disk. Find where its first line appears
 * in the transformed source. That index IS the exact offset — no
 * pattern matching needed, works with any injected format.
 *
 * @param transformedSource - Source received by the webpack loader
 * @param filePath - Absolute path to the original file on disk
 * @returns Number of lines prepended by Next.js (0 if none detected)
 */
function findLineOffset(transformedSource: string, filePath: string): number {
  try {
    const originalSource = fs.readFileSync(filePath, 'utf-8');
    const origLines = originalSource.split('\n');

    // Find the first non-empty line of the original file to use as anchor
    let anchorLine = '';
    let anchorOrigIndex = 0;
    for (let i = 0; i < origLines.length; i++) {
      if (origLines[i].trim()) {
        anchorLine = origLines[i];
        anchorOrigIndex = i;
        break;
      }
    }

    if (!anchorLine) return 0;

    const transformedLines = transformedSource.split('\n');

    // Find where the anchor line first appears in the transformed source
    for (let i = 0; i < transformedLines.length; i++) {
      if (transformedLines[i] === anchorLine) {
        // Offset = position in transformed source minus position in original
        return i - anchorOrigIndex;
      }
    }

    return 0;
  } catch {
    // File read failed (e.g. virtual module) — no offset applied
    return 0;
  }
}

/**
 * Custom JSX Loader that adds tracking attributes to JSX elements.
 *
 * Detects and corrects Next.js RSC header line injection so that
 * data-component-id and data-component-line values are identical between
 * the server and client webpack compilation passes, preventing React
 * hydration errors caused by mismatched attribute values.
 *
 * @param this - The webpack loader context
 * @param source - The source code to transform (may have Next.js-injected lines prepended)
 * @returns The transformed source code with correct line-number attributes
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

  // Detect how many lines Next.js prepended to this file during the client
  // webpack compilation pass. These prepended lines shift JSX line numbers,
  // causing data-component-id to differ between server and client → hydration error.
  // We correct this by reading the original file from disk and finding where
  // its content starts in the transformed source.
  const lineOffset = findLineOffset(source, filePath);

  try {
    const result = await transformCode(source, filePath, options, lineOffset);

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
