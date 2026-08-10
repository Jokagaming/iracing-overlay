import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('overlayAPI', {
  onEditModeChange: (callback: (editMode: boolean) => void) => {
    ipcRenderer.on('edit-mode-changed', (_event, editMode: boolean) => callback(editMode));
  },
});
