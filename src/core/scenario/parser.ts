import { getPreset, resolvePreset } from '../effects/catalog';
import {
  coerceParam,
  type ChoiceOption,
  type Command,
  type EffectSpec,
  type ParamValue,
  type Program,
} from './types';

const COMMAND_NAMES = new Set([
  'bg', 'show', 'hide', 'expr', 'cg', 'fx', 'camera', 'transition', 'particle',
  'play', 'stop', 'wait', 'choice', 'jump', 'set', 'if', 'narration',
]);

function stripComment(line: string): string {
  let quote = false;
  let out = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '「') quote = true;
    else if (ch === '」') quote = false;
    if (!quote && ch === '/' && line[i + 1] === '/') break;
    out += ch;
  }
  return out.replace(/\u3000/g, ' ').trim();
}

function tokenize(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

function parseParams(tokens: string[]): Record<string, ParamValue> {
  const params: Record<string, ParamValue> = {};
  for (const token of tokens) {
    const eq = token.indexOf('=');
    if (eq > 0) params[token.slice(0, eq)] = coerceParam(token.slice(eq + 1));
    else params[token] = true;
  }
  return params;
}

function splitWith(tokens: string[]): { head: string[]; effect?: EffectSpec } {
  const index = tokens.indexOf('with');
  if (index < 0) return { head: tokens };
  const preset = tokens[index + 1];
  if (!preset) return { head: tokens.slice(0, index) };
  return {
    head: tokens.slice(0, index),
    effect: { preset, params: parseParams(tokens.slice(index + 2)) },
  };
}

function knownPreset(name: string): boolean {
  return Boolean(getPreset(name) || getPreset(resolvePreset(name, 'fx')) || name === 'stop' || name === 'fade' || name === 'shake');
}

function takeDialogueEffect(text: string): { text: string; effect?: EffectSpec } {
  const mark = ' with ';
  const index = text.lastIndexOf(mark);
  if (index < 0) return { text };
  const tokens = tokenize(text.slice(index + mark.length));
  if (!tokens.length || !knownPreset(tokens[0])) return { text };
  return {
    text: text.slice(0, index).trim(),
    effect: { preset: tokens[0], params: parseParams(tokens.slice(1)) },
  };
}

function isOption(line: string): boolean {
  if (!line.includes('->') && !line.includes('→')) return false;
  const name = line.split(/\s+/)[0];
  return !COMMAND_NAMES.has(name);
}

function parseOption(line: string): ChoiceOption | null {
  const normalized = line.replace('→', '->');
  const matched = normalized.match(/^(?:「([^」]+)」|"([^"]+)"|(.+?))\s*->\s*(\S+)\s*$/);
  if (!matched) return null;
  return { text: (matched[1] || matched[2] || matched[3] || '').trim(), target: matched[4] };
}

function asChannel(token: string | undefined): 'bgm' | 'se' | 'voice' | null {
  if (token === 'bgm' || token === 'se' || token === 'voice') return token;
  return null;
}

function effectFromHead(head: string[], fallback: string): EffectSpec {
  return { preset: head[1] || fallback, params: parseParams(head.slice(2)) };
}

function parsePiece(
  body: string,
  line: number,
  source: string,
  parallelNext: boolean,
  errors: Program['errors'],
): Command | null {
  const base = { line, source, parallelNext };
  if (body.startsWith('「') && !body.includes('->') && !body.includes('→')) {
    const matched = body.match(/^「([^」]*)」(.*)$/);
    if (matched) {
      const spoken = takeDialogueEffect(matched[2].trim());
      return { ...base, type: 'dialogue', speaker: matched[1], text: spoken.text, effect: spoken.effect };
    }
  }
  if (body.startsWith('>')) {
    const spoken = takeDialogueEffect(body.slice(1).trim());
    return { ...base, type: 'dialogue', speaker: '', text: spoken.text, effect: spoken.effect };
  }

  const tokens = tokenize(body);
  const name = tokens[0];
  if (!name || !COMMAND_NAMES.has(name)) {
    errors.push({ line, message: `未知のコマンド: ${name ?? body}` });
    return null;
  }
  const { head, effect } = splitWith(tokens);

  if (name === 'bg') {
    return { ...base, type: 'bg', id: head[1] ?? '', variant: head[2], effect };
  }
  if (name === 'show') {
    const atIndex = head.indexOf('at');
    const at = atIndex >= 0 ? head[atIndex + 1] ?? 'center' : 'center';
    return {
      ...base,
      type: 'show',
      character: head[1] ?? '',
      expr: head[2] && head[2] !== 'at' ? head[2] : 'default',
      at,
      effect,
    };
  }
  if (name === 'hide') return { ...base, type: 'hide', character: head[1] ?? '', effect };
  if (name === 'expr') return { ...base, type: 'expr', character: head[1] ?? '', expr: head[2] ?? 'default', effect };
  if (name === 'cg') return { ...base, type: 'cg', id: head[1] ?? 'off', effect };
  if (name === 'fx') {
    const fxEffect = effect ?? { preset: head[2] ?? 'fadeIn', params: parseParams(head.slice(3)) };
    return { ...base, type: 'fx', target: head[1] ?? 'screen', effect: fxEffect };
  }
  if (name === 'camera') return { ...base, type: 'camera', effect: effect ?? effectFromHead(head, 'camShake') };
  if (name === 'transition') return { ...base, type: 'transition', effect: effect ?? effectFromHead(head, 'fade') };
  if (name === 'particle') return { ...base, type: 'particle', effect: effect ?? effectFromHead(head, 'stop') };
  if (name === 'play') {
    const channel = asChannel(head[1]);
    if (!channel) {
      errors.push({ line, message: 'play の種類は bgm / se / voice です' });
      return null;
    }
    const params = parseParams(head.slice(3));
    const fade = typeof params.fade === 'number' ? params.fade : 0;
    return { ...base, type: 'play', channel, id: head[2] ?? '', loop: head.includes('loop') || params.loop === true, fade };
  }
  if (name === 'stop') {
    const channel = asChannel(head[1]);
    if (!channel) {
      errors.push({ line, message: 'stop の種類は bgm / se / voice です' });
      return null;
    }
    const params = parseParams(head.slice(2));
    const fade = typeof params.fade === 'number' ? params.fade : 0;
    return { ...base, type: 'stop', channel, fade };
  }
  if (name === 'wait') {
    const params = parseParams(head.slice(1));
    const inline = head[1] !== undefined ? coerceParam(head[1]) : 1;
    const duration = typeof params.duration === 'number' ? params.duration : typeof inline === 'number' ? inline : 1;
    return { ...base, type: 'wait', duration };
  }
  if (name === 'jump') return { ...base, type: 'jump', target: head[1] ?? '' };
  if (name === 'set') {
    if (head[1]?.includes('=')) {
      const [key, ...rest] = head[1].split('=');
      return { ...base, type: 'set', name: key, value: coerceParam(rest.join('=')) };
    }
    return { ...base, type: 'set', name: head[1] ?? '', value: coerceParam(head.slice(2).join(' ')) };
  }
  if (name === 'if') {
    const arrow = head.indexOf('->');
    const alt = head.indexOf('→');
    const at = arrow >= 0 ? arrow : alt;
    if (at < 0 || !head[at + 1]) {
      errors.push({ line, message: 'if には -> ラベル が必要です' });
      return null;
    }
    const expr = head.slice(1, at);
    if (expr.length === 1) return { ...base, type: 'if', name: expr[0], target: head[at + 1] };
    if (expr.length >= 3) {
      return { ...base, type: 'if', name: expr[0], op: expr[1], value: coerceParam(expr.slice(2).join(' ')), target: head[at + 1] };
    }
    errors.push({ line, message: 'if の条件を読めません' });
    return null;
  }
  if (name === 'narration') {
    const spoken = takeDialogueEffect(head.slice(1).join(' '));
    return { ...base, type: 'dialogue', speaker: '', text: spoken.text, effect: spoken.effect };
  }
  return null;
}

export function parseScenario(source: string): Program {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  const commands: Command[] = [];
  const errors: Program['errors'] = [];
  let i = 0;
  while (i < lines.length) {
    const lineNo = i + 1;
    const stripped = stripComment(lines[i] ?? '');
    i += 1;
    if (!stripped) continue;
    if (stripped.startsWith('#')) {
      const name = stripped.slice(1).trim().split(/\s+/)[0] ?? '';
      if (!name) errors.push({ line: lineNo, message: 'ラベル名がありません' });
      else commands.push({ type: 'label', name, line: lineNo, source: stripped, parallelNext: false });
      continue;
    }
    if (stripped === 'choice') {
      const options: ChoiceOption[] = [];
      while (i < lines.length) {
        const optRaw = stripComment(lines[i] ?? '');
        if (!optRaw || !isOption(optRaw)) break;
        const option = parseOption(optRaw);
        if (option) options.push(option);
        else errors.push({ line: i + 1, message: '選択肢を読めません' });
        i += 1;
      }
      if (!options.length) errors.push({ line: lineNo, message: '選択肢がありません' });
      commands.push({ type: 'choice', options, line: lineNo, source: stripped, parallelNext: false });
      continue;
    }
    const pieces = stripped.split(' + ').map((piece) => piece.trim()).filter(Boolean);
    pieces.forEach((piece, index) => {
      const body = piece.startsWith('then ') ? piece.slice(5).trim() : piece;
      const command = parsePiece(body, lineNo, stripped, index < pieces.length - 1, errors);
      if (command) commands.push(command);
    });
  }
  const labels: Record<string, number> = {};
  commands.forEach((command, index) => {
    if (command.type !== 'label') return;
    if (labels[command.name] !== undefined) errors.push({ line: command.line, message: `ラベルが重複しています: ${command.name}` });
    else labels[command.name] = index;
  });
  return { commands, labels, errors };
}

export function updateLineParam(script: string, lineNo: number, key: string, value: string): string {
  const lines = script.split(/\r?\n/);
  const index = lineNo - 1;
  if (index < 0 || index >= lines.length) return script;
  const pattern = new RegExp(`(^|\\s)${key}=\\S+`);
  if (pattern.test(lines[index])) lines[index] = lines[index].replace(pattern, `$1${key}=${value}`);
  else lines[index] = `${lines[index]} ${key}=${value}`;
  return lines.join('\n');
}
