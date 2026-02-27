/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['apps/identity-ui/src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['apps/identity-ui/src/app/**/*.ts'],
      exclude: ['**/*.spec.ts', 'src/main.ts', 'src/test-setup.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
