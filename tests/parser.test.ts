import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseScenario, updateLineParam } from '../src/core/scenario/parser';

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
`;

describe('シナリオパーサ', () => {
  it('見本のコマンド列', () => {
    const program = parseScenario(SAMPLE);
    expect(program.errors).toEqual([]);
    expect(program.labels.start).toBe(0);
    expect(program.labels.together).toBeGreaterThan(0);
    const bg = program.commands.find((command) => command.type === 'bg');
    expect(bg).toMatchObject({ id: 'classroom', variant: 'day', effect: { preset: 'fade', params: { duration: 0.6 } } });
    const show = program.commands.find((command) => command.type === 'show');
    expect(show).toMatchObject({ character: 'mitsuki', expr: 'smile', at: 'center', effect: { preset: 'bounceIn' } });
    const play = program.commands.find((command) => command.type === 'play');
    expect(play).toMatchObject({ channel: 'bgm', id: 'daily', loop: true, fade: 0 });
    const choice = program.commands.find((command) => command.type === 'choice');
    expect(choice).toMatchObject({
      options: [
        { text: '一緒に行く', target: 'together' },
        { text: '今日は一人で', target: 'alone' },
      ],
    });
  });

  it('並列と then', () => {
    const program = parseScenario('show a smile at left with fadeIn duration=0.2 + show b smile at right with fadeIn duration=0.2\nthen show c smile at center\n');
    expect(program.errors).toEqual([]);
    const shows = program.commands.filter((command) => command.type === 'show');
    expect(shows).toHaveLength(3);
    expect(shows[0]).toMatchObject({ parallelNext: true, character: 'a' });
    expect(shows[1]).toMatchObject({ parallelNext: false, character: 'b' });
    expect(shows[2]).toMatchObject({ parallelNext: false, character: 'c' });
  });

  it('if と set', () => {
    const program = parseScenario('set met true\nset affection 2\nif met -> yes\nif affection >= 2 -> high\n');
    expect(program.errors).toEqual([]);
    expect(program.commands.find((command) => command.type === 'set' && command.name === 'met')).toMatchObject({ value: true });
    expect(program.commands.find((command) => command.type === 'if' && command.name === 'affection')).toMatchObject({ op: '>=', value: 2, target: 'high' });
  });

  it('未知コマンドと空の選択肢はエラー', () => {
    const program = parseScenario('frobnicate\nchoice\n');
    expect(program.errors.length).toBeGreaterThanOrEqual(2);
    expect(program.commands.some((command) => command.type === 'choice')).toBe(true);
  });

  it('BGM のフェード秒と SE の停止フェードを読む', () => {
    const program = parseScenario('play bgm day loop fade=1.2\nplay se shake\nstop bgm fade=0.8\n');
    expect(program.errors).toEqual([]);
    expect(program.commands.find((command) => command.type === 'play' && command.channel === 'bgm')).toMatchObject({ id: 'day', loop: true, fade: 1.2 });
    expect(program.commands.find((command) => command.type === 'play' && command.channel === 'se')).toMatchObject({ id: 'shake', loop: false, fade: 0 });
    expect(program.commands.find((command) => command.type === 'stop')).toMatchObject({ channel: 'bgm', fade: 0.8 });
  });

  it('行パラメータを書き換える', () => {
    const next = updateLineParam('show mitsuki smile at center with bounceIn duration=0.4', 1, 'duration', '0.8');
    expect(next).toContain('duration=0.8');
    expect(next).not.toContain('duration=0.4');
    const added = updateLineParam('fx mitsuki spin', 1, 'easing', 'bounceOut');
    expect(added).toContain('easing=bounceOut');
  });

  it('配布見本シナリオがパースできる', () => {
    const script = fs.readFileSync('projects/sample/script.txt', 'utf8');
    const program = parseScenario(script);
    expect(program.errors).toEqual([]);
    expect(program.labels.start).toBeTypeOf('number');
    expect(program.labels.menu).toBeTypeOf('number');
    expect(program.labels.enter).toBeTypeOf('number');
    expect(program.labels.backgrounds).toBeTypeOf('number');
    expect(program.labels.cameras).toBeTypeOf('number');
    expect(program.labels.look).toBeTypeOf('number');
    expect(program.labels.extras).toBeTypeOf('number');
    expect(program.labels.ending).toBeTypeOf('number');
  });
});
