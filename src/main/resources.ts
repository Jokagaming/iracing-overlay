/**
 * Findet mitgelieferte Assets (Icons) sowohl im Dev-Modus als auch im
 * gepackten Build - die beiden haben unterschiedliche Verzeichnislayouts.
 */

import { app } from 'electron';
import { join } from 'node:path';

export function resourcePath(file: string): string {
  if (app.isPackaged) {
    // electron-builder kopiert resources/* per extraResources direkt in
    // den Resources-Ordner der gepackten App, siehe electron-builder.yml.
    return join(process.resourcesPath, file);
  }
  // __dirname ist im Dev-Build out/main/ - zwei Ebenen hoch zum Projekt-Root.
  return join(__dirname, '../../resources', file);
}
