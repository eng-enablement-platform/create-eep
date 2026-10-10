import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  // Lowest Node version in package.json `engines`.
  target: 'node22.13',
  outDir: 'dist',
  clean: true,
  // A CLI, not a library - nobody imports our types.
  dts: false,
  /*
   * tsdown keeps `dependencies` external but bundles anything imported from
   * `devDependencies`. Runtime packages (giget, commander, ...) therefore go in
   * `devDependencies` so they are compiled into dist/ and the
   * published package has zero dependencies - `npx create-eep` installs one
   * small package and starts fast.
   */
});
