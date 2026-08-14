/**
 * Persistenz fuer Layout-Modus-Layouts (siehe settings/layout.ts) - ein
 * JSON pro Layout unter `layout-mode/<id>.json`, plus eine kleine
 * Index-Datei fuer das gerade aktive Layout. Bewusst getrennt von
 * layoutStore.ts (Fensterpositionen im Overlay-Modus, pro Profil) und
 * positionStore.ts (dessen Nachfolger im neuen Prozent-Format) - Layouts
 * sind ein eigenes Konzept fuer das andere Fenstermodell, siehe
 * main/layoutWindowTarget.ts.
 */

import { app } from 'electron';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Layout } from '../settings/layout.js';

interface IndexFile {
  activeLayoutId: string | null;
}

function layoutModeDir(): string {
  return join(app.getPath('userData'), 'layout-mode');
}

function layoutPath(id: string): string {
  return join(layoutModeDir(), `${id}.json`);
}

function indexPath(): string {
  return join(layoutModeDir(), 'index.json');
}

export async function listLayouts(): Promise<Layout[]> {
  let files: string[];
  try {
    files = await readdir(layoutModeDir());
  } catch {
    return [];
  }

  const layouts: Layout[] = [];
  for (const file of files) {
    if (!file.endsWith('.json') || file === 'index.json') continue;
    try {
      const raw = await readFile(join(layoutModeDir(), file), 'utf-8');
      layouts.push(JSON.parse(raw) as Layout);
    } catch {
      // Einzelne beschaedigte Datei ueberspringen statt die ganze Liste crashen zu lassen.
    }
  }
  return layouts;
}

export async function saveLayout(layout: Layout): Promise<void> {
  await mkdir(layoutModeDir(), { recursive: true });
  await writeFile(layoutPath(layout.id), JSON.stringify(layout, null, 2), 'utf-8');
}

export async function deleteLayout(id: string): Promise<void> {
  await rm(layoutPath(id), { force: true });
}

export async function loadActiveLayoutId(): Promise<string | null> {
  try {
    const raw = await readFile(indexPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<IndexFile>;
    return typeof parsed.activeLayoutId === 'string' ? parsed.activeLayoutId : null;
  } catch {
    return null;
  }
}

export async function saveActiveLayoutId(id: string | null): Promise<void> {
  await mkdir(layoutModeDir(), { recursive: true });
  await writeFile(indexPath(), JSON.stringify({ activeLayoutId: id } satisfies IndexFile, null, 2), 'utf-8');
}
