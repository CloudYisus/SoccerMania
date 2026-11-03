import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);
const flagIconsRoot = dirname(require.resolve('flag-icons/package.json'));
const SERVER = `http://localhost:${process.env.SERVER_PORT || 8787}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@flag-icons': flagIconsRoot },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': SERVER,
      '/assets/flag': SERVER,
      '/assets/crest': SERVER,
      '/assets/portrait': SERVER,
      '/assets/competition': SERVER,
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
