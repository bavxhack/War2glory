import { defineConfig } from 'vite';

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  esbuild: { jsx: 'automatic' },
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/alliance-images': { target: 'http://127.0.0.1:3000' }, '/game': { target: 'ws://127.0.0.1:3000', ws: true } },
  },
});
