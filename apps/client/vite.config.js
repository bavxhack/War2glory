import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: new URL('.', import.meta.url).pathname, plugins: [react()], build: { outDir: 'dist', emptyOutDir: true }, server: { port: 5173, strictPort: true, proxy: { '/game': { target: 'ws://127.0.0.1:3000', ws: true } } } });
