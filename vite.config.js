import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = 'http://localhost:3000';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': target, '/games': target, '/sdk': target } },
  build: { outDir: 'dist', emptyOutDir: true },
});
