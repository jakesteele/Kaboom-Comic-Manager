import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['server/src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@opds/shared': './shared/src/index.ts',
    },
  },
});
