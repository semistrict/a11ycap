import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: path.resolve(__dirname, 'background.ts'),
        'content-script': path.resolve(__dirname, 'content-script.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
      },
    },
    lib: false,
    minify: false,
  },
  resolve: {
    alias: {
      '@isomorphic': path.resolve(__dirname, '../isomorphic'),
    },
  },
});
