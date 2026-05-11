import { Plugin } from 'vite';
import type { ComponentTagOptions } from '../types';
import { componentTaggerUnplugin } from '../core/unplugin';

/**
 * Creates a Vite plugin that tags JSX components with data attributes
 * @param options Configuration options for the component tagger
 * @returns A Vite plugin
 */
export function createVitePlugin(options: ComponentTagOptions = {}): Plugin {
  const plugin = componentTaggerUnplugin.vite(options);
  // unplugin.vite() can return Plugin | Plugin[], but we only create one plugin
  const vitePlugin = Array.isArray(plugin) ? plugin[0] : plugin;

  // Ensure the plugin runs in the 'pre' phase to transform code before other plugins
  return {
    ...vitePlugin,
    enforce: 'pre' as const,
  };
}

export type { ComponentTagOptions };

export default createVitePlugin;
