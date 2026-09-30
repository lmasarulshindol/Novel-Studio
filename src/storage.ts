import { emptySaveFile, normalizeSaves, type SaveFile } from './core/save/save';
import { normalizeSettings, type GameSettings } from './core/settings';

async function readRemote<T>(read: (() => Promise<T | null>) | undefined): Promise<T | null> {
  if (!read) return null;
  try {
    return await read();
  } catch {
    return null;
  }
}

export async function loadSettings(): Promise<GameSettings> {
  const remote = await readRemote(window.novelStudio?.readSettings);
  if (remote) return normalizeSettings(remote);
  try {
    const raw = localStorage.getItem('novel-studio-settings');
    if (raw) return normalizeSettings(JSON.parse(raw));
  } catch {
    /* 壊れた設定は初期値に戻す */
  }
  return normalizeSettings(null);
}

export async function storeSettings(settings: GameSettings): Promise<void> {
  const next = normalizeSettings(settings);
  localStorage.setItem('novel-studio-settings', JSON.stringify(next));
  await window.novelStudio?.writeSettings(next);
}

export async function loadSaves(): Promise<SaveFile> {
  const remote = await readRemote(window.novelStudio?.readSaves);
  if (remote) return normalizeSaves(remote);
  try {
    const raw = localStorage.getItem('novel-studio-saves');
    if (raw) return normalizeSaves(JSON.parse(raw));
  } catch {
    /* 初期の空データ */
  }
  return emptySaveFile();
}

export async function storeSaves(file: SaveFile): Promise<void> {
  const next = normalizeSaves(file);
  localStorage.setItem('novel-studio-saves', JSON.stringify(next));
  await window.novelStudio?.writeSaves(next);
}
