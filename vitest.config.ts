import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests live in a `__tests__/` folder next to the code they cover.
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    clearMocks: true,
    /*
     * Fails any test that writes to the console unexpectedly - console output
     * is the CLI's interface, so stray logs are bugs, not noise.
     */
    setupFiles: ['console-fail-test/setup'],
    coverage: {
      include: ['src/**', 'eslint-rules/**'],
      exclude: ['**/__tests__/**'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
