import { describe, expect, it } from 'vitest';
import { clientToStage, containSize, coverScale } from '../src/runtime/fit';

describe('画面への収め方', () => {
  it('ウィンドウが横長でも舞台は16:9のまま', () => {
    const fitted = containSize(1920, 1080, 1600, 600);
    expect(fitted.height).toBe(600);
    expect(fitted.width / fitted.height).toBeCloseTo(16 / 9, 2);
  });

  it('ウィンドウが縦長でも舞台は16:9のまま', () => {
    const fitted = containSize(1920, 1080, 400, 900);
    expect(fitted.width).toBe(400);
    expect(fitted.width / fitted.height).toBeCloseTo(16 / 9, 2);
  });

  it('正方形の絵は上下を隠して横幅に合わせる', () => {
    const scale = coverScale(1000, 1000, 1920, 1080);
    expect(1000 * scale).toBeCloseTo(1920);
    expect(1000 * scale).toBeGreaterThan(1080);
  });

  it('キャンバス上の点を舞台座標に戻す', () => {
    const point = clientToStage({ left: 10, top: 20, width: 320, height: 180 }, 10 + 160, 20 + 90, 1920, 1080);
    expect(point).toEqual({ x: 960, y: 540 });
    expect(clientToStage({ left: 0, top: 0, width: 100, height: 100 }, 120, 10, 1920, 1080)).toBeNull();
  });

  it('横長の絵は左右を隠して高さに合わせる', () => {
    const scale = coverScale(2000, 1000, 1920, 1080);
    expect(1000 * scale).toBeCloseTo(1080);
    expect(2000 * scale).toBeGreaterThan(1920);
  });
});
