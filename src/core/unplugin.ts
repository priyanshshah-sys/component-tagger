import { createUnplugin } from 'unplugin';
import { ComponentTagOptions, ComponentTagStats } from '../types';
import { transformCode } from './transform';
import { shouldProcessFile, verboseLog, generateSummary } from '../utils';

/**
 * Creates a unified plugin that works across Vite, Webpack, Rollup, and esbuild
 */
export const componentTaggerUnplugin = createUnplugin(
  (options: ComponentTagOptions = {}) => {
    const pluginOptions: ComponentTagOptions = {
      extensions: ['.jsx', '.tsx', '.js', '.ts'],
      verbose: false,
      attributePrefix: 'data-component',
      includeContentAttribute: true,
      maxContentLength: 1000,
      includeLegacyAttributes: true,
      sourceMaps: true,
      excludeDirectories: [],
      processNodeModules: false,
      ...options,
    };

    const stats: ComponentTagStats = {
      totalFiles: 0,
      processedFiles: 0,
      totalElements: 0,
    };

    return {
      name: 'component-tagger',

      // Vite, Rollup, esbuild: transformInclude hook
      transformInclude(id) {
        return shouldProcessFile(id, pluginOptions);
      },

      // Vite, Rollup, esbuild: transform hook
      async transform(code, id) {
        // Additional filtering
        if (id.includes('node_modules') && !pluginOptions.processNodeModules) {
          return null;
        }

        if (
          pluginOptions.excludeDirectories &&
          pluginOptions.excludeDirectories.some((dir) => id.includes(dir))
        ) {
          return null;
        }

        stats.totalFiles++;

        const result = await transformCode(code, id, pluginOptions);

        if (result) {
          stats.processedFiles++;
          // Count elements by checking how many times attributePrefix appears
          const elementCount = (
            result.code.match(
              new RegExp(`${pluginOptions.attributePrefix}-id="`, 'g'),
            ) || []
          ).length;
          stats.totalElements += elementCount;
        } else {
          stats.processedFiles++;
        }

        return result;
      },

      // Build start hook
      buildStart() {
        verboseLog('Component tagger plugin started', pluginOptions);
        // Reset stats for new build
        stats.totalFiles = 0;
        stats.processedFiles = 0;
        stats.totalElements = 0;
      },

      // Build end hook
      buildEnd() {
        verboseLog(generateSummary(stats), pluginOptions);
      },
    };
  },
);
