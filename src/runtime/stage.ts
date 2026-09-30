import {
  AdjustmentFilter,
  BloomFilter,
  BulgePinchFilter,
  ColorMapFilter,
  DropShadowFilter,
  GlitchFilter,
  GlowFilter,
  MotionBlurFilter,
  OldFilmFilter,
  PixelateFilter,
  RGBSplitFilter,
  RadialBlurFilter,
  ShockwaveFilter,
  TwistFilter,
} from 'pixi-filters';
import {
  Application,
  Assets,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  DisplacementFilter,
  Graphics,
  Sprite,
  Texture,
  type BLEND_MODES,
  type Filter,
} from 'pixi.js';
import type { Role } from '../core/effects/catalog';
import { planEffect, type AnimationPlan } from '../core/effects/plan';
import { ease } from '../core/effects/easing';
import { sampleBezier, sampleTrack } from '../core/effects/track';
import {
  findAudio,
  findBackground,
  findByName,
  findCg,
  findExpression,
  mediaUrl,
  type Project,
} from '../core/project/project';
import type { NodeSnap, StageSnapshot } from '../core/save/save';
import type { Command, EffectSpec } from '../core/scenario/types';
import { AudioBus, systemCueUrl, type SystemCue } from './audio';
import { containSize, coverScale } from './fit';
import { ParticleField } from './particles';
import { SourceFilter, StudioFilter } from './shaders';

type Grade = {
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  red: number;
  green: number;
  blue: number;
};

type Visual = {
  id: string;
  kind: 'bg' | 'char' | 'cg' | 'cover';
  variant?: string;
  expr?: string;
  view: Container;
  sprite: Sprite | null;
  owned: boolean;
  alpha: number;
  restX: number;
  restY: number;
  grade: Grade;
  gradeDirty: boolean;
  adjustment?: AdjustmentFilter;
  colorMatrix?: ColorMatrixFilter;
  blur?: BlurFilter;
  studio?: StudioFilter;
  custom?: SourceFilter;
  glow?: GlowFilter;
  bloom?: BloomFilter;
  chroma?: RGBSplitFilter;
  pixel?: PixelateFilter;
  glitch?: GlitchFilter;
  bulge?: BulgePinchFilter;
  twist?: TwistFilter;
  shock?: ShockwaveFilter;
  shadow?: DropShadowFilter;
  motion?: MotionBlurFilter;
  radial?: RadialBlurFilter;
  grain?: OldFilmFilter;
  displace?: DisplacementFilter;
  gradient?: ColorMapFilter;
  maskG?: Graphics;
};

type Job = {
  duration: number;
  delay: number;
  elapsed: number;
  loopCount: number;
  loopsDone: number;
  clock: 'eased' | 'raw';
  easing: string;
  onFrame: (t: number, raw: number) => void;
  resolve: () => void;
};

function grade(): Grade {
  return { brightness: 1, contrast: 1, saturation: 1, gamma: 1, red: 1, green: 1, blue: 1 };
}

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void, w: number, h: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.WHITE;
  draw(ctx, canvas);
  return Texture.from(canvas);
}

export class NovelStage {
  readonly audio = new AudioBus();
  onUnlock?: (kind: 'bgm' | 'cg', id: string) => void;
  onTextFx: ((mode: 'typewriter' | 'textFade' | 'textShake') => void) | null = null;
  private app?: Application;
  private readonly width: number;
  private readonly height: number;
  private cameraRoot?: Container;
  private content?: Container;
  private bgLayer?: Container;
  private charLayer?: Container;
  private cgLayer?: Container;
  private particleLayer?: Container;
  private screenLayer?: Container;
  private flash?: Graphics;
  private letterTop?: Graphics;
  private letterBottom?: Graphics;
  private overlayColor = '#ffffff';
  private background?: Visual;
  private cg?: Visual;
  private readonly characters = new Map<string, Visual>();
  private screenVisual?: Visual;
  private particles?: ParticleField;
  private displaceSprite?: Sprite;
  private noiseTexture?: Texture;
  private gradientTexture?: Texture;
  private whiteTexture?: Texture;
  private readonly studios = new Set<StudioFilter>();
  private readonly jobs: Job[] = [];
  private camera = { x: 0, y: 0, zoom: 1, rotation: 0, letterbox: 0 };
  private camOffX = 0;
  private camOffY = 0;
  private focusAmount = 0.42;
  private speaker = '';
  private time = 0;
  private destroyed = false;
  private ready = false;
  private resizeObserver?: ResizeObserver;

  constructor(private readonly host: HTMLElement, private readonly project: Project) {
    this.width = project.width;
    this.height = project.height;
  }

  async init(): Promise<void> {
    const app = new Application();
    this.app = app;
    await app.init({
      width: this.width,
      height: this.height,
      background: '#120f0c',
      antialias: true,
      preference: 'webgl',
      resolution: 1,
      autoDensity: false,
    });
    if (this.destroyed) {
      app.destroy();
      return;
    }
    app.canvas.style.width = '';
    app.canvas.style.height = '';
    this.host.appendChild(app.canvas);
    this.fitCanvas();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.fitCanvas());
      this.resizeObserver.observe(this.host);
    }

    const cameraRoot = new Container();
    const content = new Container();
    const bgLayer = new Container();
    const charLayer = new Container();
    const particleLayer = new Container();
    const cgLayer = new Container();
    const screenLayer = new Container();
    content.addChild(bgLayer, charLayer, particleLayer, cgLayer);
    cameraRoot.addChild(content);
    const flash = new Graphics();
    const letterTop = new Graphics();
    const letterBottom = new Graphics();
    app.stage.addChild(cameraRoot, screenLayer, flash, letterTop, letterBottom);
    this.cameraRoot = cameraRoot;
    this.content = content;
    this.bgLayer = bgLayer;
    this.charLayer = charLayer;
    this.particleLayer = particleLayer;
    this.cgLayer = cgLayer;
    this.screenLayer = screenLayer;
    this.flash = flash;
    this.letterTop = letterTop;
    this.letterBottom = letterBottom;

    this.whiteTexture = canvasTexture((ctx, canvas) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 4, 4);
    this.noiseTexture = canvasTexture((ctx, canvas) => {
      const image = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < image.data.length; i += 4) {
        image.data[i] = Math.random() * 255;
        image.data[i + 1] = Math.random() * 255;
        image.data[i + 2] = 128;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    }, 128, 128);
    this.gradientTexture = canvasTexture((ctx, canvas) => {
      const paint = ctx.createLinearGradient(0, 0, canvas.width, 0);
      paint.addColorStop(0, '#12182e');
      paint.addColorStop(0.5, '#c4553a');
      paint.addColorStop(1, '#ffe1a8');
      ctx.fillStyle = paint;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 256, 1);
    const dot = canvasTexture((ctx, canvas) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }, 16, 16);
    this.particles = new ParticleField(particleLayer, dot, this.width, this.height);
    this.displaceSprite = new Sprite(this.noiseTexture);
    this.screenVisual = this.makeVisual('screen', 'bg', content, false);
    this.applyCamera();
    app.ticker.add(() => {
      const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
      this.time += dt;
      this.tick(dt);
    });
    this.ready = true;
  }

  setVolumes(volumes: Partial<AudioBus['volumes']>): void {
    this.audio.setVolumes(volumes);
  }

  playSystem(name: SystemCue): void {
    this.audio.play('system', systemCueUrl(name));
  }

  captureThumbnail(): string {
    const app = this.app;
    if (!app || typeof document === 'undefined') return '';
    try {
      const extract = app.renderer.extract as unknown as { canvas?: (target: Container) => CanvasImageSource };
      const source = extract.canvas ? extract.canvas(app.stage) : (app.canvas as unknown as CanvasImageSource);
      const width = 320;
      const height = Math.max(1, Math.round(width * (this.height / this.width)));
      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const ctx = out.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(source, 0, 0, width, height);
      return out.toDataURL('image/jpeg', 0.72);
    } catch {
      return '';
    }
  }

  setSpeaker(name: string): void {
    this.speaker = name;
    this.refreshFocus();
  }

  finishTweens(): void {
    const jobs = this.jobs.splice(0);
    for (const job of jobs) {
      job.onFrame(1, 1);
      job.resolve();
    }
  }

  async playBatch(commands: Command[]): Promise<void> {
    if (!this.ready) return;
    await Promise.all(commands.map(async (command) => {
      try {
        await this.playCommand(command);
      } catch (error) {
        console.warn(error);
      }
    }));
  }

  hitCharacter(x: number, y: number): string | null {
    const ids = [...this.characters.keys()].reverse();
    for (const id of ids) {
      const visual = this.characters.get(id);
      const sprite = visual?.sprite;
      if (!visual || !sprite) continue;
      const width = Math.abs(sprite.width);
      const height = Math.abs(sprite.height);
      const left = visual.view.x - width * sprite.anchor.x;
      const top = visual.view.y - height * sprite.anchor.y;
      if (x >= left && x <= left + width && y >= top && y <= top + height) return id;
    }
    return null;
  }

  characterOrigin(id: string): { x: number; y: number } | null {
    const visual = this.characters.get(id);
    if (!visual) return null;
    return { x: visual.view.x, y: visual.view.y };
  }

  moveCharacter(id: string, x: number, y: number): void {
    const visual = this.characters.get(id);
    if (!visual) return;
    const nextX = Math.round(Math.max(-this.width * 0.25, Math.min(this.width * 1.25, x)));
    const nextY = Math.round(Math.max(this.height * 0.35, Math.min(this.height * 1.02, y)));
    visual.view.position.set(nextX, nextY);
    visual.restX = nextX;
    visual.restY = nextY;
  }

  async playSequence(commands: Command[]): Promise<void> {
    for (const command of commands) {
      if (this.destroyed) return;
      await this.playBatch([command]);
    }
  }

  snapshot(): StageSnapshot {
    return {
      background: this.background ? this.snap(this.background) : undefined,
      characters: [...this.characters.values()].map((visual) => this.snap(visual)),
      cg: this.cg ? this.snap(this.cg) : undefined,
      camera: { ...this.camera },
      particle: this.particles?.mode ?? null,
    };
  }

  async restore(snap: StageSnapshot): Promise<void> {
    this.clear();
    if (snap.background) await this.restoreNode(snap.background);
    for (const node of snap.characters) await this.restoreNode(node);
    if (snap.cg) await this.restoreNode(snap.cg);
    this.camera = { ...snap.camera };
    this.applyCamera();
    if (snap.particle) this.particles?.start(snap.particle, 9999);
  }

  clear(): void {
    this.finishTweens();
    for (const visual of [...this.characters.values()]) this.destroyVisual(visual);
    if (this.background) this.destroyVisual(this.background);
    if (this.cg) this.destroyVisual(this.cg);
    this.characters.clear();
    this.background = undefined;
    this.cg = undefined;
    this.particles?.stop();
    this.audio.stopAll();
    this.camera = { x: 0, y: 0, zoom: 1, rotation: 0, letterbox: 0 };
    this.camOffX = 0;
    this.camOffY = 0;
    this.speaker = '';
    if (this.flash) this.flash.alpha = 0;
    this.applyCamera();
    if (this.screenVisual) this.clearFilters(this.screenVisual);
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.finishTweens();
    this.particles?.destroy();
    this.audio.stopAll();
    this.app?.destroy(true, { children: true });
    this.app = undefined;
    this.ready = false;
  }

  private async playCommand(command: Command): Promise<void> {
    if (command.type === 'bg') return this.changeBackground(command.id, command.variant, command.effect);
    if (command.type === 'show') return this.showCharacter(command.character, command.expr, command.at, command.effect);
    if (command.type === 'place') return this.placeCharacter(command.character, command.at);
    if (command.type === 'hide') return this.hideCharacter(command.character, command.effect);
    if (command.type === 'expr') return this.swapExpr(command.character, command.expr, command.effect);
    if (command.type === 'cg') return this.showCg(command.id, command.effect);
    if (command.type === 'fx') return this.playFx(command.target, command.effect);
    if (command.type === 'camera') return this.animate(null, planEffect(command.effect.preset, command.effect.params, this.contextFor(null, 'camera')));
    if (command.type === 'transition') return this.playTransition(command.effect);
    if (command.type === 'particle') {
      if (command.effect.preset === 'stop') {
        this.particles?.stop();
        return;
      }
      return this.animate(null, planEffect(command.effect.preset, command.effect.params, this.contextFor(null, 'particle')));
    }
    if (command.type === 'play') {
      const asset = findAudio(this.project, command.channel, command.id);
      this.audio.play(command.channel, mediaUrl(asset?.src ?? ''), { loop: command.loop, fade: command.fade });
      if (command.channel === 'bgm' && asset) this.onUnlock?.('bgm', command.id);
      return;
    }
    if (command.type === 'stop') {
      this.audio.stop(command.channel, command.fade);
      return;
    }
    if (command.type === 'wait') {
      await this.runClock(command.duration, 0, 1, 'raw', 'linear', () => undefined);
    }
  }

  private async changeBackground(id: string, variant: string | undefined, effect?: EffectSpec): Promise<void> {
    const texture = await this.loadTexture(mediaUrl(findBackground(this.project, id, variant)?.src ?? ''), this.fallbackBg(variant));
    if (!effect) {
      this.putBackground(texture, id, variant, true);
      return;
    }
    const plan = planEffect(effect.preset, effect.params, this.contextFor(this.background ?? null, 'bg'));
    if (plan.overlay?.mode === 'dipSwap') {
      await this.animate(null, plan, () => this.putBackground(texture, id, variant, true));
      return;
    }
    const previous = this.background;
    const created = this.putBackground(texture, id, variant, false);
    await this.animate(created, plan);
    if (previous && previous !== created) this.destroyVisual(previous);
  }

  private placeCharacter(id: string, at: string): void {
    const pos = this.slot(at);
    this.moveCharacter(id, pos.x, pos.y);
  }

  private async showCharacter(id: string, expr: string, at: string, effect?: EffectSpec): Promise<void> {
    const texture = await this.loadTexture(mediaUrl(findExpression(this.project, id, expr)?.src ?? ''), this.fallbackChar());
    let visual = this.characters.get(id);
    const pos = this.slot(at);
    if (!visual) visual = this.createCharacter(id, expr, texture, pos.x, pos.y);
    else {
      if (visual.sprite) visual.sprite.texture = texture;
      visual.expr = expr;
      visual.view.position.set(pos.x, pos.y);
      visual.restX = pos.x;
      visual.restY = pos.y;
    }
    if (!effect) {
      visual.alpha = 1;
      visual.view.alpha = 1;
      this.refreshFocus();
      return;
    }
    await this.animate(visual, planEffect(effect.preset, effect.params, this.contextFor(visual, 'show')));
  }

  private async hideCharacter(id: string, effect?: EffectSpec): Promise<void> {
    const visual = id === 'cg' ? this.cg : this.characters.get(id);
    if (!visual) return;
    if (effect) await this.animate(visual, planEffect(effect.preset, effect.params, this.contextFor(visual, 'hide')));
    this.destroyVisual(visual);
  }

  private async swapExpr(id: string, expr: string, effect?: EffectSpec): Promise<void> {
    const visual = this.characters.get(id);
    if (!visual?.sprite) return;
    const texture = await this.loadTexture(mediaUrl(findExpression(this.project, id, expr)?.src ?? ''), this.fallbackChar());
    const plan = effect ? planEffect(effect.preset, effect.params, this.contextFor(visual, 'expr')) : null;
    if (plan?.reveal === 'alpha') {
      const ghost = new Sprite(visual.sprite.texture);
      ghost.anchor.copyFrom(visual.sprite.anchor);
      ghost.position.copyFrom(visual.sprite.position);
      ghost.scale.copyFrom(visual.sprite.scale);
      ghost.alpha = visual.view.alpha;
      visual.view.parent?.addChild(ghost);
      visual.sprite.texture = texture;
      visual.expr = expr;
      visual.view.parent?.addChild(visual.view);
      await this.animate(visual, plan);
      ghost.destroy();
      return;
    }
    visual.sprite.texture = texture;
    visual.expr = expr;
    if (plan) await this.animate(visual, plan);
  }

  private async showCg(id: string, effect?: EffectSpec): Promise<void> {
    if (id === 'off' || id === 'hide') {
      if (!this.cg) return;
      if (effect) await this.animate(this.cg, planEffect(effect.preset, effect.params, this.contextFor(this.cg, 'hide')));
      this.destroyVisual(this.cg);
      return;
    }
    const texture = await this.loadTexture(mediaUrl(findCg(this.project, id)?.src ?? ''), this.fallbackBg('dusk'));
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(this.width / 2, this.height / 2);
    this.fitCover(sprite);
    this.cgLayer?.addChild(sprite);
    const visual = this.makeVisual(id, 'cg', sprite, true);
    visual.restX = sprite.x;
    visual.restY = sprite.y;
    const previous = this.cg;
    this.cg = visual;
    this.onUnlock?.('cg', id);
    if (effect) await this.animate(visual, planEffect(effect.preset, effect.params, this.contextFor(visual, 'cg')));
    else visual.view.alpha = 1;
    if (previous) this.destroyVisual(previous);
  }

  private async playFx(target: string, effect: EffectSpec): Promise<void> {
    if (target === 'text') {
      const plan = planEffect(effect.preset, effect.params, this.contextFor(null, 'text'));
      if (plan.textMode) this.onTextFx?.(plan.textMode);
      return;
    }
    const visual = target === 'screen' || target === 'stage' ? this.screenVisual ?? null
      : target === 'bg' || target === 'background' ? this.background ?? null
        : this.characters.get(target) ?? null;
    await this.animate(visual, planEffect(effect.preset, effect.params, this.contextFor(visual, 'fx')));
  }

  private async playTransition(effect: EffectSpec): Promise<void> {
    const plan = planEffect(effect.preset, effect.params, this.contextFor(null, 'transition'));
    if (plan.overlay) {
      await this.animate(null, plan);
      return;
    }
    const cover = new Sprite(this.whiteTexture ?? Texture.WHITE);
    cover.tint = 0x000000;
    cover.width = this.width;
    cover.height = this.height;
    this.screenLayer?.addChild(cover);
    const visual = this.makeVisual('cover', 'cover', cover, true);
    try {
      await this.animate(visual, plan);
    } finally {
      this.destroyVisual(visual);
    }
  }

  private fitCanvas(): void {
    const canvas = this.app?.canvas;
    if (!canvas) return;
    const fitted = containSize(this.width, this.height, this.host.clientWidth, this.host.clientHeight);
    canvas.style.width = `${fitted.width}px`;
    canvas.style.height = `${fitted.height}px`;
  }

  private fitCover(sprite: Sprite): void {
    sprite.scale.set(coverScale(sprite.texture.width, sprite.texture.height, this.width, this.height));
  }

  private putBackground(texture: Texture, id: string, variant: string | undefined, replace: boolean): Visual {
    if (replace && this.background?.sprite) {
      this.background.sprite.texture = texture;
      this.fitCover(this.background.sprite);
      this.background.id = id;
      this.background.variant = variant;
      this.background.view.alpha = 1;
      this.background.alpha = 1;
      return this.background;
    }
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(this.width / 2, this.height / 2);
    this.fitCover(sprite);
    this.bgLayer?.addChild(sprite);
    const visual = this.makeVisual(id, 'bg', sprite, true);
    visual.variant = variant;
    visual.restX = sprite.x;
    visual.restY = sprite.y;
    this.background = visual;
    return visual;
  }

  private createCharacter(id: string, expr: string, texture: Texture, x: number, y: number): Visual {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1);
    const scale = (this.height * 0.92) / Math.max(1, texture.height);
    sprite.scale.set(scale);
    sprite.position.set(x, y);
    this.charLayer?.addChild(sprite);
    const visual = this.makeVisual(id, 'char', sprite, true);
    visual.expr = expr;
    visual.restX = x;
    visual.restY = y;
    this.characters.set(id, visual);
    return visual;
  }

  private async restoreNode(node: NodeSnap): Promise<void> {
    if (node.kind === 'bg') {
      const texture = await this.loadTexture(mediaUrl(findBackground(this.project, node.id, node.variant)?.src ?? ''), this.fallbackBg(node.variant));
      const visual = this.putBackground(texture, node.id, node.variant, true);
      this.applySnap(visual, node);
      return;
    }
    if (node.kind === 'cg') {
      await this.showCg(node.id);
      if (this.cg) this.applySnap(this.cg, node);
      return;
    }
    const texture = await this.loadTexture(mediaUrl(findExpression(this.project, node.id, node.expr ?? 'smile')?.src ?? ''), this.fallbackChar());
    const visual = this.createCharacter(node.id, node.expr ?? 'smile', texture, node.x, node.y);
    this.applySnap(visual, node);
  }

  private applySnap(visual: Visual, node: NodeSnap): void {
    visual.view.position.set(node.x, node.y);
    visual.restX = node.x;
    visual.restY = node.y;
    visual.view.scale.set(node.scaleX, node.scaleY);
    visual.view.rotation = node.rotation;
    visual.alpha = node.alpha;
    visual.view.alpha = node.alpha;
    visual.view.blendMode = node.blend as BLEND_MODES;
  }

  private snap(visual: Visual): NodeSnap {
    return {
      id: visual.id,
      kind: visual.kind === 'cover' ? 'cg' : visual.kind,
      expr: visual.expr,
      variant: visual.variant,
      x: visual.view.x,
      y: visual.view.y,
      scaleX: visual.view.scale.x,
      scaleY: visual.view.scale.y,
      rotation: visual.view.rotation,
      alpha: visual.alpha,
      blend: String(visual.view.blendMode),
    };
  }

  private async animate(visual: Visual | null, plan: AnimationPlan, onMid?: () => void): Promise<void> {
    if (plan.blend && visual) visual.view.blendMode = plan.blend as BLEND_MODES;
    if (plan.focusDim !== undefined) {
      this.focusAmount = plan.focusDim;
      this.refreshFocus();
    }
    if (plan.particle) {
      if (plan.particle === 'stop') this.particles?.stop();
      else this.particles?.start(plan.particle, plan.duration);
    }
    if (plan.textMode) this.onTextFx?.(plan.textMode);
    if (plan.overlay) this.overlayColor = plan.overlay.color;
    if (plan.custom && visual) await this.mountCustom(visual, plan.customSource);
    if (!plan.blocking) return;
    let crossed = false;
    const frame = (t: number, raw: number) => {
      if (plan.overlay?.mode === 'dipSwap' && raw >= 0.5 && !crossed) {
        crossed = true;
        onMid?.();
      }
      this.framePlan(visual, plan, t, raw);
    };
    frame(0, 0);
    if (plan.duration <= 0) return;
    await this.runClock(plan.duration, plan.delay, plan.loopCount, plan.clock, plan.easing, frame);
    if (visual && plan.reveal !== 'none' && plan.reveal !== 'alpha' && plan.reveal !== 'dissolve') {
      visual.view.mask = null;
      visual.maskG?.destroy();
      visual.maskG = undefined;
    }
  }

  private framePlan(visual: Visual | null, plan: AnimationPlan, t: number, raw: number): void {
    const sampleAt = plan.clock === 'eased' ? t : raw;
    for (const channel of plan.channels) {
      if (channel.type === 'track') this.applyProp(visual, channel.property, sampleTrack(channel.keys, sampleAt, 'linear'), plan);
      else if (channel.type === 'oscillate') {
        const env = channel.decay ? 1 - raw : 1;
        const offset = Math.sin(raw * channel.frequency * Math.PI * 2) * channel.amplitude * env;
        this.applyOffset(visual, channel.property, offset);
      } else {
        const point = sampleBezier(channel.x0, channel.y0, channel.cx, channel.cy, channel.x1, channel.y1, sampleAt);
        this.applyProp(visual, 'x', point.x, plan);
        this.applyProp(visual, 'y', point.y, plan);
      }
    }
    if (visual?.gradeDirty) this.pushGrade(visual);
    this.applyCamera();
  }

  private applyProp(visual: Visual | null, property: string, value: number, plan: AnimationPlan): void {
    if (property === 'x' && visual) {
      visual.restX = value;
      visual.view.x = value;
    } else if (property === 'y' && visual) {
      visual.restY = value;
      visual.view.y = value;
    } else if (property === 'alpha' && visual) {
      visual.alpha = value;
      visual.view.alpha = value;
      if (visual.kind === 'char') this.refreshFocus();
    } else if (property === 'rotation' && visual) visual.view.rotation = (value * Math.PI) / 180;
    else if (property === 'skew' && visual) visual.view.skew.x = (value * Math.PI) / 180;
    else if (property === 'scaleX' && visual) visual.view.scale.x = value;
    else if (property === 'scaleY' && visual) visual.view.scale.y = value;
    else if (property === 'camX') this.camera.x = value;
    else if (property === 'camY') this.camera.y = value;
    else if (property === 'camZoom') this.camera.zoom = value;
    else if (property === 'camRot') this.camera.rotation = value;
    else if (property === 'letterbox') this.camera.letterbox = value;
    else if (property === 'overlayAlpha') this.paintFlash(value);
    else if (property === 'maskAmount' && visual) this.redrawMask(visual, plan, value);
    else if (visual && property === 'brightness') this.touch(visual, 'brightness', value);
    else if (visual && property === 'contrast') this.touch(visual, 'contrast', value);
    else if (visual && property === 'saturation') this.touch(visual, 'saturation', value);
    else if (visual && property === 'exposure') {
      this.touch(visual, 'brightness', 1 + value);
      this.touch(visual, 'gamma', 1 + value * 0.35);
    } else if (visual && property === 'sepia') {
      this.touch(visual, 'red', 1 + value * 0.28);
      this.touch(visual, 'blue', 1 - value * 0.38);
      this.touch(visual, 'saturation', 1 - value * 0.55);
    } else if (visual && property === 'hue') {
      const matrix = visual.colorMatrix ?? new ColorMatrixFilter();
      visual.colorMatrix = matrix;
      matrix.hue(value, false);
      this.sync(visual);
    } else if (visual && property === 'blur') {
      const blur = visual.blur ?? new BlurFilter({ strength: 0, quality: 3 });
      visual.blur = blur;
      blur.strength = value;
      this.sync(visual);
    } else if (visual && property === 'glow') this.useGlow(visual, value);
    else if (visual && property === 'bloom') this.useBloom(visual, value);
    else if (visual && property === 'chroma') this.useChroma(visual, value);
    else if (visual && property === 'shadow') this.useShadow(visual, value);
    else if (visual && property === 'motion') this.useMotion(visual, value);
    else if (visual && property === 'radialBlur') this.useRadial(visual, value);
    else if (visual && property === 'pixelate') this.usePixel(visual, value);
    else if (visual && property === 'glitch') this.useGlitch(visual, value);
    else if (visual && property === 'bulge') this.useBulge(visual, value);
    else if (visual && property === 'wave') this.setStudio(visual, 4, Math.max(value, 0.2), 4);
    else if (visual && property === 'ripple') this.useShock(visual, value);
    else if (visual && property === 'displace') this.useDisplace(visual, value);
    else if (visual && property === 'grain') this.useGrain(visual, value);
    else if (visual && property === 'invert') this.setStudio(visual, 1, value, 4);
    else if (visual && property === 'posterize') this.setStudio(visual, 2, 1, value);
    else if (visual && property === 'vignette') this.setStudio(visual, 3, value, 4);
    else if (visual && property === 'gradientMap') this.useGradient(visual, value);
    else if (visual && property === 'shaderMix') {
      if (visual.custom) visual.custom.amount = value;
      else this.setStudio(visual, 5, value, 4);
    }
  }

  private applyOffset(visual: Visual | null, property: string, offset: number): void {
    if (property === 'x' && visual) visual.view.x = visual.restX + offset;
    else if (property === 'y' && visual) visual.view.y = visual.restY + offset;
    else if (property === 'skew' && visual) visual.view.skew.x = (offset * Math.PI) / 180;
    else if (property === 'camX') this.camOffX = offset;
    else if (property === 'camY') this.camOffY = offset;
  }

  private touch(visual: Visual, key: keyof Grade, value: number): void {
    visual.grade[key] = value;
    visual.gradeDirty = true;
  }

  private pushGrade(visual: Visual): void {
    const filter = visual.adjustment ?? new AdjustmentFilter();
    visual.adjustment = filter;
    filter.brightness = visual.grade.brightness;
    filter.contrast = visual.grade.contrast;
    filter.saturation = visual.grade.saturation;
    filter.gamma = visual.grade.gamma;
    filter.red = visual.grade.red;
    filter.green = visual.grade.green;
    filter.blue = visual.grade.blue;
    visual.gradeDirty = false;
    this.sync(visual);
  }

  private setStudio(visual: Visual, mode: number, amount: number, levels: number): void {
    const filter = visual.studio ?? new StudioFilter();
    visual.studio = filter;
    this.studios.add(filter);
    filter.setMode(mode, amount, levels);
    filter.setTime(this.time);
    this.sync(visual);
  }

  private useGlow(visual: Visual, value: number): void {
    const filter = visual.glow ?? new GlowFilter({ distance: 14, outerStrength: 0, color: 0xfff1c9 });
    visual.glow = filter;
    filter.outerStrength = value;
    this.sync(visual);
  }

  private useBloom(visual: Visual, value: number): void {
    const filter = visual.bloom ?? new BloomFilter({ strength: 0 });
    visual.bloom = filter;
    filter.strength = value;
    this.sync(visual);
  }

  private useChroma(visual: Visual, value: number): void {
    const filter = visual.chroma ?? new RGBSplitFilter();
    visual.chroma = filter;
    filter.red = { x: value, y: 0 };
    filter.blue = { x: -value, y: 0 };
    this.sync(visual);
  }

  private useShadow(visual: Visual, value: number): void {
    const filter = visual.shadow ?? new DropShadowFilter({ offset: { x: 10, y: 14 }, blur: 6, alpha: 0 });
    visual.shadow = filter;
    filter.alpha = value * 0.75;
    filter.blur = 4 + value * 8;
    this.sync(visual);
  }

  private useMotion(visual: Visual, value: number): void {
    const filter = visual.motion ?? new MotionBlurFilter({ velocity: { x: 0, y: 0 }, kernelSize: 5 });
    visual.motion = filter;
    filter.velocity = { x: value, y: value * 0.15 };
    this.sync(visual);
  }

  private useRadial(visual: Visual, value: number): void {
    const filter = visual.radial ?? new RadialBlurFilter({ angle: 0, center: { x: this.width / 2, y: this.height / 2 }, kernelSize: 5 });
    visual.radial = filter;
    filter.angle = value;
    this.sync(visual);
  }

  private usePixel(visual: Visual, value: number): void {
    const filter = visual.pixel ?? new PixelateFilter(1);
    visual.pixel = filter;
    filter.size = Math.max(1, value);
    this.sync(visual);
  }

  private useGlitch(visual: Visual, value: number): void {
    const filter = visual.glitch ?? new GlitchFilter({ slices: 8, offset: 0 });
    visual.glitch = filter;
    filter.offset = 8 + value * 48;
    filter.seed = this.time * 10;
    filter.refresh();
    this.sync(visual);
  }

  private useBulge(visual: Visual, value: number): void {
    const filter = visual.bulge ?? new BulgePinchFilter({ center: { x: 0.5, y: 0.45 }, radius: Math.min(this.width, this.height) * 0.35, strength: 0 });
    visual.bulge = filter;
    filter.strength = value;
    this.sync(visual);
  }

  private useShock(visual: Visual, value: number): void {
    const filter = visual.shock ?? new ShockwaveFilter({ center: { x: this.width / 2, y: this.height / 2 }, amplitude: 30, wavelength: 140, speed: 500 });
    visual.shock = filter;
    filter.time = value * 0.8;
    filter.amplitude = 20 + value * 30;
    this.sync(visual);
  }

  private useDisplace(visual: Visual, value: number): void {
    if (!this.displaceSprite) return;
    const filter = visual.displace ?? new DisplacementFilter({ sprite: this.displaceSprite, scale: 0 });
    visual.displace = filter;
    filter.scale.x = value;
    filter.scale.y = value;
    this.sync(visual);
  }

  private useGrain(visual: Visual, value: number): void {
    const filter = visual.grain ?? new OldFilmFilter({ noise: 0, scratch: 0, sepia: 0, vignetting: 0, vignettingAlpha: 0 });
    visual.grain = filter;
    filter.noise = value;
    filter.scratch = 0;
    this.sync(visual);
  }

  private useGradient(visual: Visual, value: number): void {
    if (!this.gradientTexture) return;
    const filter = visual.gradient ?? new ColorMapFilter({ colorMap: this.gradientTexture, mix: 0 });
    visual.gradient = filter;
    filter.mix = value;
    this.sync(visual);
  }

  private async mountCustom(visual: Visual, source: string): Promise<void> {
    const fragment = await this.resolveFragment(source);
    if (!fragment) return;
    try {
      visual.custom = new SourceFilter(fragment);
      this.sync(visual);
    } catch (error) {
      console.warn(error);
    }
  }

  private async resolveFragment(source: string): Promise<string> {
    if (!source) return '';
    if (source.includes('void main')) return source;
    try {
      const response = await fetch(mediaUrl(source));
      if (!response.ok) return '';
      return await response.text();
    } catch {
      return '';
    }
  }

  private sync(visual: Visual): void {
    const filters: Filter[] = [];
    const push = (filter: Filter | undefined) => {
      if (filter) filters.push(filter);
    };
    push(visual.adjustment);
    push(visual.colorMatrix);
    push(visual.blur);
    push(visual.studio);
    push(visual.custom);
    push(visual.glow);
    push(visual.bloom);
    push(visual.chroma);
    push(visual.pixel);
    push(visual.glitch);
    push(visual.bulge);
    push(visual.twist);
    push(visual.shock);
    push(visual.shadow);
    push(visual.motion);
    push(visual.radial);
    push(visual.grain);
    push(visual.displace);
    push(visual.gradient);
    visual.view.filters = filters.length ? filters : null;
  }

  private clearFilters(visual: Visual): void {
    visual.adjustment = undefined;
    visual.colorMatrix = undefined;
    visual.blur = undefined;
    visual.studio = undefined;
    visual.custom = undefined;
    visual.view.filters = null;
    visual.grade = grade();
  }

  private redrawMask(visual: Visual, plan: AnimationPlan, amount: number): void {
    if (plan.reveal === 'dissolve') {
      this.setStudio(visual, 7, amount, 4);
      return;
    }
    if (plan.reveal === 'none' || plan.reveal === 'alpha') return;
    const bounds = visual.view.getBounds();
    const mask = visual.maskG ?? new Graphics();
    visual.maskG = mask;
    mask.renderable = false;
    if (!mask.parent) this.app?.stage.addChild(mask);
    mask.clear();
    const ratio = Math.max(0, Math.min(1, amount));
    if (plan.reveal === 'iris') {
      mask.circle(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, Math.max(1, Math.hypot(bounds.width, bounds.height) * 0.5 * ratio)).fill(0xffffff);
    } else if (plan.reveal === 'clock') {
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const radius = Math.hypot(bounds.width, bounds.height);
      mask.moveTo(cx, cy).arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, ratio)).lineTo(cx, cy).fill(0xffffff);
    } else if (plan.reveal === 'barn') {
      const width = Math.max(1, bounds.width * ratio);
      mask.rect(bounds.x + (bounds.width - width) / 2, bounds.y, width, Math.max(1, bounds.height)).fill(0xffffff);
    } else {
      let x = bounds.x;
      let y = bounds.y;
      let w = bounds.width;
      let h = bounds.height;
      if (plan.direction === 'right') {
        w *= ratio;
        x = bounds.x + bounds.width - w;
      } else if (plan.direction === 'up') h *= ratio;
      else if (plan.direction === 'down') {
        h *= ratio;
        y = bounds.y + bounds.height - h;
      } else if (plan.direction === 'diagonal') {
        w *= ratio;
        h *= ratio;
      } else w *= ratio;
      mask.rect(x, y, Math.max(1, w), Math.max(1, h)).fill(0xffffff);
    }
    visual.view.mask = mask;
  }

  private paintFlash(alpha: number): void {
    if (!this.flash) return;
    this.flash.clear();
    this.flash.rect(0, 0, this.width, this.height).fill(this.overlayColor);
    this.flash.alpha = alpha;
  }

  private applyCamera(): void {
    if (!this.cameraRoot) return;
    this.cameraRoot.position.set(this.width / 2 + this.camera.x + this.camOffX, this.height / 2 + this.camera.y + this.camOffY);
    this.cameraRoot.pivot.set(this.width / 2, this.height / 2);
    this.cameraRoot.scale.set(this.camera.zoom);
    this.cameraRoot.rotation = (this.camera.rotation * Math.PI) / 180;
    const bar = Math.max(0, this.camera.letterbox);
    this.letterTop?.clear();
    this.letterBottom?.clear();
    if (bar > 0) {
      this.letterTop?.rect(0, 0, this.width, bar).fill(0x000000);
      this.letterBottom?.rect(0, this.height - bar, this.width, bar).fill(0x000000);
    }
  }

  private refreshFocus(): void {
    const speaker = findByName(this.project, this.speaker);
    for (const visual of this.characters.values()) {
      const dim = this.focusAmount > 0 && speaker && visual.id !== speaker.id;
      visual.view.alpha = visual.alpha * (dim ? Math.max(0.35, 1 - this.focusAmount) : 1);
    }
  }

  private contextFor(visual: Visual | null, role: Role) {
    return {
      role,
      width: this.width,
      height: this.height,
      x: visual?.view.x ?? this.width / 2,
      y: visual?.view.y ?? this.height / 2,
      scaleX: visual?.view.scale.x ?? 1,
      scaleY: visual?.view.scale.y ?? 1,
      rotation: ((visual?.view.rotation ?? 0) * 180) / Math.PI,
      alpha: visual?.alpha ?? 1,
      camX: this.camera.x,
      camY: this.camera.y,
      camZoom: this.camera.zoom,
      camRot: this.camera.rotation,
      letterbox: this.camera.letterbox,
    };
  }

  private slot(at: string): { x: number; y: number } {
    if (at.includes(',')) {
      const [x, y] = at.split(',').map(Number);
      return { x: Number.isFinite(x) ? x : this.width / 2, y: Number.isFinite(y) ? y : this.height * 0.98 };
    }
    const y = this.height * 0.98;
    if (at === 'left') return { x: this.width * 0.28, y };
    if (at === 'right') return { x: this.width * 0.72, y };
    return { x: this.width * 0.5, y };
  }

  private makeVisual(id: string, kind: Visual['kind'], view: Container, owned: boolean): Visual {
    const sprite = view instanceof Sprite ? view : null;
    return {
      id, kind, view, sprite, owned, alpha: 1, restX: view.x, restY: view.y, grade: grade(), gradeDirty: false,
    };
  }

  private destroyVisual(visual: Visual): void {
    visual.view.mask = null;
    visual.maskG?.destroy();
    if (visual.studio) this.studios.delete(visual.studio);
    if (visual.owned) visual.view.destroy({ children: true });
    if (this.background === visual) this.background = undefined;
    if (this.cg === visual) this.cg = undefined;
    this.characters.delete(visual.id);
  }

  private async loadTexture(url: string, fallback: Texture): Promise<Texture> {
    if (!url) return fallback;
    try {
      return await Assets.load<Texture>(url);
    } catch {
      return fallback;
    }
  }

  private fallbackBg(variant?: string): Texture {
    const color = variant === 'night' ? '#1b2444' : variant === 'dusk' ? '#c46a45' : '#8eb7df';
    return canvasTexture((ctx, canvas) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 8, 8);
  }

  private fallbackChar(): Texture {
    return canvasTexture((ctx) => {
      ctx.fillStyle = '#d4537e';
      ctx.beginPath();
      ctx.ellipse(90, 70, 36, 44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(48, 108, 84, 180);
    }, 180, 320);
  }

  private runClock(
    duration: number,
    delay: number,
    loopCount: number,
    clock: 'eased' | 'raw',
    easingName: string,
    onFrame: (t: number, raw: number) => void,
  ): Promise<void> {
    if (duration <= 0) {
      onFrame(1, 1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.jobs.push({ duration, delay, elapsed: 0, loopCount, loopsDone: 0, clock, easing: easingName, onFrame, resolve });
    });
  }

  private tick(dt: number): void {
    this.audio.tick(dt);
    for (const filter of this.studios) filter.setTime(this.time);
    this.particles?.update(dt);
    const finished: Job[] = [];
    for (const job of this.jobs) {
      job.elapsed += dt;
      if (job.elapsed < job.delay) continue;
      const raw = Math.min(1, (job.elapsed - job.delay) / job.duration);
      const t = job.clock === 'eased' ? ease(job.easing, raw) : raw;
      job.onFrame(t, raw);
      if (raw >= 1) {
        job.loopsDone += 1;
        if (job.loopsDone < job.loopCount) job.elapsed = job.delay;
        else finished.push(job);
      }
    }
    for (const job of finished) {
      const index = this.jobs.indexOf(job);
      if (index >= 0) this.jobs.splice(index, 1);
      job.resolve();
    }
  }
}
