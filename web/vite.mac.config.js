// The page for the Mac app: desk.html only, with paths relative to it, written into the app's folder.
import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: '../mac/build/web', emptyOutDir: true, assetsInlineLimit: 0, rollupOptions: { input: { desk: 'desk.html' } } },
});
