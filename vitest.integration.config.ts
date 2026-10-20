import { defineConfig } from 'vitest/config';

// Integration tests run the built CLI (dist/) - `pnpm test:integration` builds first.
export default defineConfig({
  test: {
    include: ['**/__tests__/**/*.integration.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    setupFiles: ['console-fail-test/setup'],
    // Each test spawns the CLI, which downloads and extracts a tarball.
    testTimeout: 30_000,
  },
});
