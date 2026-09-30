import { Container, Sprite, Texture } from 'pixi.js';

type Bit = {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  spin: number;
  sway: number;
};

const LOOK: Record<string, { tint: number; w: number; h: number; vy: number; vx: number; alpha: number }> = {
  rain: { tint: 0xb7d7ff, w: 0.08, h: 1.4, vy: 780, vx: 90, alpha: 0.45 },
  snow: { tint: 0xffffff, w: 0.35, h: 0.35, vy: 70, vx: 18, alpha: 0.85 },
  petals: { tint: 0xf3a0c0, w: 0.55, h: 0.32, vy: 90, vx: 30, alpha: 0.9 },
  sparkle: { tint: 0xfff2c4, w: 0.22, h: 0.22, vy: -20, vx: 8, alpha: 0.95 },
  embers: { tint: 0xff7a3c, w: 0.2, h: 0.2, vy: -140, vx: 16, alpha: 0.9 },
};

export class ParticleField {
  mode: string | null = null;
  private left = 0;
  private bits: Bit[] = [];

  constructor(
    private readonly layer: Container,
    private readonly texture: Texture,
    private readonly width: number,
    private readonly height: number,
  ) {}

  start(mode: string, duration: number): void {
    if (!LOOK[mode]) return;
    this.mode = mode;
    this.left = duration;
    if (this.bits.length < 56) this.spawn(56 - this.bits.length);
  }

  stop(): void {
    this.mode = null;
    this.left = 0;
    this.clear();
  }

  update(dt: number): void {
    if (!this.mode) return;
    this.left -= dt;
    const look = LOOK[this.mode];
    for (const bit of this.bits) {
      bit.life -= dt;
      bit.sprite.x += (bit.vx + Math.sin(bit.life * bit.sway) * look.vx) * dt;
      bit.sprite.y += bit.vy * dt;
      bit.sprite.rotation += bit.spin * dt;
      bit.sprite.alpha = look.alpha * Math.max(0, Math.min(1, bit.life / bit.max));
      if (bit.life <= 0 || bit.sprite.y > this.height + 40 || bit.sprite.y < -40) this.reset(bit);
    }
    if (this.left <= 0) this.stop();
  }

  private spawn(count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(this.texture);
      sprite.anchor.set(0.5);
      const bit: Bit = { sprite, vx: 0, vy: 0, life: 1, max: 1, spin: 0, sway: 1 };
      this.reset(bit);
      bit.sprite.y = Math.random() * this.height;
      this.layer.addChild(sprite);
      this.bits.push(bit);
    }
  }

  private reset(bit: Bit): void {
    if (!this.mode) return;
    const look = LOOK[this.mode];
    bit.sprite.x = Math.random() * this.width;
    bit.sprite.y = look.vy > 0 ? -20 : this.height + 10;
    bit.sprite.scale.set(look.w, look.h);
    bit.sprite.tint = look.tint;
    bit.vx = (Math.random() - 0.5) * look.vx;
    bit.vy = look.vy * (0.75 + Math.random() * 0.5);
    bit.max = 2 + Math.random() * 3;
    bit.life = bit.max;
    bit.spin = (Math.random() - 0.5) * 2;
    bit.sway = 1 + Math.random() * 3;
  }

  private clear(): void {
    for (const bit of this.bits) bit.sprite.destroy();
    this.bits = [];
  }

  destroy(): void {
    this.clear();
  }
}
