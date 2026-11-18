import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    fileParallelism: false,
  },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
