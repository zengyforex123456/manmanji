// vitest.config.mjs – exclude e2e tests from Vitest runner
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run *.test.* files (unit/integration)
    include: ['tests/**/*.test.[jt]s'],
    // Explicitly skip Playwright end‑to‑end specs
    exclude: ['tests/e2e/**'],
    globals: true,
    environment: 'node',
  },
});
