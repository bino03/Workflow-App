import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 7401,
    // A 7401 é a origem aceite pelo CORS/WebSocket do backend: saltar de porta parece um erro de auth.
    strictPort: true,
    proxy: {
      // 127.0.0.1 e não localhost: no Node 24 "localhost" pode resolver para ::1, onde o backend não escuta.
      '/api': { target: 'http://127.0.0.1:7400', ws: true },
    },
  },
});
