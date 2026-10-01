import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Match the native React peers used by the test renderer, including npm hoisting.
const testRendererRequire = createRequire(
  createRequire(import.meta.url).resolve('@testing-library/react'),
);

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      ...['react-dom/client', 'react-dom/server', 'react-dom/test-utils', 'react-dom',
        'react/jsx-runtime', 'react/jsx-dev-runtime', 'react'].map((dependency) => ({
        find: dependency,
        replacement: testRendererRequire.resolve(dependency),
      })),
    ],
  },
  test: {
    css: false,
    environment: 'node',
    include: ['test/**/*.spec.tsx'],
    setupFiles: ['test/admin-auth-test-session.ts'],
  },
});
