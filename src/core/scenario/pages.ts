import { parseScenario } from './parser';
import type { Command } from './types';

export type PageLayers = {
  text: boolean;
  image: boolean;
  audio: boolean;
};

export type ScenarioPage = {
  index: number;
  startLine: number;
  endLine: number;
  speaker: string;
  text: string;
  layers: PageLayers;
  /** // @page が付いているページだけ、再生時にレイヤーを省略できる。 */
  explicit: boolean;
  commandIndexes: number[];
};

const PICTURE = new Set<Command['type']>(['bg', 'show', 'hide', 'place', 'expr', 'cg']);

export function commandLayer(command: Command): 'image' | 'audio' | 'text' | 'flow' {
  if (command.type === 'dialogue') return 'text';
  if (command.type === 'bg' || command.type === 'show' || command.type === 'hide' || command.type === 'place' || command.type === 'expr' || command.type === 'cg' || command.type === 'fx' || command.type === 'camera' || command.type === 'transition' || command.type === 'particle') {
    return 'image';
  }
  if (command.type === 'play' || command.type === 'stop') return 'audio';
  return 'flow';
}

export function commandAllowed(page: ScenarioPage | undefined, command: Command): boolean {
  if (!page?.explicit) return true;
  const layer = commandLayer(command);
  if (layer === 'image') return page.layers.image;
  if (layer === 'audio') return page.layers.audio;
  if (layer === 'text') return page.layers.text;
  return true;
}

export function scenarioPages(script: string): ScenarioPage[] {
  const program = parseScenario(script);
  const lines = script.replace(/^\uFEFF/, '').split(/\r?\n/);
  const pages: ScenarioPage[] = [];
  let bucket: number[] = [];

  const push = (indexes: number[], speaker: string, text: string, forceText: boolean) => {
    if (!indexes.length) return;
    const end = program.commands[indexes[indexes.length - 1]];
    const inferred = inferLayers(program.commands, indexes);
    if (forceText || text) inferred.text = true;
    const marked = readPageMark(lines[end.line - 1] ?? '');
    pages.push({
      index: pages.length,
      startLine: program.commands[indexes[0]].line,
      endLine: end.line,
      speaker,
      text,
      layers: marked ? marked : inferred,
      explicit: Boolean(marked),
      commandIndexes: indexes,
    });
  };

  program.commands.forEach((command, index) => {
    if (command.type === 'dialogue') {
      push([...bucket, index], command.speaker, command.text, true);
      bucket = [];
      return;
    }
    if (command.type === 'choice') {
      push([...bucket, index], '', command.options.map((option) => option.text).join(' / '), true);
      bucket = [];
      return;
    }
    bucket.push(index);
  });

  if (bucket.length) {
    const onlyFlow = bucket.every((index) => commandLayer(program.commands[index]) === 'flow');
    if (onlyFlow && pages.length) pages[pages.length - 1].commandIndexes.push(...bucket);
    else push(bucket, '', '', false);
  }
  return pages;
}

export function setPageLayers(script: string, endLine: number, layers: PageLayers): string {
  const newline = script.includes('\r\n') ? '\r\n' : '\n';
  const lines = script.split(/\r?\n/);
  const index = endLine - 1;
  if (index < 0 || index >= lines.length) return script;
  const flags = (['text', 'image', 'audio'] as const).filter((key) => layers[key]).join(' ');
  const base = lines[index].replace(/\s*\/\/\s*@page\b.*$/, '').replace(/\s+$/, '');
  lines[index] = `${base} // @page ${flags}`.trimEnd();
  return lines.join(newline);
}

export function writeAt(line: string, x: number, y: number): string {
  const at = `at ${Math.round(x)},${Math.round(y)}`;
  if (/\sat\s+\S+/.test(line)) return line.replace(/\sat\s+\S+/, ` ${at}`);
  const withAt = line.indexOf(' with ');
  if (withAt >= 0) return `${line.slice(0, withAt)} ${at}${line.slice(withAt)}`;
  return `${line.replace(/\s+$/, '')} ${at}`;
}

/** このページの show / place を動かす。無ければ place 行をセリフの前に足す。 */
export function placeCharacterOnPage(script: string, page: ScenarioPage, characterId: string, x: number, y: number): { script: string; endLine: number } {
  const program = parseScenario(script);
  const newline = script.includes('\r\n') ? '\r\n' : '\n';
  for (const index of [...page.commandIndexes].reverse()) {
    const command = program.commands[index];
    if ((command?.type === 'place' || command?.type === 'show') && command.character === characterId) {
      const lines = script.split(/\r?\n/);
      lines[command.line - 1] = writeAt(lines[command.line - 1] ?? '', x, y);
      return { script: lines.join(newline), endLine: page.endLine };
    }
  }
  return {
    script: insertLineBefore(script, page.endLine, `place ${characterId} at ${Math.round(x)},${Math.round(y)}`),
    endLine: page.endLine + 1,
  };
}

export function insertLineBefore(script: string, lineNo: number, text: string): string {
  const newline = script.includes('\r\n') ? '\r\n' : '\n';
  const lines = script.split(/\r?\n/);
  lines.splice(Math.max(0, lineNo - 1), 0, text);
  return lines.join(newline);
}

export function pageLayerLabel(layers: PageLayers): string {
  const parts = [
    layers.text ? 'テキスト' : '',
    layers.image ? '画像' : '',
    layers.audio ? '音声' : '',
  ].filter(Boolean);
  if (parts.length === 1 && layers.text) return 'テキストだけ';
  if (!parts.length) return '変化なし';
  return parts.join('と');
}

/** 編集モードでそのページまで進んだときの絵と、そのページの効果音。 */
export function commandsForEditPage(script: string, pageIndex: number): Command[] {
  const program = parseScenario(script);
  const pages = scenarioPages(script);
  const visuals: Command[] = [];
  const currentAudio: Command[] = [];
  let bgm: Command | undefined;
  const last = Math.max(0, Math.min(pageIndex, pages.length - 1));
  for (let i = 0; i <= last && i < pages.length; i++) {
    const page = pages[i];
    for (const index of page.commandIndexes) {
      const command = program.commands[index];
      if (!commandAllowed(page, command)) continue;
      const layer = commandLayer(command);
      if (layer === 'image' && PICTURE.has(command.type)) visuals.push(instantCommand(command));
      if (layer !== 'audio') continue;
      if (command.type === 'play' && command.channel === 'bgm') {
        bgm = instantCommand(command);
        continue;
      }
      if (command.type === 'stop' && command.channel === 'bgm') {
        bgm = undefined;
        continue;
      }
      if (i === last) currentAudio.push(instantCommand(command));
    }
  }
  return [...visuals, ...(bgm ? [bgm] : []), ...currentAudio];
}

export function visiblePageText(pages: ScenarioPage[], pageIndex: number): { speaker: string; text: string } {
  for (let i = Math.min(pageIndex, pages.length - 1); i >= 0; i--) {
    const page = pages[i];
    if (page.layers.text && page.text) return { speaker: page.speaker, text: page.text };
  }
  return { speaker: '', text: '' };
}

function inferLayers(commands: Command[], indexes: number[]): PageLayers {
  const layers: PageLayers = { text: false, image: false, audio: false };
  for (const index of indexes) {
    const layer = commandLayer(commands[index]);
    if (layer === 'image') layers.image = true;
    if (layer === 'audio') layers.audio = true;
    if (layer === 'text') layers.text = true;
  }
  return layers;
}

function readPageMark(rawLine: string): PageLayers | null {
  const matched = rawLine.match(/\/\/\s*@page\b(.*)$/);
  if (!matched) return null;
  const body = matched[1] ?? '';
  return {
    text: /\btext\b/.test(body),
    image: /\bimage\b/.test(body),
    audio: /\baudio\b/.test(body),
  };
}

function instantCommand(command: Command): Command {
  if (command.type === 'play' || command.type === 'stop') return { ...command, fade: 0 };
  if (command.type === 'bg' || command.type === 'show' || command.type === 'hide' || command.type === 'expr' || command.type === 'cg') {
    return { ...command, effect: undefined };
  }
  return command;
}
