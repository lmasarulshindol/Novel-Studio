export type ScriptEdit = {
  script: string;
  selectionStart: number;
  selectionEnd: number;
};

export type ShortcutName =
  | 'undo'
  | 'redo'
  | 'save'
  | 'find'
  | 'replace'
  | 'goto'
  | 'duplicate'
  | 'comment'
  | 'deleteLine'
  | 'moveUp'
  | 'moveDown';

export function editorShortcut(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): ShortcutName | null {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (mod && !event.altKey && key === 'z' && !event.shiftKey) return 'undo';
  if (mod && !event.altKey && (key === 'y' || (key === 'z' && event.shiftKey))) return 'redo';
  if (mod && !event.shiftKey && !event.altKey && key === 's') return 'save';
  if (mod && !event.shiftKey && !event.altKey && key === 'f') return 'find';
  if (mod && !event.shiftKey && !event.altKey && key === 'h') return 'replace';
  if (mod && !event.shiftKey && !event.altKey && key === 'g') return 'goto';
  if (mod && !event.shiftKey && !event.altKey && key === 'd') return 'duplicate';
  if (mod && !event.shiftKey && !event.altKey && event.key === '/') return 'comment';
  if (mod && event.shiftKey && !event.altKey && key === 'k') return 'deleteLine';
  if (event.altKey && !mod && event.key === 'ArrowUp') return 'moveUp';
  if (event.altKey && !mod && event.key === 'ArrowDown') return 'moveDown';
  return null;
}

export function findMatch(
  script: string,
  query: string,
  from: number,
  backward: boolean,
  sensitive: boolean,
): { start: number; end: number } | null {
  if (!query) return null;
  const hay = sensitive ? script : script.toLowerCase();
  const needle = sensitive ? query : query.toLowerCase();
  if (backward) {
    const index = hay.lastIndexOf(needle, Math.max(0, from - 1));
    const found = index >= 0 ? index : hay.lastIndexOf(needle);
    if (found < 0) return null;
    return { start: found, end: found + needle.length };
  }
  let index = hay.indexOf(needle, Math.max(0, from));
  if (index < 0) index = hay.indexOf(needle);
  if (index < 0) return null;
  return { start: index, end: index + needle.length };
}

export function replaceOnce(
  script: string,
  query: string,
  replacement: string,
  selectionStart: number,
  selectionEnd: number,
  sensitive: boolean,
): ScriptEdit | null {
  if (!query) return null;
  const selected = script.slice(selectionStart, selectionEnd);
  const selectedMatches = sensitive ? selected === query : selected.toLowerCase() === query.toLowerCase();
  if (selectedMatches) {
    const next = script.slice(0, selectionStart) + replacement + script.slice(selectionEnd);
    return { script: next, selectionStart, selectionEnd: selectionStart + replacement.length };
  }
  const found = findMatch(script, query, selectionEnd, false, sensitive);
  if (!found) return null;
  const next = script.slice(0, found.start) + replacement + script.slice(found.end);
  return { script: next, selectionStart: found.start, selectionEnd: found.start + replacement.length };
}

export function replaceAll(script: string, query: string, replacement: string, sensitive: boolean): string {
  if (!query) return script;
  const flags = sensitive ? 'g' : 'gi';
  return script.replace(new RegExp(escapeRegExp(query), flags), replacement);
}

export function offsetOfLine(script: string, line: number): { start: number; end: number } {
  const lines = script.split('\n');
  const index = Math.max(0, Math.min(lines.length - 1, line - 1));
  let start = 0;
  for (let i = 0; i < index; i++) start += lines[i].length + 1;
  return { start, end: start + lines[index].length };
}

export function duplicateLines(script: string, selectionStart: number, selectionEnd: number): ScriptEdit {
  const range = lineRange(script, selectionStart, selectionEnd);
  const block = script.slice(range.from, range.to);
  const next = `${script.slice(0, range.to)}\n${block}${script.slice(range.to)}`;
  const start = range.to + 1;
  return { script: next, selectionStart: start, selectionEnd: start + block.length };
}

export function toggleComment(script: string, selectionStart: number, selectionEnd: number): ScriptEdit {
  const range = lineRange(script, selectionStart, selectionEnd);
  const lines = script.slice(range.from, range.to).split('\n');
  const commented = lines.every((line) => line.trim() === '' || /^\s*\/\//.test(line));
  const nextLines = lines.map((line) => {
    if (!line.trim()) return line;
    if (commented) return line.replace(/^(\s*)\/\/\s?/, '$1');
    return `// ${line}`;
  });
  const block = nextLines.join('\n');
  return {
    script: script.slice(0, range.from) + block + script.slice(range.to),
    selectionStart: range.from,
    selectionEnd: range.from + block.length,
  };
}

export function deleteLines(script: string, selectionStart: number, selectionEnd: number): ScriptEdit {
  const range = lineRange(script, selectionStart, selectionEnd);
  let from = range.from;
  let to = range.to;
  if (script[to] === '\n') to += 1;
  else if (from > 0 && script[from - 1] === '\n') from -= 1;
  const next = script.slice(0, from) + script.slice(to);
  return { script: next, selectionStart: from, selectionEnd: from };
}

export function moveLines(script: string, selectionStart: number, selectionEnd: number, direction: -1 | 1): ScriptEdit {
  const range = lineRange(script, selectionStart, selectionEnd);
  const block = script.slice(range.from, range.to);
  if (direction < 0) {
    if (range.from === 0) return { script, selectionStart, selectionEnd };
    const prevFrom = script.lastIndexOf('\n', range.from - 2) + 1;
    const prev = script.slice(prevFrom, range.from - 1);
    const next = `${script.slice(0, prevFrom)}${block}\n${prev}${script.slice(range.to)}`;
    return { script: next, selectionStart: prevFrom, selectionEnd: prevFrom + block.length };
  }
  const after = script[range.to] === '\n' ? range.to + 1 : -1;
  if (after < 0) return { script, selectionStart, selectionEnd };
  const nextBreak = script.indexOf('\n', after);
  const nextTo = nextBreak < 0 ? script.length : nextBreak;
  const following = script.slice(after, nextTo);
  const next = `${script.slice(0, range.from)}${following}\n${block}${script.slice(nextTo)}`;
  const start = range.from + following.length + 1;
  return { script: next, selectionStart: start, selectionEnd: start + block.length };
}

function lineRange(script: string, selectionStart: number, selectionEnd: number): { from: number; to: number } {
  const start = Math.max(0, Math.min(selectionStart, selectionEnd));
  let end = Math.max(selectionStart, selectionEnd);
  if (end > start && script[end - 1] === '\n') end -= 1;
  const from = script.lastIndexOf('\n', start - 1) + 1;
  const breakAt = script.indexOf('\n', end);
  const to = breakAt < 0 ? script.length : breakAt;
  return { from, to };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
