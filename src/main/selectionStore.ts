/**
 * Speichert, welche Overlays beim letzten Start im Launcher ausgewaehlt
 * waren - damit die Checkboxen beim naechsten Start denselben Zustand
 * zeigen statt jedes Mal wieder alles neu anhaken zu muessen.
 */

import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function selectionPath(): string {
  return join(app.getPath('userData'), 'layouts', 'selection.json');
}

export async function loadSelection(): Promise<string[] | undefined> {
  try {
    const raw = await readFile(selectionPath(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : undefined;
  } catch {
    // Datei fehlt beim ersten Start oder ist beschaedigt - beides ist kein
    // Fehlerfall, der Aufrufer entscheidet dann selbst ueber einen Default.
    return undefined;
  }
}

export async function saveSelection(selectedIds: string[]): Promise<void> {
  const dir = join(app.getPath('userData'), 'layouts');
  await mkdir(dir, { recursive: true });
  await writeFile(selectionPath(), JSON.stringify(selectedIds, null, 2), 'utf-8');
}
