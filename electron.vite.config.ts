import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import preact from '@preact/preset-vite';

// Jedes Overlay bekommt einen eigenen Eintrag hier, sobald es dazukommt.
const rendererEntries = {
  relative: resolve(__dirname, 'src/renderer/relative/index.html'),
  fuel: resolve(__dirname, 'src/renderer/fuel/index.html'),
  standings: resolve(__dirname, 'src/renderer/standings/index.html'),
  inputs: resolve(__dirname, 'src/renderer/inputs/index.html'),
  radar: resolve(__dirname, 'src/renderer/radar/index.html'),
  delta: resolve(__dirname, 'src/renderer/delta/index.html'),
  laptimes: resolve(__dirname, 'src/renderer/laptimes/index.html'),
  tires: resolve(__dirname, 'src/renderer/tires/index.html'),
  sectors: resolve(__dirname, 'src/renderer/sectors/index.html'),
  timer: resolve(__dirname, 'src/renderer/timer/index.html'),
  weather: resolve(__dirname, 'src/renderer/weather/index.html'),
  flags: resolve(__dirname, 'src/renderer/flags/index.html'),
  trackmap: resolve(__dirname, 'src/renderer/trackmap/index.html'),
  launcher: resolve(__dirname, 'src/renderer/launcher/index.html'),
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
    // Nur fuer die neuen, komplexeren UI-Teile (Settings-Renderer,
    // Layout-Editor, Spalten-Drag&Drop) - die bisherigen schlanken
    // Overlay-Widgets bleiben bewusst Vanilla-DOM (siehe README).
    plugins: [preact()],
    build: {
      rollupOptions: {
        input: rendererEntries,
      },
    },
  },
});
