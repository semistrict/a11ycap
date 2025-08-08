import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'SnapshotForAI',
      fileName: 'index',
      formats: ['umd', 'es']
    },
    outDir: 'dist',
    rollupOptions: {
      external: ['react-devtools-inline'],
      output: {
        globals: {
          'react-devtools-inline': 'ReactDevToolsInline'
        },
        entryFileNames: 'index.js'
      }
    }
  },
  resolve: {
    alias: {
      '@isomorphic': path.resolve(__dirname, 'src/isomorphic'),
      '@injected': path.resolve(__dirname, 'src/injected'), 
      '@protocol': path.resolve(__dirname, 'src/protocol')
    }
  }
});