import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry point (vitePlugin.ts) - ESM and CJS
  {
    entry: {
      index: 'src/plugins/vitePlugin.ts',
    },
    format: ['esm', 'cjs'],
    dts: {
      entry: { index: 'src/plugins/vitePlugin.ts' },
    },
    splitting: false,
    sourcemap: false,
    minify: true,
    clean: false,
    external: [
      '@babel/parser',
      '@babel/core',
      'fast-glob',
      'file-entry-cache',
      'magic-string',
      'path',
      'picomatch',
      'unplugin',
      'vite',
      'webpack',
    ],
    outDir: 'dist',
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.js' : '.mjs',
      };
    },
  },
  // Next.js loader (webpackLoader.ts) - ESM and CJS
  {
    entry: {
      nextLoader: 'src/loaders/webpackLoader.ts',
    },
    format: ['esm', 'cjs'],
    dts: {
      entry: { nextLoader: 'src/loaders/webpackLoader.ts' },
    },
    splitting: false,
    sourcemap: false,
    minify: true,
    clean: false,
    external: [
      '@babel/parser',
      '@babel/core',
      'fast-glob',
      'file-entry-cache',
      'magic-string',
      'path',
      'picomatch',
      'unplugin',
      'webpack',
      'loader-utils',
    ],
    outDir: 'dist',
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.js' : '.mjs',
      };
    },
  },
  // CLI entry point (cli/cli.ts) - CJS only with shebang
  {
    entry: {
      cli: 'src/cli/cli.ts',
    },
    format: ['cjs'],
    dts: false,
    splitting: false,
    sourcemap: false,
    minify: true,
    clean: false,
    external: [
      '@babel/parser',
      '@babel/core',
      'fast-glob',
      'file-entry-cache',
      'magic-string',
      'path',
      'picomatch',
      'unplugin',
      'vite',
      'webpack',
      'fs',
    ],
    outDir: 'dist',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
