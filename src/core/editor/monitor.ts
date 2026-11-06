import type { GameSettings } from '../settings';

export type MonitorChannel = 'bgm' | 'se' | 'voice';

export type EditorMonitor = {
  bgm: number;
  se: number;
  voice: number;
  muteBgm: boolean;
  muteSe: boolean;
  muteVoice: boolean;
};

const KEY = 'novel-studio-editor-monitor';

export function defaultEditorMonitor(settings?: Pick<GameSettings, MonitorChannel>): EditorMonitor {
  return {
    bgm: settings?.bgm ?? 0.7,
    se: settings?.se ?? 0.8,
    voice: settings?.voice ?? 0.9,
    muteBgm: true,
    muteSe: false,
    muteVoice: false,
  };
}

function clampLevel(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

export function normalizeEditorMonitor(raw: unknown, settings?: Pick<GameSettings, MonitorChannel>): EditorMonitor {
  const base = defaultEditorMonitor(settings);
  const source = (raw ?? {}) as Partial<EditorMonitor>;
  return {
    bgm: clampLevel(source.bgm, base.bgm),
    se: clampLevel(source.se, base.se),
    voice: clampLevel(source.voice, base.voice),
    muteBgm: source.muteBgm === undefined ? true : Boolean(source.muteBgm),
    muteSe: source.muteSe === true,
    muteVoice: source.muteVoice === true,
  };
}

export function monitorLevel(monitor: EditorMonitor, channel: MonitorChannel): number {
  if (channel === 'bgm' && monitor.muteBgm) return 0;
  if (channel === 'se' && monitor.muteSe) return 0;
  if (channel === 'voice' && monitor.muteVoice) return 0;
  return monitor[channel];
}

export function applyMonitor(settings: GameSettings, monitor: EditorMonitor): GameSettings {
  return {
    ...settings,
    bgm: monitorLevel(monitor, 'bgm'),
    se: monitorLevel(monitor, 'se'),
    voice: monitorLevel(monitor, 'voice'),
  };
}

export function loadEditorMonitor(settings?: Pick<GameSettings, MonitorChannel>): EditorMonitor {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeEditorMonitor(JSON.parse(raw), settings);
  } catch {
    /* 壊れた値は初期値に戻す */
  }
  return defaultEditorMonitor(settings);
}

export function saveEditorMonitor(monitor: EditorMonitor): void {
  localStorage.setItem(KEY, JSON.stringify(normalizeEditorMonitor(monitor)));
}
