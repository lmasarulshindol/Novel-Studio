import { describe, expect, it } from 'vitest';
import { loadUnlocks, rememberUnlock, type UnlockStore } from '../src/core/unlocks';

function store(): UnlockStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('回想とサウンドの開放', () => {
  it('一度記録した CG と BGM を保ち、同じ ID は増やさない', () => {
    const memory = store();
    rememberUnlock('見本', 'bgm', 'day', memory);
    rememberUnlock('見本', 'bgm', 'day', memory);
    rememberUnlock('見本', 'cg', 'sunset', memory);
    expect(loadUnlocks('見本', memory)).toEqual({ bgm: ['day'], cg: ['sunset'] });
    expect(loadUnlocks('別作品', memory)).toEqual({ bgm: [], cg: [] });
  });

  it('壊れた記録は空として読む', () => {
    const memory = store();
    memory.setItem('novel-studio-unlock:見本', '{');
    expect(loadUnlocks('見本', memory)).toEqual({ bgm: [], cg: [] });
  });
});
