import { describe, expect, it } from 'vitest';
import { normalizeProject } from '../src/core/project/project';
import { getTextFrame, normalizeTextFrame, TEXT_FRAMES } from '../src/core/project/text-frame';

describe('テキスト枠', () => {
  it('未知の値は下の帯に戻す', () => {
    expect(normalizeTextFrame('ribbon')).toBe('band');
    expect(normalizeTextFrame(undefined)).toBe('band');
    expect(getTextFrame('overlay').layout).toBe('overlay');
    expect(TEXT_FRAMES.map((frame) => frame.label)).toEqual(['下の帯', '絵の上', '名札', '地の文', '枠なし']);
  });

  it('作品に保存した枠を読み戻す', () => {
    const project = normalizeProject({ name: '枠', script: '「美月」 こんにちは。\n', textFrame: 'nameplate' });
    expect(project.textFrame).toBe('nameplate');
    expect(normalizeProject({ script: '' }).textFrame).toBe('band');
  });
});
