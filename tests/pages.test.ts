import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expressionBoard, expressionPath, filledExpressionCount } from '../src/core/project/expressions';
import type { CharacterAsset } from '../src/core/project/project';
import {
  commandAllowed,
  commandsForEditPage,
  insertLineBefore,
  pageLayerLabel,
  placeCharacterOnPage,
  scenarioPages,
  setPageLayers,
  writeAt,
} from '../src/core/scenario/pages';
import { parseScenario } from '../src/core/scenario/parser';

const mitsuki: CharacterAsset = {
  id: 'mitsuki',
  name: '美月',
  expressions: [
    { id: 'smile', src: 'sample/chars/mitsuki_smile.png' },
    { id: 'shy', src: 'sample/chars/mitsuki_shy.png' },
  ],
};

describe('表情テンプレート', () => {
  it('未設定の枠も同じ並びで出す', () => {
    const board = expressionBoard(mitsuki);
    expect(board.map((slot) => slot.id).slice(0, 4)).toEqual(['smile', 'shy', 'tease', 'soft']);
    expect(board.find((slot) => slot.id === 'smile')?.filled).toBe(true);
    expect(board.find((slot) => slot.id === 'tease')).toMatchObject({
      filled: false,
      fileName: 'mitsuki_tease.png',
      path: 'sample/chars/mitsuki_tease.png',
    });
    expect(filledExpressionCount(mitsuki)).toEqual({ filled: 2, total: 8 });
    expect(expressionPath(mitsuki, 'angry')).toBe('sample/chars/mitsuki_angry.png');
  });
});

describe('ページの出し分け', () => {
  const script = [
    'bg classroom day with fade duration=0.4',
    'play bgm day loop fade=1',
    'show mitsuki smile at left',
    '「美月」 風、あったかい。',
    '「美月」 小春、まだかな。',
    'play se appear',
    'expr mitsuki shy',
    '「美月」 ううん。',
  ].join('\n');

  it('セリフの直前までを1ページにまとめる', () => {
    const pages = scenarioPages(script);
    expect(pages).toHaveLength(3);
    expect(pages[0].layers).toEqual({ text: true, image: true, audio: true });
    expect(pages[1].layers).toEqual({ text: true, image: false, audio: false });
    expect(pages[1].text).toBe('小春、まだかな。');
    expect(pages[2].layers).toEqual({ text: true, image: true, audio: true });
    expect(pageLayerLabel(pages[1].layers)).toBe('テキストだけ');
    expect(pageLayerLabel(pages[0].layers)).toBe('テキストと画像と音声');
  });

  it('印がなければ再生は今まで通り', () => {
    const pages = scenarioPages(script);
    const program = parseScenario(script);
    const show = program.commands.find((command) => command.type === 'show');
    expect(show && commandAllowed(pages[0], show)).toBe(true);
  });

  it('テキストだけの指定では画像と音を再生しない', () => {
    const marked = setPageLayers(script, 4, { text: true, image: false, audio: false });
    expect(marked).toContain('「美月」 風、あったかい。 // @page text');
    const pages = scenarioPages(marked);
    const program = parseScenario(marked);
    expect(program.commands.find((command) => command.type === 'dialogue')?.text).toBe('風、あったかい。');
    expect(pages[0].explicit).toBe(true);
    expect(pages[0].layers).toEqual({ text: true, image: false, audio: false });
    const show = program.commands.find((command) => command.type === 'show');
    const bgm = program.commands.find((command) => command.type === 'play');
    expect(show && commandAllowed(pages[0], show)).toBe(false);
    expect(bgm && commandAllowed(pages[0], bgm)).toBe(false);
  });

  it('編集の移動では過去の効果音を鳴らし直さない', () => {
    const commands = commandsForEditPage(script, 2);
    const audio = commands.filter((command) => command.type === 'play');
    expect(audio.map((command) => command.type === 'play' ? `${command.channel}:${command.id}` : '')).toEqual([
      'bgm:day',
      'se:appear',
    ]);
    expect(commands.some((command) => command.type === 'expr')).toBe(true);
  });

  it('ドラッグした位置を show か place に残す', () => {
    expect(writeAt('show mitsuki smile at left with fadeIn duration=0.6', 640.4, 1000.2)).toBe('show mitsuki smile at 640,1000 with fadeIn duration=0.6');
    const pages = scenarioPages(script);
    const moved = placeCharacterOnPage(script, pages[0], 'mitsuki', 640, 1000);
    expect(moved.script).toContain('show mitsuki smile at 640,1000');
    expect(moved.endLine).toBe(pages[0].endLine);
    const later = placeCharacterOnPage(script, pages[1], 'mitsuki', 800, 980);
    expect(later.script).toContain('place mitsuki at 800,980');
    const placed = parseScenario(later.script).commands.find((command) => command.type === 'place');
    expect(placed).toMatchObject({ character: 'mitsuki', at: '800,980' });
    const again = scenarioPages(later.script);
    expect(commandsForEditPage(later.script, 1).some((command) => command.type === 'place')).toBe(true);
    expect(again[1].layers.image).toBe(true);
  });

  it('ページの前に表情行を差し込める', () => {
    const next = insertLineBefore(script, 5, 'expr mitsuki shy');
    const pages = scenarioPages(next);
    expect(pages[1].layers.image).toBe(true);
    expect(pages[1].text).toBe('小春、まだかな。');
  });
});

describe('二人の放課後のページ', () => {
  it('セリフの数だけページがある', () => {
    const script = fs.readFileSync('projects/duet/script.txt', 'utf8');
    const pages = scenarioPages(script);
    const spoken = pages.filter((page) => page.text);
    expect(spoken.length).toBeGreaterThan(60);
    expect(spoken[0].speaker).toBe('美月');
    expect(spoken[0].layers.image).toBe(true);
    expect(spoken.some((page) => page.layers.image === false && page.layers.audio === false)).toBe(true);
  });
});
