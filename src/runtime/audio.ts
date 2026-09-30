export type BusChannel = 'bgm' | 'se' | 'voice' | 'system';

export type SystemCue = 'cursor' | 'choice' | 'save';

export type AudioHandle = {
  src: string;
  loop: boolean;
  volume: number;
  paused: boolean;
  play(): Promise<void>;
  pause(): void;
};

type Voice = {
  channel: BusChannel;
  url: string;
  handle: AudioHandle;
  gain: number;
  target: number;
  rate: number;
  remove: boolean;
};

const RATE = 22050;

function wavUrl(samples: number[]): string {
  const data = samples.length * 2;
  const buffer = new ArrayBuffer(44 + data);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + data, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, data, true);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, Math.round(clamped * 32767), true);
  });
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function tone(freq: number, seconds: number, volume: number): number[] {
  const count = Math.floor(RATE * seconds);
  const samples: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const env = Math.min(1, t / 0.02) * Math.min(1, (1 - t) / 0.2);
    samples.push(Math.sin(2 * Math.PI * freq * (i / RATE)) * volume * env);
  }
  return samples;
}

function noise(seconds: number, volume: number): number[] {
  const count = Math.floor(RATE * seconds);
  const samples: number[] = [];
  for (let i = 0; i < count; i++) {
    const env = Math.exp(-i / (RATE * 0.02));
    samples.push((Math.random() * 2 - 1) * volume * env);
  }
  return samples;
}

const CUES: Record<SystemCue, string> = {
  cursor: wavUrl(noise(0.045, 0.35)),
  choice: wavUrl([...tone(660, 0.07, 0.28), ...tone(880, 0.09, 0.24)]),
  save: wavUrl(tone(520, 0.16, 0.3)),
};

export function systemCueUrl(name: SystemCue): string {
  return CUES[name];
}

export function createHtmlAudio(url: string): AudioHandle {
  return new Audio(url);
}

let cueBus: AudioBus | undefined;

export function playSystemCue(volume: number, name: SystemCue): void {
  cueBus ??= new AudioBus();
  cueBus.setVolumes({ system: volume });
  cueBus.play('system', systemCueUrl(name));
}

export class AudioBus {
  volumes = { bgm: 0.7, se: 0.8, voice: 0.9, system: 0.7 };
  private voices: Voice[] = [];

  constructor(private readonly create: (url: string) => AudioHandle = createHtmlAudio) {}

  setVolumes(volumes: Partial<AudioBus['volumes']>): void {
    this.volumes = { ...this.volumes, ...volumes };
    this.voices.forEach((voice) => this.applyVolume(voice));
  }

  play(channel: BusChannel, url: string, options: { loop?: boolean; fade?: number } = {}): void {
    if (!url) return;
    const fade = Math.max(0, options.fade ?? 0);
    if (channel === 'bgm' || channel === 'voice') {
      const live = this.voices.find((voice) => voice.channel === channel && voice.url === url && !voice.remove);
      if (live) return;
      this.fadeOutChannel(channel, fade);
    }
    const handle = this.create(url);
    handle.loop = channel === 'bgm' && Boolean(options.loop);
    const voice: Voice = {
      channel,
      url,
      handle,
      gain: fade > 0 ? 0 : 1,
      target: 1,
      rate: fade > 0 ? 1 / fade : 0,
      remove: false,
    };
    this.applyVolume(voice);
    this.voices.push(voice);
    void handle.play().catch(() => undefined);
  }

  stop(channel: BusChannel, fade = 0): void {
    this.fadeOutChannel(channel, Math.max(0, fade));
  }

  stopAll(): void {
    (['bgm', 'se', 'voice', 'system'] as BusChannel[]).forEach((channel) => this.stop(channel));
  }

  tick(dt: number): void {
    for (const voice of this.voices) {
      if (voice.rate <= 0 || voice.gain === voice.target) continue;
      const dir = voice.target > voice.gain ? 1 : -1;
      voice.gain += dir * voice.rate * dt;
      if ((dir > 0 && voice.gain >= voice.target) || (dir < 0 && voice.gain <= voice.target)) voice.gain = voice.target;
      this.applyVolume(voice);
    }
    this.voices = this.voices.filter((voice) => {
      if (voice.remove && voice.gain <= 0.001) {
        this.release(voice);
        return false;
      }
      return true;
    });
  }

  gains(channel: BusChannel): number[] {
    return this.voices.filter((voice) => voice.channel === channel).map((voice) => voice.gain);
  }

  private fadeOutChannel(channel: BusChannel, fade: number): void {
    for (const voice of this.voices) {
      if (voice.channel !== channel || voice.remove) continue;
      voice.remove = true;
      voice.target = 0;
      if (fade <= 0 || voice.gain <= 0) {
        voice.gain = 0;
        voice.rate = 0;
        this.release(voice);
      } else {
        voice.rate = voice.gain / fade;
      }
    }
    this.voices = this.voices.filter((voice) => !(voice.remove && voice.gain <= 0));
  }

  private applyVolume(voice: Voice): void {
    voice.handle.volume = Math.max(0, Math.min(1, this.volumes[voice.channel] * voice.gain));
  }

  private release(voice: Voice): void {
    voice.handle.pause();
    voice.handle.src = '';
  }
}
