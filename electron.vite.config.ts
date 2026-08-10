import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

// Jedes Overlay bekommt einen eigenen Eintrag hier, sobald es dazukommt.
const rendererEntries = {
  relative: resolve(__dirname, 'src/renderer/relative/index.html'),
  fuel: resolve(__dirname, 'src/renderer/fuel/index.html'),
  standings: resolve(__dirname, 'src/renderer/standings/index.html'),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: rendererEntries,
      },
    },
  },
});
