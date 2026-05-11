import { ComponentTagOptions } from '../types';
import { componentTaggerUnplugin } from '../core/unplugin';

export function createWebpackPlugin(options: ComponentTagOptions = {}) {
  return componentTaggerUnplugin.webpack(options);
}
