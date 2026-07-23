import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@sopscape/contracts': fileURLToPath(
        new URL('./packages/contracts/src/index.ts', import.meta.url),
      ),
      '@sopscape/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@sopscape/server': fileURLToPath(new URL('./apps/server/src/app.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/e2e/**/*.test.ts'],
    globals: false,
  },
});
