import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScenario } from '../src/core/scenario/parser';
import { ScriptRunner } from '../src/core/scenario/runner';

const ROOT = resolve(__dirname, '../projects/yonetsu');
const script = readFileSync(resolve(ROOT, 'script.txt'), 'utf8');

describe('余熱 script', () => {
  it('パースエラーが無い', () => {
    const program = parseScenario(script);
    expect(program.errors).toEqual([]);
  });

  it('抜き特化ラベルが揃っている', () => {
    const program = parseScenario(script);
    for (const label of [
      'start',
      'route_mio',
      'h_mio_direct',
      'h_mio',
      'end_mio',
      'route_seira',
      'h_seira_direct',
      'h_seira',
      'end_seira',
      'fin',
    ]) {
      expect(program.labels[label], label).toBeTypeOf('number');
    }
  });

  it('いきなりHラベルから開始できる', () => {
    const program = parseScenario(script);
    const runner = new ScriptRunner(program);
    runner.jumpToLabel('h_mio_direct');
    const first = runner.next();
    expect(first).toBeTruthy();
  });

  it('年齢コメントが成人を明示している', () => {
    expect(script).toMatch(/22/);
    expect(script).toMatch(/24/);
    expect(script).toMatch(/成人/);
    expect(script).toMatch(/未成年.*(ない|ありません|禁止)|すべて成人/);
    expect(script).toMatch(/水着/);
  });
});
