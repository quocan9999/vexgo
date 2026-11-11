import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    setupFiles: ['./test/setup.ts'],
    include: ['test/unit/**/*.spec.ts', 'test/integration/**/*.spec.ts'],
    fileParallelism: false,
  },
});
