import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/cup-ledger/' : '/',
  build: {
    rollupOptions: { output: { manualChunks: { charts: ['recharts'], storage: ['dexie', 'dexie-react-hooks'] } } },
  },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    environment: 'node',
  },
}));
