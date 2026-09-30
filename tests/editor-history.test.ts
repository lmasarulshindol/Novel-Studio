import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, commitHistory, createHistory, redoHistory, undoHistory } from '../src/core/editor/history';
import {
  deleteLines,
  duplicateLines,
  editorShortcut,
  findMatch,
  moveLines,
  offsetOfLine,
  replaceAll,
  replaceOnce,
  toggleComment,
} from '../src/core/editor/script-edit';

const same = (left: string, right: string) => left === right;

describe('編集履歴', () => {
  it('連続入力はひとまとめに戻せる', () => {
    let history = createHistory('a');
    history = commitHistory(history, 'ab', true, same);
    history = commitHistory(history, 'abc', true, same);
    expect(canUndo(history)).toBe(true);
    history = undoHistory(history);
    expect(history.present).toBe('a');
    expect(canRedo(history)).toBe(true);
    history = redoHistory(history);
    expect(history.present).toBe('abc');
  });

  it('ドラッグのような別操作は一段ずつ戻る', () => {
    let history = commitHistory(createHistory('a'), 'b', false, same);
    history = commitHistory(history, 'c', false, same);
    expect(undoHistory(history).present).toBe('b');
    expect(undoHistory(undoHistory(history)).present).toBe('a');
    expect(canUndo(createHistory('a'))).toBe(false);
    expect(canRedo(createHistory('a'))).toBe(false);
  });

  it('戻したあとの新しい編集は進む先を捨てる', () => {
    let history = commitHistory(createHistory('a'), 'b', false, same);
    history = undoHistory(history);
    history = commitHistory(history, 'c', false, same);
    expect(history.present).toBe('c');
    expect(canRedo(history)).toBe(false);
  });
});

describe('台本の編集操作', () => {
  const script = 'bg day\n「美月」 おはよう。\nplay bgm day loop\n';

  it('ショートカットを割り当てる', () => {
    expect(editorShortcut({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe('undo');
    expect(editorShortcut({ key: 'y', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe('redo');
    expect(editorShortcut({ key: 'Z', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false })).toBe('redo');
    expect(editorShortcut({ key: 's', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe('save');
    expect(editorShortcut({ key: '/', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe('comment');
    expect(editorShortcut({ key: 'ArrowUp', ctrlKey: false, metaKey: false, shiftKey: false, altKey: true })).toBe('moveUp');
  });

  it('検索は末尾の次で先頭へ戻る', () => {
    expect(findMatch(script, '美月', 0, false, true)?.start).toBe(script.indexOf('美月'));
    expect(findMatch(script, 'bg', script.length, false, true)?.start).toBe(0);
    expect(findMatch(script, 'ない', 0, false, true)).toBeNull();
  });

  it('行の複製・コメント・削除・移動', () => {
    const duplicated = duplicateLines(script, 0, 0);
    expect(duplicated.script.startsWith('bg day\nbg day\n')).toBe(true);
    const commented = toggleComment(script, 0, 0);
    expect(commented.script.startsWith('// bg day\n')).toBe(true);
    expect(toggleComment(commented.script, 0, 0).script.startsWith('bg day\n')).toBe(true);
    const removed = deleteLines(script, script.indexOf('「'), script.indexOf('「'));
    expect(removed.script).not.toContain('おはよう');
    expect(removed.script).toContain('play bgm');
    const moved = moveLines(script, 0, 0, 1);
    expect(moved.script.startsWith('「美月」 おはよう。\nbg day\n')).toBe(true);
  });

  it('置換と行番号', () => {
    const once = replaceOnce(script, 'おはよう', 'こんにちは', 0, 0, true);
    expect(once?.script).toContain('こんにちは');
    expect(replaceAll('Bg bg', 'bg', '背景', false)).toBe('背景 背景');
    expect(script.slice(offsetOfLine(script, 2).start, offsetOfLine(script, 2).end)).toBe('「美月」 おはよう。');
  });
});
