import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()], test: {
  // Bound CPU/memory contention with local Vite and CouchDB on Windows.
  maxWorkers: 2,
  environment: 'jsdom',
  setupFiles: ['./tests/setup.js'],
  include: ['tests/**/*.test.jsx', 'tests/auth/auth-navigation.test.js'],
} });
