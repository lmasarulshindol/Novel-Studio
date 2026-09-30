export type GameSettings = {
  textSpeed: number;
  autoDelay: number;
  bgm: number;
  se: number;
  voice: number;
  system: number;
  windowOpacity: number;
  fullscreen: boolean;
  skipRead: boolean;
};

export function defaultSettings(): GameSettings {
  return {
    textSpeed: 36,
    autoDelay: 1.6,
    bgm: 0.7,
    se: 0.8,
    voice: 0.9,
    system: 0.7,
    windowOpacity: 0.72,
    fullscreen: false,
    skipRead: true,
  };
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeSettings(raw: unknown): GameSettings {
  const source = (raw ?? {}) as Partial<GameSettings>;
  const base = defaultSettings();
  return {
    textSpeed: clamp(source.textSpeed, base.textSpeed, 1, 200),
    autoDelay: clamp(source.autoDelay, base.autoDelay, 0.2, 8),
    bgm: clamp(source.bgm, base.bgm, 0, 1),
    se: clamp(source.se, base.se, 0, 1),
    voice: clamp(source.voice, base.voice, 0, 1),
    system: clamp(source.system, base.system, 0, 1),
    windowOpacity: clamp(source.windowOpacity, base.windowOpacity, 0.15, 1),
    fullscreen: Boolean(source.fullscreen),
    skipRead: source.skipRead !== false,
  };
}
