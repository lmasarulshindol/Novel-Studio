import type { Command, EffectSpec, Program, Value } from './types';

export type RunnerState = {
  index: number;
  vars: Record<string, Value>;
  choiceLock: boolean;
};

export type Halt =
  | { type: 'batch'; commands: Command[]; line: number }
  | { type: 'dialogue'; speaker: string; text: string; effect?: EffectSpec; index: number; line: number }
  | { type: 'choice'; options: { text: string; target: string }[]; index: number; line: number }
  | { type: 'end' };

type DialogueHalt = Extract<Halt, { type: 'dialogue' }>;
type ChoiceHalt = Extract<Halt, { type: 'choice' }>;

function truthy(value: Value | undefined): boolean {
  return !(value === undefined || value === false || value === 0 || value === '');
}

function same(left: Value | undefined, right: Value | undefined): boolean {
  return left === right || String(left) === String(right);
}

function asNumber(value: Value | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  return Number.NaN;
}

export class ScriptRunner {
  private index: number;
  private vars: Record<string, Value>;
  private choiceLock: boolean;
  private currentChoice?: ChoiceHalt;
  readonly errors: string[] = [];

  constructor(private readonly program: Program, state?: Partial<RunnerState>) {
    this.index = state?.index ?? 0;
    this.vars = { ...(state?.vars ?? {}) };
    this.choiceLock = state?.choiceLock ?? false;
    if (this.choiceLock) {
      const command = program.commands[this.index];
      if (command?.type === 'choice') {
        this.currentChoice = { type: 'choice', options: command.options, index: this.index, line: command.line };
      } else {
        this.choiceLock = false;
      }
    }
  }

  exportState(): RunnerState {
    return { index: this.index, vars: { ...this.vars }, choiceLock: this.choiceLock };
  }

  get variables(): Record<string, Value> {
    return { ...this.vars };
  }

  next(): Halt {
    if (this.choiceLock && this.currentChoice) return this.currentChoice;
    let guard = 0;
    const limit = Math.max(64, this.program.commands.length * 8);
    while (this.index < this.program.commands.length) {
      if (++guard > limit) {
        this.errors.push('シナリオが停止しません');
        return { type: 'end' };
      }
      const command = this.program.commands[this.index];
      if (command.type === 'label') {
        this.index += 1;
        continue;
      }
      if (command.type === 'set') {
        this.vars[command.name] = command.value;
        this.index += 1;
        continue;
      }
      if (command.type === 'jump') {
        this.go(command.target);
        continue;
      }
      if (command.type === 'if') {
        if (this.evalIf(command)) this.go(command.target);
        else this.index += 1;
        continue;
      }
      if (command.type === 'choice') {
        this.choiceLock = true;
        this.currentChoice = { type: 'choice', options: command.options, index: this.index, line: command.line };
        return this.currentChoice;
      }
      if (command.type === 'dialogue') {
        const halt: DialogueHalt = {
          type: 'dialogue',
          speaker: command.speaker,
          text: command.text,
          effect: command.effect,
          index: this.index,
          line: command.line,
        };
        this.index += 1;
        return halt;
      }
      const batch: Command[] = [command];
      this.index += 1;
      let cursor = command;
      while (cursor.parallelNext && this.index < this.program.commands.length) {
        const next = this.program.commands[this.index];
        if (next.type === 'label' || next.type === 'choice' || next.type === 'dialogue' || next.type === 'if' || next.type === 'set' || next.type === 'jump') break;
        batch.push(next);
        this.index += 1;
        cursor = next;
        if (!next.parallelNext) break;
      }
      return { type: 'batch', commands: batch, line: batch[0].line };
    }
    return { type: 'end' };
  }

  choose(optionIndex: number): void {
    if (!this.currentChoice) throw new Error('選択肢待ちではありません');
    const option = this.currentChoice.options[optionIndex];
    if (!option) throw new Error('選択肢番号が範囲外です');
    this.choiceLock = false;
    this.currentChoice = undefined;
    this.go(option.target);
  }

  private go(label: string): void {
    const dest = this.program.labels[label];
    if (dest === undefined) throw new Error(`未知のラベル: ${label}`);
    this.index = dest;
  }

  private evalIf(command: Extract<Command, { type: 'if' }>): boolean {
    const left = this.vars[command.name];
    if (!command.op) return truthy(left);
    const right = command.value;
    switch (command.op) {
      case '==': return same(left, right);
      case '!=': return !same(left, right);
      case '>': return asNumber(left) > asNumber(right);
      case '>=': return asNumber(left) >= asNumber(right);
      case '<': return asNumber(left) < asNumber(right);
      case '<=': return asNumber(left) <= asNumber(right);
      default: return false;
    }
  }
}
