import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      { find: /^react-dom\/client$/, replacement: fileURLToPath(new URL('../../node_modules/react-dom/client.js', import.meta.url)) },
      { find: /^react-dom\/server$/, replacement: fileURLToPath(new URL('../../node_modules/react-dom/server.js', import.meta.url)) },
      { find: /^react-dom\/test-utils$/, replacement: fileURLToPath(new URL('../../node_modules/react-dom/test-utils.js', import.meta.url)) },
      { find: /^react-dom$/, replacement: fileURLToPath(new URL('../../node_modules/react-dom/index.js', import.meta.url)) },
      { find: /^react$/, replacement: fileURLToPath(new URL('../../node_modules/react/index.js', import.meta.url)) },
    ],
  },
  test: {
    css: false,
    environment: 'node',
    include: ['test/**/*.spec.tsx'],
    server: { deps: { inline: ['react', 'react-dom', '@testing-library/react'] } },
  },
});
