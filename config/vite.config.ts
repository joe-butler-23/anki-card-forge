import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  return {
    root: './src',
    base: './',
    plugins: [react()],
    css: {
      postcss: './config/postcss.config.js',
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    }
  };
});
