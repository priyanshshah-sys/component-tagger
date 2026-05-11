# CONTEXT.md

> Auto-generated repo context for AI agents. Update when the repo changes.

## Repo

- **Name:** react/component-tagger
- **Purpose:** Build-time JSX component annotation tool — injects `data-component-*` attributes into JSX elements for Rocket's live visual editor. Also provides a CLI for HTML-only projects that injects a runtime browser script.
- **Tech:** TypeScript / tsup (ESM + CJS) / Vitest — published to NPM as `@dhiwise/component-tagger`
- **Port:** N/A — pure NPM package, no HTTP server

## Branches

- **Production:** master (reflects latest NPM release — NOTE: only `main` branch exists in this repo; `master` is 404)
- **Staging:** none
- **Dev:** none
- **Create branches from:** main
- **Naming:** `feat/<description>`, `fix/<description>`, `chore/<description>`
- **MR target:** main

## Architecture

TypeScript NPM package built with `tsup` producing three independent bundles: (1) `dist/index.*` — the Vite/Webpack/CRACO plugin (main entry `.`), (2) `dist/nextLoader.*` — a dedicated webpack loader for Next.js (entry `./nextLoader`), (3) `dist/cli.js` — a Node.js CLI binary (`@dhiwise/component-tagger-html`). The core transform pipeline lives in `src/core/` — Babel parses JSX/TSX source into an AST, `traverse` walks every `JSXOpeningElement`, and `magic-string` injects `data-component-id/path/line/end-line/file/name/content` attributes without reprinting the whole file. The HTML CLI path is entirely separate — it generates a runtime browser script (`dhws-data-injector.js`) that uses a `MutationObserver` to tag DOM elements at runtime, then injects a `<script>` tag into all found HTML files. Every merge to `main` triggers CI which publishes to NPM automatically.

## Key Directories

| Path         | Purpose                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| src/core/    | Transform engine — `unplugin.ts` (unified plugin factory), `transform.ts` (Babel AST + magic-string), `cache.ts` (file-entry-cache for incremental builds) |
| src/plugins/ | Framework adapters — `vitePlugin.ts`, `webpackPlugin.ts`, `cracoPlugin.ts`                                                                                 |
| src/loaders/ | `webpackLoader.ts` — Next.js webpack loader (separate from the plugin)                                                                                     |
| src/cli/     | CLI entry `cli.ts` + `htmlTagger.ts` — runtime browser script generation + HTML injection                                                                  |
| src/types/   | `ComponentTagOptions` interface — single source of truth for all config options                                                                            |

## Key Files

| File                  | Purpose                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| src/core/transform.ts | Core AST transform — Babel parse → traverse JSXOpeningElement → magic-string inject attributes       |
| src/core/unplugin.ts  | `createUnplugin` factory — unified Vite/Webpack/Rollup/esbuild plugin using `unplugin`               |
| src/cli/htmlTagger.ts | HTML-mode: generates `dhws-data-injector.js` browser script + injects `<script>` tag into HTML files |
| tsup.config.ts        | Three separate tsup build configs — index (Vite), nextLoader (webpack), cli (CJS + shebang)          |
| .gitlab-ci.yml        | CI: install → build → `npm publish --access public --tag latest` on every `main` push                |

## Core Modules

| Module                       | Responsibility                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `componentTaggerUnplugin`    | `unplugin`-based plugin: `transformInclude` (file filter) + `transform` (call `transformCode`)    |
| `transformCode`              | Parse JSX/TSX with Babel, walk `JSXOpeningElement` nodes, inject data attributes via magic-string |
| `createVitePlugin`           | Wraps unplugin.vite() with `enforce: 'pre'` to run before other Vite plugins                      |
| `createWebpackPlugin`        | Wraps unplugin.webpack() for CRA/webpack projects                                                 |
| `createCracoPlugin`          | Injects webpack plugin via CRACO's `overrideWebpackConfig` hook                                   |
| `webpackLoader` (nextLoader) | Standalone webpack loader for Next.js — calls `transformCode` directly without `unplugin`         |
| `injectHtmlComponentTagger`  | CLI HTML mode — generates browser runtime script + scans + injects `<script>` into HTML files     |

## Dependencies

| Direction | Repo                      | Why                                                                                                    |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Called By | react/llm-boilerplate     | All boilerplate `vite.config.ts` files import `tagger()` from this package                             |
| Called By | nextjs_deployment_service | `removeCode.ts` strips the `@dhiwise/component-tagger/nextLoader` webpack loader before Netlify deploy |
| Called By | automode                  | Generated Next.js/React project configs include this plugin                                            |
| Called By | html-tailwind boilerplate | CLI (`@dhiwise/component-tagger-html`) used in `build:css` / `watch:css` scripts                       |

## External Services

NPM registry (publish on CI), `@babel/core` + `@babel/parser` (AST), `magic-string` (non-destructive source edits), `unplugin` (cross-bundler plugin API), `fast-glob` (HTML file discovery), `file-entry-cache` (incremental build cache)

## Exposes

NPM package `@dhiwise/component-tagger` v1.0.15:

- `.` → Vite/Webpack/CRACO plugin (default export: `createVitePlugin`)
- `./nextLoader` → webpack loader for Next.js (`src/loaders/webpackLoader.ts`)
- Binary `@dhiwise/component-tagger-html` → CLI for HTML-only projects

## Conventions

- TypeScript throughout; `tsup` for dual ESM + CJS output
- `magic-string` for all source mutations — never reprint the full AST (preserves formatting + supports source maps)
- Errors in `transformCode` are swallowed and return `null` — build never fails due to tagging errors
- Vitest for unit tests in `tests/`; `vitest related --run` on staged files via lint-staged + husky

## Gotchas

- **`master` branch is 404** — only `main` exists. CI runs on `main`. The repo metadata says "Production: master" but that refers to the NPM `latest` tag, not a git branch.
- **Every `main` push triggers an NPM publish** — version in `package.json` MUST be bumped before merging or CI will attempt to publish a duplicate version and fail silently.
- **Two separate Next.js integration paths** — `./nextLoader` (webpack loader, referenced in `next.config.mjs` via `addLoader`) is completely different from the webpack plugin. The `nextjs_deployment_service` removes the loader entry specifically; it looks for `@dhiwise/component-tagger/nextLoader` in the webpack config.
- **HTML CLI is runtime, JSX plugins are build-time** — `htmlTagger.ts` generates a MutationObserver browser script; it does NOT parse HTML or inject attributes into markup at build time.
- **`includeLegacyAttributes: true` by default** — adds 5 extra attributes (`path`, `line`, `end-line`, `file`, `name`) on top of `id` and `content`. Disabling reduces DOM noise significantly.
- **Three.js elements are excluded** — `getThreeJSImports` in `transform.ts` detects Three.js imports and skips tagging those JSX elements to avoid polluting 3D scene graphs.

## Recent Context

- CONTEXT.md created April 2026
- **v1.0.16 — Next.js RSC hydration fix:** `src/loaders/webpackLoader.ts` now strips Next.js-injected RSC boundary comment lines from the top of Client Component files before Babel parses them. The removed line count (`lineOffset`) is passed to `transformCode` so all emitted `data-component-id`, `data-component-line`, and `data-component-end-line` values reference the original source positions. Both the server and client webpack passes now produce identical attribute values, eliminating the hydration mismatch (e.g. `Sidebar.tsx:61:6` vs `Sidebar.tsx:63:6`).
