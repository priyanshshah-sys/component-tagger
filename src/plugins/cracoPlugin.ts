import { ComponentTagOptions } from '../types';
import { createWebpackPlugin } from './webpackPlugin';

export function createCracoPlugin(options: ComponentTagOptions = {}) {
  const webpackPlugin = createWebpackPlugin(options);

  return {
    plugin: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      overrideWebpackConfig: ({ webpackConfig }: { webpackConfig: any }) => {
        if (!webpackConfig.plugins) {
          webpackConfig.plugins = [];
        }

        webpackConfig.plugins.push(webpackPlugin);

        return webpackConfig;
      },
    },
  };
}
