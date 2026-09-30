import { describe, expect, it } from 'vitest';
import { parseScenario } from '../src/core/scenario/parser';
import { ScriptRunner } from '../src/core/scenario/runner';

const SAMPLE = `# start
bg classroom day with fade duration=0.6
show mitsuki smile at center with bounceIn duration=0.4
play bgm daily loop
「美月」 おはよう。
choice
  「一緒に行く」 -> together
  「今日は一人で」 -> alone
# together
camera shake amount=8 duration=0.3
「美月」 こっちだよ。
# alone
「美月」 わかった。
`;

function until(runner: ScriptRunner, type: string) {
  for (let i = 0; i < 30; i++) {
    const step = runner.next();
    if (step.type === type || step.type === 'end') return step;
  }
  throw new Error('halt しません');
}

describe('シナリオ実行', () => {
  it('選択肢で together に飛ぶ', () => {
    const runner = new ScriptRunner(parseScenario(SAMPLE));
    const first = until(runner, 'dialogue');
    expect(first).toMatchObject({ type: 'dialogue', text: 'おはよう。' });
    const choice = until(runner, 'choice');
    expect(choice.type).toBe('choice');
    runner.choose(0);
    const next = runner.next();
    expect(next).toMatchObject({ type: 'batch' });
    if (next.type === 'batch') expect(next.commands[0].type).toBe('camera');
    const line = runner.next();
    expect(line).toMatchObject({ type: 'dialogue', text: 'こっちだよ。' });
  });

  it('if の真偽で分岐する', () => {
    const source = [
      'set met true',
      'set affection 2',
      'if met -> yes',
      '「無」 ここには来ない',
      '# yes',
      'if affection >= 2 -> high',
      '「無」 低い',
      '# high',
      '「美月」 高い',
      'if affection < 1 -> no',
      '「美月」 続報',
      'jump done',
      '# no',
      '「無」 来ない',
      '# done',
    ].join('\n');
    const runner = new ScriptRunner(parseScenario(source));
    expect(runner.next()).toMatchObject({ type: 'dialogue', text: '高い' });
    expect(runner.next()).toMatchObject({ type: 'dialogue', text: '続報' });
    expect(runner.next()).toMatchObject({ type: 'end' });

    const missed = new ScriptRunner(parseScenario('set met false\nif met -> yes\n「美月」 フォールスルー\n# yes\n「美月」 スキップされる\n'));
    expect(missed.next()).toMatchObject({ text: 'フォールスルー' });
  });

  it('jump と状態の復元', () => {
    const program = parseScenario('jump landing\n「美月」 飛ばされる\n# landing\n「美月」 着地\n「美月」 その次\n');
    const runner = new ScriptRunner(program);
    expect(runner.next()).toMatchObject({ text: '着地' });
    const saved = runner.exportState();
    const restored = new ScriptRunner(program, saved);
    expect(restored.next()).toMatchObject({ text: 'その次' });
  });

  it('未知ラベルは例外', () => {
    const runner = new ScriptRunner(parseScenario('jump missing\n'));
    expect(() => runner.next()).toThrow(/未知のラベル/);
  });

  it('並列行は1バッチ', () => {
    const runner = new ScriptRunner(parseScenario('show a smile at left + show b smile at right\n「美月」 同時\n'));
    const batch = runner.next();
    expect(batch.type).toBe('batch');
    if (batch.type === 'batch') expect(batch.commands).toHaveLength(2);
  });
});
