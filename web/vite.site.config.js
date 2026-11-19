// The page for the landing site: desk.html only, with paths relative to it, written into site/dist/desk (the site frames it).
import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: '../site/dist/desk', emptyOutDir: true, assetsInlineLimit: 0, rollupOptions: { input: { desk: 'desk.html' } } },
});
