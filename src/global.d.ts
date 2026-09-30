/// <reference types="vite/client" />

export type NovelBridge = {
  readSettings: () => Promise<unknown>;
  writeSettings: (data: unknown) => Promise<void>;
  readSaves: () => Promise<unknown>;
  writeSaves: (data: unknown) => Promise<void>;
  openProject: () => Promise<{ dir: string; project: unknown } | null>;
  saveProject: (dir: string | null, project: unknown) => Promise<string | null>;
  importAsset: (dir: string, subdir: string, name: string, bytes: Uint8Array) => Promise<string>;
  setFullScreen: (on: boolean) => Promise<void>;
  closeWindow: () => Promise<void>;
  loadBundledProject: () => Promise<unknown>;
  openPreview: (project: unknown) => Promise<boolean>;
  takePreviewProject: () => Promise<unknown>;
  canExportInstaller: () => Promise<boolean>;
  exportInstaller: (dir: string | null, project: unknown) => Promise<string | null>;
};

declare global {
  interface Window {
    novelStudio?: NovelBridge;
  }
}
