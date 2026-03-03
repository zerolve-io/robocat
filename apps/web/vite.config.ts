import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@robocat/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        play: path.resolve(__dirname, 'play.html'),
        howToPlay: path.resolve(__dirname, 'how-to-play.html'),
        tips: path.resolve(__dirname, 'tips.html'),
        updates: path.resolve(__dirname, 'updates.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
});
