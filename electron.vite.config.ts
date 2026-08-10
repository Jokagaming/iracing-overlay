import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

// Jedes Overlay bekommt einen eigenen Eintrag hier, sobald es dazukommt
// (Relative, Standings, Fuel, ...). Fuer den Moment gibt es nur das
// Testfenster aus Meilenstein 0.
const rendererEntries = {
  'test-overlay': resolve(__dirname, 'src/renderer/test-overlay/index.html'),
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
