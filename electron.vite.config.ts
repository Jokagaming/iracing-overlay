import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

// Jedes Overlay bekommt einen eigenen Eintrag hier, sobald es dazukommt.
const rendererEntries = {
  relative: resolve(__dirname, 'src/renderer/relative/index.html'),
  fuel: resolve(__dirname, 'src/renderer/fuel/index.html'),
  standings: resolve(__dirname, 'src/renderer/standings/index.html'),
  inputs: resolve(__dirname, 'src/renderer/inputs/index.html'),
  radar: resolve(__dirname, 'src/renderer/radar/index.html'),
  delta: resolve(__dirname, 'src/renderer/delta/index.html'),
  timer: resolve(__dirname, 'src/renderer/timer/index.html'),
  weather: resolve(__dirname, 'src/renderer/weather/index.html'),
  flags: resolve(__dirname, 'src/renderer/flags/index.html'),
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
