import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('overlayTestAPI', {
  onEditModeChange: (callback: (editMode: boolean) => void) => {
    ipcRenderer.on('edit-mode-changed', (_event, editMode: boolean) => callback(editMode));
  },
  getEditMode: (): Promise<boolean> => ipcRenderer.invoke('get-edit-mode'),
});
