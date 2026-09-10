# Changelog

## 0.10.0 - 2026-09-10

- Migrate the repository scripts from `.mjs` to TypeScript and run them with Node's native type stripping.
- Raise `engines.node` to `>=22.18.0`, the first release that runs TypeScript sources without a flag.
- Move the build to Vite 8 and `vite-plugin-turbowarp-extension` 0.3.0; the tracked extension bundle is regenerated.
- Keep the SVG Text runtime API, Extension ID, opcodes, and Composition API unchanged.
- Roll back by pinning `@kubohiroya/turbowarp-svg-text@0.9.0`.

## 0.9.0 - 2026-08-25

- Replace the root LICENSE with the full Mozilla Public License 2.0 text.
- Align README, Pages, package metadata, and downstream integration links with the current TurboWarp-SVG-Text and TM Kamishibai names.
- Add repository policy checks for license, versioned install/CDN examples, bundle metadata, package archive contents, and Composition API artifacts.
- Keep plain/ruby layout, skin generation, Standalone capability handoff, extension ID, opcodes, and public Composition API unchanged.
- Roll back by pinning `@kubohiroya/turbowarp-svg-text@0.8.1`.
