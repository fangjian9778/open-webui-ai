import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2020'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer')
    }
  }
});
