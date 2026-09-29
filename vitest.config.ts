import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['skill/cli/**/*.mts', 'scripts/**/*.js'],
      exclude: ['skill/cli/bin/**'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
