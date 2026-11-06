import { describe, expect, it } from 'vitest';
import { findVoice, normalizeProject } from '../src/core/project/project';

describe('声のパック', () => {
  const project = normalizeProject({
    script: '',
    assets: {
      voice: [
        { id: 'w1', src: 'audition/audio/w1.wav' },
        { id: 'n1', src: 'audition/audio/n1.wav' },
        { id: 'eleven_w1', src: 'audition/audio/eleven/w1.mp3' },
      ],
    },
  });

  it('指定が無ければ Gemini のボイスを使う', () => {
    expect(findVoice(project, 'w1')?.src).toBe('audition/audio/w1.wav');
    expect(findVoice(project, 'w1', 'gemini')?.src).toBe('audition/audio/w1.wav');
    expect(findVoice(project, 'w1', '  ')?.src).toBe('audition/audio/w1.wav');
  });

  it('Eleven のファイルがあればそちらを使う', () => {
    expect(findVoice(project, 'w1', 'eleven')?.src).toBe('audition/audio/eleven/w1.mp3');
  });

  it('パックに無い行は元のボイスに戻す', () => {
    expect(findVoice(project, 'n1', 'eleven')?.src).toBe('audition/audio/n1.wav');
  });
});
