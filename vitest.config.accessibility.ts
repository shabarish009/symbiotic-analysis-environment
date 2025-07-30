/**
 * Vitest Configuration for Accessibility Testing
 * Specialized configuration for running accessibility tests
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment configuration
    environment: 'jsdom',
    
    // Setup files for accessibility testing
    setupFiles: [
      './src/test/setup-accessibility.ts',
    ],
    
    // Global test configuration
    globals: true,
    
    // Test file patterns for accessibility tests
    include: [
      'src/**/*.accessibility.test.{ts,tsx}',
      'src/**/*.a11y.test.{ts,tsx}',
    ],
    
    // Exclude non-accessibility tests
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'src/**/*.test.{ts,tsx}', // Exclude regular unit tests
      'src/**/*.spec.{ts,tsx}',
    ],
    
    // Test timeout for accessibility tests (longer due to axe-core)
    testTimeout: 10000,
    
    // Coverage configuration for accessibility testing
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/accessibility',
      include: [
        'src/components/**/*.{ts,tsx}',
        'src/utils/accessibility.ts',
        'src/hooks/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/test/**',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    
    // Reporter configuration
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results/accessibility-results.json',
    },
    
    // Retry configuration for flaky accessibility tests
    retry: 2,
    
    // Parallel execution (disabled for accessibility tests to avoid conflicts)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run accessibility tests in single process
      },
    },
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@utils': '/src/utils',
      '@test': '/src/test',
    },
  },
  
  // Define configuration for accessibility testing
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.ACCESSIBILITY_TESTING': '"true"',
  },
});
