import { app, globalShortcut } from 'electron';
import type { BrowserWindow, Tray } from 'electron';
import { DataLayer } from './dataLayer.js';
import { createOverlayWindow, setEditMode } from './overlayWindow.js';
import { createTray } from './tray.js';
import { createLauncherWindow, showLauncherWindow } from './launcherWindow.js';
import { loadProfiles, saveProfiles, uniqueProfileId, type Profile, type ProfilesFile } from './profileStore.js';
import { deleteLayoutFile } from './layoutStore.js';
import { checkForUpdates, setupAutoUpdate } from './autoUpdate.js';

const EDIT_MODE_HOTKEY = 'Control+Alt+E';
const DATA_HOST = '127.0.0.1';
const DATA_PORT = 8778;
// Startpositionen, falls noch kein Layout gespeichert ist (erster Start).
const OVERLAY_WINDOWS = [
  { id: 'relative', x: 40, y: 40, width: 380, height: 260 },
  { id: 'standings', x: 400, y: 40, width: 360, height: 320 },
  { id: 'fuel', x: 40, y: 320, width: 220, height: 190 },
  { id: 'inputs', x: 780, y: 40, width: 300, height: 150 },
  { id: 'radar', x: 780, y: 210, width: 150, height: 220 },
  { id: 'delta', x: 40, y: 530, width: 180, height: 90 },
  { id: 'laptimes', x: 400, y: 370, width: 360, height: 120 },
  { id: 'timer', x: 240, y: 530, width: 150, height: 100 },
  { id: 'weather', x: 410, y: 530, width: 190, height: 130 },
  { id: 'flags', x: 620, y: 530, width: 160, height: 60 },
];

// Deutsche Anzeigenamen fuer das Auswahl-Menue (launcherWindow.ts) - hat
// sonst keinen Bezug zu OVERLAY_WINDOWS, nur ueber die id verknuepft.
const OVERLAY_LABELS: Record<string, string> = {
  relative: 'Relative (Autos vor/hinter mir)',
  standings: 'Wertung',
  fuel: 'Sprit',
  inputs: 'Eingaben (Gas/Bremse/Lenkung)',
  radar: 'Radar',
  delta: 'Delta (Bestzeit-Abstand)',
  laptimes: 'Rundenzeiten-Diagramm (letzte 5)',
  timer: 'Session-Timer',
  weather: 'Wetter',
  flags: 'Flaggen',
};

const dataLayer = new DataLayer();
// Nur die gerade offenen Overlay-Fenster, per id - der Launcher schaltet
// einzelne davon an/aus, ohne die App neu zu starten.
const overlayWindows = new Map<string, BrowserWindow>();
let editMode = false;
// Alle Layout-Profile + welches davon gerade aktiv ist - siehe profileStore.ts.
// Wird in app.whenReady() aus der Nutzerdatei geladen, danach hier live gehalten.
let profilesFile: ProfilesFile = { activeProfileId: '', profiles: [] };
let activeProfileId = '';
// Muss am Leben gehalten werden - ein garbage-collectes Tray-Objekt laesst
// das Icon kommentarlos aus der Taskleiste verschwinden.
let tray: Tray | null = null;

/** `--rate 20` -> 20. Ungueltig oder fehlend -> undefined (DataLayer nutzt dann seinen Standard). */
function parseRateArg(argv: string[]): number | undefined {
  const index = argv.indexOf('--rate');
  if (index === -1 || index + 1 >= argv.length) return undefined;
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function toggleEditMode(): void {
  editMode = !editMode;
  setEditMode([...overlayWindows.values()], editMode);
  console.log(`[main] edit mode -> ${editMode}`);
}

async function openOverlay(id: string): Promise<void> {
  const config = OVERLAY_WINDOWS.find((w) => w.id === id);
  if (!config) return;
  const win = await createOverlayWindow(config, activeProfileId, () => dataLayer.getWelcomeMessages());
  if (editMode) setEditMode([win], true);
  overlayWindows.set(id, win);
}

function findProfile(profileId: string): Profile | undefined {
  return profilesFile.profiles.find((p) => p.id === profileId);
}

/**
 * Wird vom Launcher-Fenster mit Profil + Checkbox-Auswahl aufgerufen.
 * Bei gleichbleibendem Profil wie bisher nur die Differenz oeffnen/
 * schliessen; beim Profilwechsel gehoeren alle offenen Fenster zum alten
 * Profil und lassen sich nicht einzeln "umhaengen" - komplett neu aufbauen.
 */
async function applyProfile(profileId: string, selectedIds: string[]): Promise<void> {
  const selected = new Set(selectedIds);
  const switchingProfile = profileId !== activeProfileId;

  if (switchingProfile) {
    for (const win of overlayWindows.values()) win.close();
    overlayWindows.clear();
    activeProfileId = profileId;
  } else {
    for (const [id, win] of overlayWindows) {
      if (!selected.has(id)) {
        win.close();
        overlayWindows.delete(id);
      }
    }
  }

  for (const id of selected) {
    if (!overlayWindows.has(id)) await openOverlay(id);
  }

  const profile = findProfile(profileId);
  if (profile) profile.selectedOverlayIds = [...selected];
  profilesFile.activeProfileId = activeProfileId;
  await saveProfiles(profilesFile);
}

async function createProfile(name: string): Promise<Profile> {
  const trimmed = name.trim() || 'Profil';
  const profile: Profile = {
    id: uniqueProfileId(trimmed, profilesFile.profiles),
    name: trimmed,
    // Neues Profil startet mit allen Overlays angehakt - derselbe Default wie beim allerersten App-Start.
    selectedOverlayIds: OVERLAY_WINDOWS.map((w) => w.id),
  };
  profilesFile.profiles.push(profile);
  await saveProfiles(profilesFile);
  return profile;
}

async function renameProfile(profileId: string, name: string): Promise<void> {
  const profile = findProfile(profileId);
  const trimmed = name.trim();
  if (!profile || !trimmed) return;
  profile.name = trimmed;
  await saveProfiles(profilesFile);
}

/** Letztes verbleibendes Profil laesst sich nicht loeschen - es muss immer mindestens eines geben. */
async function deleteProfile(profileId: string): Promise<{ profiles: Profile[]; activeProfileId: string }> {
  if (profilesFile.profiles.length <= 1) {
    return { profiles: profilesFile.profiles, activeProfileId };
  }

  profilesFile.profiles = profilesFile.profiles.filter((p) => p.id !== profileId);
  await deleteLayoutFile(profileId);

  if (activeProfileId === profileId) {
    // Aktives Profil geloescht - offene Fenster gehoeren zu keinem
    // existierenden Profil mehr, schliessen statt sie verwaist stehen zu lassen.
    for (const win of overlayWindows.values()) win.close();
    overlayWindows.clear();
    activeProfileId = profilesFile.profiles[0]!.id;
  }

  profilesFile.activeProfileId = activeProfileId;
  await saveProfiles(profilesFile);
  return { profiles: profilesFile.profiles, activeProfileId };
}

const DEFAULT_TELEMETRY_HZ = 20;

app.whenReady().then(async () => {
  profilesFile = await loadProfiles(OVERLAY_WINDOWS.map((w) => w.id));
  activeProfileId = profilesFile.activeProfileId;

  createLauncherWindow({
    overlays: OVERLAY_WINDOWS.map((w) => ({ id: w.id, label: OVERLAY_LABELS[w.id] ?? w.id })),
    getProfiles: () => profilesFile.profiles,
    getActiveProfileId: () => activeProfileId,
    getRunningOverlayIds: () => [...overlayWindows.keys()],
    onCreateProfile: (name) => createProfile(name),
    onRenameProfile: (profileId, name) => {
      void renameProfile(profileId, name);
    },
    onDeleteProfile: (profileId) => deleteProfile(profileId),
    onStart: (profileId, selectedIds) => {
      void applyProfile(profileId, selectedIds);
    },
  });

  const registered = globalShortcut.register(EDIT_MODE_HOTKEY, toggleEditMode);
  if (!registered) {
    console.error(`[main] Hotkey ${EDIT_MODE_HOTKEY} konnte nicht registriert werden`);
  }

  tray = createTray({
    onToggleEditMode: toggleEditMode,
    isEditMode: () => editMode,
    onOpenLauncher: showLauncherWindow,
    onCheckForUpdates: checkForUpdates,
  });

  setupAutoUpdate();

  // --demo laesst die App ohne laufendes iRacing testen, z.B. via
  // `npm run dev -- --demo` im electron-vite-Entwicklungsmodus.
  const demo = process.argv.includes('--demo');
  const telemetryHz = parseRateArg(process.argv);
  await dataLayer.start({
    host: DATA_HOST,
    port: DATA_PORT,
    demo,
    telemetryHz,
    // Direkt an die eigenen Fenster statt nur ueber WS - siehe
    // dataLayer.ts und README ("Performance"). Der WS-Server laeuft
    // trotzdem weiter, fuer externe Verbraucher. Laeuft unabhaengig von
    // der Launcher-Auswahl - erst offene Overlay-Fenster bekommen etwas
    // zu sehen.
    onMessage: (message) => {
      for (const win of overlayWindows.values()) {
        if (!win.isDestroyed()) win.webContents.send('bridge-message', message);
      }
    },
  });
  console.log(
    `[main] Datenlayer auf ws://${DATA_HOST}:${DATA_PORT}${demo ? ' (Demo-Modus)' : ''}, Telemetrie ${telemetryHz ?? DEFAULT_TELEMETRY_HZ}Hz`,
  );
});

// Bewusst KEIN app.quit() bei window-all-closed: die Overlays haben weder
// Rahmen noch Schliessen-Button, die App soll ausschliesslich ueber den
// Tray ("Beenden") oder Strg+C im Terminal enden - alles andere waere
// ueberraschend fuer eine Tray-App.

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
  await dataLayer.stop();
});
