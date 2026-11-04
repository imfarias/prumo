import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['packages/motor/src/**/*.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 85, branches: 80 },
    },
  },
});
