import { describe, expect, it } from 'vitest';
import { applyMonitor, defaultEditorMonitor, monitorLevel, normalizeEditorMonitor } from '../src/core/editor/monitor';
import { defaultSettings } from '../src/core/settings';

describe('編集中の音量', () => {
  it('BGMは最初ミュートで、SEとボイスは鳴る', () => {
    const monitor = defaultEditorMonitor();
    expect(monitor.muteBgm).toBe(true);
    expect(monitorLevel(monitor, 'bgm')).toBe(0);
    expect(monitorLevel(monitor, 'se')).toBe(0.8);
    expect(monitorLevel(monitor, 'voice')).toBe(0.9);
  });

  it('ミュートを外すとスライダーの音量になる', () => {
    const monitor = normalizeEditorMonitor({ bgm: 0.4, muteBgm: false, se: 1.4, muteSe: true, voice: -1 });
    expect(monitor.bgm).toBe(0.4);
    expect(monitor.se).toBe(1);
    expect(monitor.voice).toBe(0);
    expect(monitorLevel(monitor, 'bgm')).toBe(0.4);
    expect(monitorLevel(monitor, 'se')).toBe(0);
    expect(monitorLevel(monitor, 'voice')).toBe(0);
  });

  it('作品の設定はそのまま、編集中の実効音量だけを渡す', () => {
    const settings = defaultSettings();
    const next = applyMonitor(settings, { ...defaultEditorMonitor(), muteBgm: false, bgm: 0.2, muteVoice: true });
    expect(next.bgm).toBe(0.2);
    expect(next.voice).toBe(0);
    expect(next.se).toBe(settings.se);
    expect(settings.bgm).toBe(0.7);
  });
});
