import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './packages/domain',
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
});
