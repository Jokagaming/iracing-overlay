import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import { join } from 'node:path';

// Meilenstein 0: nur ein einzelnes Testfenster. Sobald der Datenlayer
// (Meilenstein 1) und mehrere Overlays (Meilenstein 2+) dazukommen, wird
// daraus eine Registry von Fenstern pro Overlay-Typ.
const EDIT_MODE_HOTKEY = 'Control+Alt+E';

let testWindow: BrowserWindow | null = null;
let editMode = false;

function createTestWindow(): void {
  testWindow = new BrowserWindow({
    x: 100,
    y: 100,
    width: 420,
    height: 170,
    frame: false,
    transparent: true,
    resizable: false,
    // Damit das Overlay nicht im Alt-Tab und in der Taskleiste auftaucht —
    // es soll wie ein Teil des Sims wirken, nicht wie ein eigenes Programm.
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 'screen-saver' haelt das Fenster auch ueber Vollbild-Anwendungen im
  // Borderless-Windowed-Modus oben. Bei echtem Fullscreen-Exclusive greift
  // das nicht mehr, weil Windows dort gar nicht mehr komposittet
  // (siehe docs/fullscreen-exclusive.md).
  testWindow.setAlwaysOnTop(true, 'screen-saver');

  // Ausserhalb des Edit-Modus muessen Klicks ungehindert zum Sim durchgehen,
  // sonst blockiert das Overlay dessen Bedienung.
  testWindow.setIgnoreMouseEvents(true);

  testWindow.once('ready-to-show', () => testWindow?.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    testWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/test-overlay/`);
  } else {
    testWindow.loadFile(join(__dirname, '../renderer/test-overlay/index.html'));
  }
}

function toggleEditMode(): void {
  editMode = !editMode;
  // forward:true laesst Hover-Events weiter beim Renderer ankommen, falls
  // spaeter Resize-Handles per CSS :hover reagieren sollen.
  testWindow?.setIgnoreMouseEvents(!editMode, { forward: true });
  testWindow?.webContents.send('edit-mode-changed', editMode);
  console.log(`[main] edit mode -> ${editMode}`);
}

app.whenReady().then(() => {
  createTestWindow();

  const registered = globalShortcut.register(EDIT_MODE_HOTKEY, toggleEditMode);
  if (!registered) {
    console.error(`[main] Hotkey ${EDIT_MODE_HOTKEY} konnte nicht registriert werden`);
  }

  ipcMain.handle('get-edit-mode', () => editMode);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
