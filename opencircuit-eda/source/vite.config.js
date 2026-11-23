import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: { input: { workbench: 'index.html', classic: 'classic.html' } },
    sourcemap: false,
  },
});
