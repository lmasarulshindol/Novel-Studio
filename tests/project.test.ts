import { describe, expect, it } from 'vitest';
import { normalizeProject, resolveRoutePortrait } from '../src/core/project/project';

describe('プロジェクト正規化', () => {
  it('routes を通す（不完全行は除外）', () => {
    const project = normalizeProject({
      name: '余熱',
      routes: [
        {
          id: 'a',
          label: '美咲',
          age: 28,
          blurb: '落ち着いた大人の女性。',
          startLabel: 'misaki_start',
          hLabel: 'misaki_h',
          portrait: 'misaki/normal',
        },
        { id: 'bad', label: '', startLabel: 'x', hLabel: 'y' },
        null,
      ],
    });
    expect(project.routes).toHaveLength(1);
    expect(project.routes?.[0]).toMatchObject({
      id: 'a',
      label: '美咲',
      age: 28,
      startLabel: 'misaki_start',
      hLabel: 'misaki_h',
      portrait: 'misaki/normal',
    });
  });

  it('routes が空ならフィールドを付けない', () => {
    const project = normalizeProject({ name: '無題', routes: [] });
    expect(project.routes).toBeUndefined();
  });

  it('portrait を UI / キャラ表情から解決する', () => {
    const project = normalizeProject({
      name: 'test',
      assets: {
        backgrounds: [],
        characters: [{
          id: 'misaki',
          name: '美咲',
          expressions: [{ id: 'normal', src: 'chars/misaki_normal.png' }],
        }],
        bgm: [],
        se: [],
        voice: [],
        cgs: [],
        ui: [{ id: 'thumb', src: 'ui/thumb.png' }],
        shaders: [],
      },
    });
    expect(resolveRoutePortrait(project, 'thumb')).toContain('ui/thumb.png');
    expect(resolveRoutePortrait(project, 'misaki/normal')).toContain('misaki_normal.png');
    expect(resolveRoutePortrait(project, 'missing')).toBeUndefined();
  });
});
