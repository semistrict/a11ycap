import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.ts',
        '**/*.d.ts',
        '**/test/**',
        'testpagecra/**',
        'babel-plugin-a11ycap/**',
      ],
      include: ['a11ycap/src/**/*.ts', 'a11ycap-mcp/src/**/*.ts'],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    globals: true,
    environment: 'node',
    testTimeout: 10000,
  },
});