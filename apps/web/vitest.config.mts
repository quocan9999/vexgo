import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: /^react$/,
        replacement: path.resolve(appRoot, '../../node_modules/react/index.js'),
      },
      {
        find: /^react-dom$/,
        replacement: path.resolve(
          appRoot,
          '../../node_modules/react-dom/index.js',
        ),
      },
      {
        find: /^react-dom\/client$/,
        replacement: path.resolve(
          appRoot,
          '../../node_modules/react-dom/client.js',
        ),
      },
      {
        find: '@',
        replacement: path.join(appRoot, 'src'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    testTimeout: 10_000,
  },
});
