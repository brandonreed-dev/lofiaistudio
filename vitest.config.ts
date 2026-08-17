import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'apps/**/*.{test,spec}.{ts,tsx}',
      'apps/**/src/**/*.{test,spec}.{ts,tsx}',
      'packages/**/*.{test,spec}.ts'
    ],
    exclude: ['**/dist/**', '**/node_modules/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'apps/**/test/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'apps/web/src'),
      '@lofiaistudio/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
    },
  },
});
