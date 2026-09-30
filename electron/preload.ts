import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('novelStudio', {
  readSettings: () => ipcRenderer.invoke('settings:read'),
  writeSettings: (data: unknown) => ipcRenderer.invoke('settings:write', data),
  readSaves: () => ipcRenderer.invoke('saves:read'),
  writeSaves: (data: unknown) => ipcRenderer.invoke('saves:write', data),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (dir: string | null, project: unknown) => ipcRenderer.invoke('project:save', dir, project),
  importAsset: (dir: string, subdir: string, name: string, bytes: Uint8Array) => ipcRenderer.invoke('asset:import', dir, subdir, name, bytes),
  setFullScreen: (on: boolean) => ipcRenderer.invoke('window:fullscreen', on),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  loadBundledProject: () => ipcRenderer.invoke('player:bundled'),
  openPreview: (project: unknown) => ipcRenderer.invoke('preview:open', project),
  takePreviewProject: () => ipcRenderer.invoke('preview:project'),
  canExportInstaller: () => ipcRenderer.invoke('game:canExport'),
  exportInstaller: (dir: string | null, project: unknown) => ipcRenderer.invoke('game:export', dir, project),
});
