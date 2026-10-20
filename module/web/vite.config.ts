import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// mode "pages" — автономная сборка для GitHub Pages: API работает в браузере, файлы кладутся в /docs репозитория
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'pages' ? './' : '/',
  define: mode === 'pages' ? { 'import.meta.env.VITE_LOCAL': JSON.stringify('1') } : {},
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
  build: { outDir: mode === 'pages' ? '../../docs' : 'dist', emptyOutDir: true },
}));
