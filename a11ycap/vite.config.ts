import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'A11yCap',
      fileName: (format) => {
        if (format === 'es') return 'index.js';
        if (format === 'iife') return 'browser.js';
        return `index.${format}.js`;
      },
      formats: ['es', 'iife'],
    },
    outDir: 'dist',
    rollupOptions: {
      external: ['react-devtools-inline'],
      output: {
        globals: {
          'react-devtools-inline': 'ReactDevToolsInline',
        },
      },
    },
  },
  resolve: {
    alias: {
      '@isomorphic': path.resolve(__dirname, 'src/isomorphic'),
      '@injected': path.resolve(__dirname, 'src/injected'),
      '@protocol': path.resolve(__dirname, 'src/protocol'),
    },
  },
});
