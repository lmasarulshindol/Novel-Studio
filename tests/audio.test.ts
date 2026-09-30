import { describe, expect, it } from 'vitest';
import { AudioBus, type AudioHandle } from '../src/runtime/audio';

class FakeAudio implements AudioHandle {
  src: string;
  loop = false;
  volume = 1;
  paused = true;
  plays = 0;

  constructor(url: string) {
    this.src = url;
  }

  play(): Promise<void> {
    this.paused = false;
    this.plays += 1;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }
}

function bus() {
  const made: FakeAudio[] = [];
  const audio = new AudioBus((url) => {
    const handle = new FakeAudio(url);
    made.push(handle);
    return handle;
  });
  return { audio, made };
}

describe('オーディオバス', () => {
  it('BGM はフェードで入れ替わり、同じ曲は鳴らし直さない', () => {
    const { audio, made } = bus();
    audio.play('bgm', 'day', { loop: true, fade: 1 });
    audio.tick(0.5);
    expect(audio.gains('bgm')[0]).toBeCloseTo(0.5);
    audio.play('bgm', 'day', { loop: true, fade: 1 });
    expect(made).toHaveLength(1);
    audio.play('bgm', 'dusk', { loop: true, fade: 1 });
    expect(audio.gains('bgm')).toHaveLength(2);
    audio.tick(1);
    expect(audio.gains('bgm')).toEqual([1]);
    expect(made[0].paused).toBe(true);
    expect(made[1].paused).toBe(false);
    expect(made[1].loop).toBe(true);
  });

  it('SE は重なり、システム音は別の音量を使う', () => {
    const { audio, made } = bus();
    audio.setVolumes({ se: 0.5, system: 0.25 });
    audio.play('se', 'click');
    audio.play('se', 'shake');
    audio.play('system', 'cursor');
    expect(audio.gains('se')).toEqual([1, 1]);
    expect(made[0].volume).toBeCloseTo(0.5);
    expect(made[2].volume).toBeCloseTo(0.25);
    audio.stop('se');
    expect(audio.gains('se')).toEqual([]);
    expect(audio.gains('system')).toEqual([1]);
  });

  it('停止フェードで音量を下げてから消す', () => {
    const { audio, made } = bus();
    audio.play('bgm', 'night', { loop: true });
    audio.stop('bgm', 1);
    audio.tick(0.4);
    expect(audio.gains('bgm')[0]).toBeCloseTo(0.6);
    expect(made[0].paused).toBe(false);
    audio.tick(0.7);
    expect(audio.gains('bgm')).toEqual([]);
    expect(made[0].paused).toBe(true);
  });
});
