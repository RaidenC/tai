/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['apps/borrower-portal/src/**/*.spec.ts'],
    setupFiles: ['apps/borrower-portal/vitest.setup.ts'],
  }
});
