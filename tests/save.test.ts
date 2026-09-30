import { describe, expect, it } from 'vitest';
import { emptySaveFile, latestSlot, SLOT_COUNT, writeSlot, type SaveSlot, type StageSnapshot } from '../src/core/save/save';
import { addAsset, createEmptyProject } from '../src/core/project/project';

function stage(): StageSnapshot {
  return {
    characters: [{ id: 'mitsuki', kind: 'char', expr: 'smile', x: 1, y: 2, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, blend: 'normal' }],
    camera: { x: 0, y: 0, zoom: 1, rotation: 0, letterbox: 0 },
    particle: null,
  };
}

function slot(index: number, savedAt: string, text: string): SaveSlot {
  return {
    slot: index,
    savedAt,
    previewText: text,
    speaker: '美月',
    index: 4,
    vars: { met: true },
    choiceLock: false,
    stage: stage(),
    thumbnail: 'data:image/jpeg;base64,abc',
  };
}

describe('セーブ', () => {
  it('10枠で最新を返す', () => {
    expect(emptySaveFile().slots).toHaveLength(SLOT_COUNT);
    expect(latestSlot(emptySaveFile())).toBeNull();
    const file = writeSlot(writeSlot(emptySaveFile(), slot(1, '2026-01-01T00:00:00.000Z', '古い')), slot(3, '2026-02-01T00:00:00.000Z', '新しい'));
    expect(latestSlot(file)?.previewText).toBe('新しい');
    expect(file.slots[1]?.vars.met).toBe(true);
    expect(file.slots[3]?.thumbnail).toContain('jpeg');
  });

  it('範囲外スロットは拒否する', () => {
    expect(() => writeSlot(emptySaveFile(), slot(10, '2026-01-01T00:00:00.000Z', 'x'))).toThrow(/範囲外/);
  });

  it('書き込みは元データを変えない', () => {
    const original = emptySaveFile();
    writeSlot(original, slot(0, '2026-01-01T00:00:00.000Z', 'a'));
    expect(original.slots[0]).toBeNull();
  });
});

describe('素材追加', () => {
  it('背景と表情差分を足す', () => {
    const withBg = addAsset(createEmptyProject(), { kind: 'background', id: 'room', variant: 'day', src: '/a.png' });
    const withChar = addAsset(withBg, { kind: 'character', id: 'mitsuki', name: '美月', expr: 'smile', src: '/c.png' });
    const withExpr = addAsset(withChar, { kind: 'character', id: 'mitsuki', name: '美月', expr: 'shy', src: '/d.png' });
    expect(withExpr.assets.backgrounds).toHaveLength(1);
    expect(withExpr.assets.characters[0].expressions.map((item) => item.id)).toEqual(['smile', 'shy']);
    expect(withBg.assets.characters).toHaveLength(0);
  });
});
