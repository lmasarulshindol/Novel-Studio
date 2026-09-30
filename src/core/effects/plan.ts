import type { ParamValue } from '../scenario/types';
import { defaultDuration, resolvePreset, type Role } from './catalog';

export type EffectContext = {
  role: Role;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  camX: number;
  camY: number;
  camZoom: number;
  camRot: number;
  letterbox: number;
};

export type TrackChannel = {
  type: 'track';
  property: string;
  keys: { time: number; value: number }[];
};

export type OscChannel = {
  type: 'oscillate';
  property: string;
  amplitude: number;
  frequency: number;
  decay: boolean;
};

export type BezierChannel = {
  type: 'bezier';
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
};

export type Channel = TrackChannel | OscChannel | BezierChannel;

export type AnimationPlan = {
  preset: string;
  duration: number;
  delay: number;
  loopCount: number;
  clock: 'eased' | 'raw';
  easing: string;
  channels: Channel[];
  reveal: 'none' | 'alpha' | 'wipe' | 'iris' | 'clock' | 'barn' | 'dissolve' | 'gradient';
  direction: string;
  blend?: string;
  particle?: string;
  textMode?: 'typewriter' | 'textFade' | 'textShake';
  focusDim?: number;
  overlay?: { color: string; mode: 'flash' | 'dip' | 'dipSwap' };
  custom: boolean;
  customSource: string;
  blocking: boolean;
};

type Builder = (params: Record<string, ParamValue>, ctx: EffectContext) => Partial<AnimationPlan>;

function num(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === 'number' ? value : fallback;
}

function str(params: Record<string, ParamValue>, key: string, fallback: string): string {
  const value = params[key];
  return typeof value === 'string' ? value : fallback;
}

function track(property: string, from: number, to: number): TrackChannel {
  return { type: 'track', property, keys: [{ time: 0, value: from }, { time: 1, value: to }] };
}

function keys(property: string, pairs: [number, number][]): TrackChannel {
  return { type: 'track', property, keys: pairs.map(([time, value]) => ({ time, value })) };
}

function osc(property: string, amplitude: number, frequency: number, decay: boolean): OscChannel {
  return { type: 'oscillate', property, amplitude, frequency, decay };
}

function slidePoint(ctx: EffectContext, direction: string, distance: number): { x: number; y: number } {
  if (direction === 'right') return { x: ctx.x + distance, y: ctx.y };
  if (direction === 'up') return { x: ctx.x, y: ctx.y - distance };
  if (direction === 'down') return { x: ctx.x, y: ctx.y + distance };
  return { x: ctx.x - distance, y: ctx.y };
}

function maskReveal(
  reveal: AnimationPlan['reveal'],
  params: Record<string, ParamValue>,
  ctx: EffectContext,
): Partial<AnimationPlan> {
  const hide = ctx.role === 'hide' || ctx.role === 'transition';
  return {
    reveal,
    direction: str(params, 'direction', 'left'),
    channels: [track('maskAmount', hide ? 1 : 0, hide ? 0 : 1)],
  };
}

const BUILDERS: Record<string, Builder> = {
  fadeIn: () => ({ reveal: 'alpha', channels: [track('alpha', 0, 1)] }),
  fadeOut: (_p, ctx) => ({ channels: [track('alpha', ctx.alpha, 0)] }),
  crossfade: () => ({ reveal: 'alpha', channels: [track('alpha', 0, 1)] }),
  dissolve: (p, ctx) => maskReveal('dissolve', p, ctx),
  fadeThroughColor: (p) => ({
    clock: 'raw',
    overlay: { color: str(p, 'color', '#000000'), mode: 'dipSwap' },
    channels: [keys('overlayAlpha', [[0, 0], [0.45, 1], [0.55, 1], [1, 0]])],
  }),
  flash: (p) => ({
    clock: 'raw',
    overlay: { color: str(p, 'color', '#ffffff'), mode: 'flash' },
    channels: [keys('overlayAlpha', [[0, 0], [0.25, 1], [1, 0]])],
  }),
  dipBlack: (p) => ({
    clock: 'raw',
    overlay: { color: str(p, 'color', '#000000'), mode: 'dip' },
    channels: [keys('overlayAlpha', [[0, 0], [0.45, 1], [0.55, 1], [1, 0]])],
  }),
  wipe: (p, ctx) => maskReveal('wipe', p, ctx),
  iris: (p, ctx) => maskReveal('iris', p, ctx),
  clockWipe: (p, ctx) => maskReveal('clock', p, ctx),
  barnDoor: (p, ctx) => maskReveal('barn', p, ctx),
  moveTo: (p, ctx) => ({
    channels: [track('x', ctx.x, num(p, 'x', ctx.x)), track('y', ctx.y, num(p, 'y', ctx.y))],
  }),
  slideIn: (p, ctx) => {
    const from = slidePoint(ctx, str(p, 'direction', 'left'), num(p, 'distance', ctx.width * 0.35));
    return {
      reveal: 'alpha',
      channels: [track('x', from.x, ctx.x), track('y', from.y, ctx.y), track('alpha', 0, 1)],
    };
  },
  slideOut: (p, ctx) => {
    const to = slidePoint(ctx, str(p, 'direction', 'left'), num(p, 'distance', ctx.width * 0.35));
    return { channels: [track('x', ctx.x, to.x), track('y', ctx.y, to.y), track('alpha', ctx.alpha, 0)] };
  },
  zoomIn: (_p, ctx) => ({
    reveal: 'alpha',
    channels: [
      track('scaleX', ctx.scaleX * 0.45, ctx.scaleX),
      track('scaleY', ctx.scaleY * 0.45, ctx.scaleY),
      track('alpha', 0, 1),
    ],
  }),
  zoomOut: (_p, ctx) => ({
    channels: [
      track('scaleX', ctx.scaleX, ctx.scaleX * 1.45),
      track('scaleY', ctx.scaleY, ctx.scaleY * 1.45),
      track('alpha', ctx.alpha, 0),
    ],
  }),
  punch: (_p, ctx) => ({
    clock: 'raw',
    easing: 'linear',
    channels: [
      keys('scaleX', [[0, ctx.scaleX], [0.35, ctx.scaleX * 1.18], [0.7, ctx.scaleX * 0.94], [1, ctx.scaleX]]),
      keys('scaleY', [[0, ctx.scaleY], [0.35, ctx.scaleY * 1.18], [0.7, ctx.scaleY * 0.94], [1, ctx.scaleY]]),
    ],
  }),
  spin: (p, ctx) => ({
    easing: 'quadInOut',
    channels: [track('rotation', ctx.rotation, ctx.rotation + num(p, 'degree', 360))],
  }),
  rotateTo: (p, ctx) => ({ channels: [track('rotation', ctx.rotation, num(p, 'degree', 30))] }),
  skewTo: (p) => ({ channels: [track('skew', 0, num(p, 'degree', 18))] }),
  bounceIn: (p, ctx) => ({
    easing: 'bounceOut',
    reveal: 'alpha',
    channels: [
      track('y', ctx.y - num(p, 'height', ctx.height * 0.22), ctx.y),
      track('alpha', 0, 1),
    ],
  }),
  jump: (_p, ctx) => ({
    clock: 'raw',
    easing: 'linear',
    channels: [
      keys('y', [[0, ctx.y], [0.18, ctx.y], [0.45, ctx.y - 120], [0.72, ctx.y], [1, ctx.y]]),
      keys('scaleY', [[0, ctx.scaleY], [0.18, ctx.scaleY * 0.72], [0.45, ctx.scaleY * 1.12], [0.72, ctx.scaleY * 0.82], [1, ctx.scaleY]]),
      keys('scaleX', [[0, ctx.scaleX], [0.18, ctx.scaleX * 1.18], [0.45, ctx.scaleX * 0.92], [0.72, ctx.scaleX * 1.1], [1, ctx.scaleX]]),
    ],
  }),
  shake: (p) => ({
    clock: 'raw',
    channels: [
      osc('x', num(p, 'amount', 10), num(p, 'frequency', 10), true),
      osc('y', num(p, 'amount', 6), num(p, 'frequency', 8), true),
    ],
  }),
  bezierPath: (p, ctx) => {
    const x1 = num(p, 'x', ctx.x + 140);
    const y1 = num(p, 'y', ctx.y);
    return {
      channels: [{
        type: 'bezier',
        x0: ctx.x,
        y0: ctx.y,
        cx: num(p, 'cx', (ctx.x + x1) / 2),
        cy: num(p, 'cy', Math.min(ctx.y, y1) - 160),
        x1,
        y1,
      }],
    };
  },
  camPan: (p, ctx) => ({
    channels: [
      track('camX', ctx.camX, num(p, 'x', ctx.camX + 80)),
      track('camY', ctx.camY, num(p, 'y', ctx.camY)),
    ],
  }),
  camZoom: (p, ctx) => ({ channels: [track('camZoom', ctx.camZoom, num(p, 'zoom', num(p, 'amount', 1.2)))] }),
  camRotate: (p, ctx) => ({ channels: [track('camRot', ctx.camRot, num(p, 'degree', 4))] }),
  camShake: (p) => ({
    clock: 'raw',
    channels: [
      osc('camX', num(p, 'amount', 8), 12, true),
      osc('camY', num(p, 'amount', 5) * 0.6, 9, true),
    ],
  }),
  kenBurns: (p, ctx) => ({
    clock: 'raw',
    easing: 'linear',
    channels: ctx.role === 'camera' || ctx.role === 'fx'
      ? [
          track('camZoom', ctx.camZoom, ctx.camZoom * num(p, 'zoom', 1.08)),
          track('camX', ctx.camX, ctx.camX + num(p, 'x', -40)),
          track('camY', ctx.camY, ctx.camY + num(p, 'y', -18)),
        ]
      : [
          track('scaleX', ctx.scaleX, ctx.scaleX * num(p, 'zoom', 1.08)),
          track('scaleY', ctx.scaleY, ctx.scaleY * num(p, 'zoom', 1.08)),
          track('x', ctx.x, ctx.x + num(p, 'x', -30)),
        ],
  }),
  letterbox: (p, ctx) => ({ channels: [track('letterbox', ctx.letterbox, num(p, 'amount', 80))] }),
  brightness: (p) => ({ channels: [track('brightness', 1, num(p, 'value', num(p, 'amount', 1.35)))] }),
  contrast: (p) => ({ channels: [track('contrast', 1, num(p, 'value', num(p, 'amount', 1.35)))] }),
  saturate: (p) => ({ channels: [track('saturation', 1, num(p, 'value', num(p, 'amount', 1.7)))] }),
  hue: (p) => ({ channels: [track('hue', 0, num(p, 'degree', num(p, 'amount', 40)))] }),
  exposure: (p) => ({ channels: [track('exposure', 0, num(p, 'value', num(p, 'amount', 0.45)))] }),
  sepia: () => ({ channels: [track('sepia', 0, 1)] }),
  grayscale: () => ({ channels: [track('saturation', 1, 0)] }),
  invert: () => ({ channels: [track('invert', 0, 1)] }),
  posterize: (p) => ({ channels: [track('posterize', 16, num(p, 'levels', 4))] }),
  vignette: (p) => ({ channels: [track('vignette', 0, num(p, 'amount', 0.75))] }),
  grain: (p) => ({ channels: [track('grain', 0, num(p, 'amount', 0.45))] }),
  gradientMap: () => ({ channels: [track('gradientMap', 0, 1)] }),
  blur: (p) => ({ channels: [track('blur', 0, num(p, 'amount', 8))] }),
  motionBlur: (p) => ({ channels: [track('motion', 0, num(p, 'amount', 28))] }),
  radialBlur: (p) => ({ channels: [track('radialBlur', 0, num(p, 'amount', 12))] }),
  glow: (p) => ({ channels: [track('glow', 0, num(p, 'amount', 3))] }),
  bloom: (p) => ({ channels: [track('bloom', 0, num(p, 'amount', 2.2))] }),
  chromaticAberration: (p) => ({ channels: [track('chroma', 0, num(p, 'amount', 8))] }),
  dropShadow: (p) => ({ channels: [track('shadow', 0, num(p, 'amount', 1))] }),
  wave: (p) => ({
    clock: 'raw',
    channels: [osc('skew', num(p, 'amount', 8), 2, false), track('wave', 0, 1)],
  }),
  ripple: (p) => ({ channels: [track('ripple', 0, num(p, 'amount', 1))] }),
  bulge: (p) => ({ channels: [track('bulge', 0, num(p, 'amount', 0.55))] }),
  glitch: (p) => ({ clock: 'raw', channels: [track('glitch', 0, num(p, 'amount', 1))] }),
  pixelate: (p) => ({ channels: [track('pixelate', 1, num(p, 'amount', 14))] }),
  displacement: (p) => ({ channels: [track('displace', 0, num(p, 'amount', 36))] }),
  blend: (p) => ({ blocking: false, blend: str(p, 'mode', 'add'), channels: [] }),
  maskRect: (p, ctx) => maskReveal('wipe', p, ctx),
  maskGradient: (p, ctx) => maskReveal('gradient', p, ctx),
  focusDim: (p) => ({ blocking: false, focusDim: num(p, 'amount', 0.45), channels: [] }),
  typewriter: () => ({ blocking: false, textMode: 'typewriter', channels: [] }),
  textFade: () => ({ blocking: false, textMode: 'textFade', channels: [] }),
  textShake: () => ({ blocking: false, textMode: 'textShake', channels: [] }),
  customShader: (p) => ({
    custom: true,
    customSource: str(p, 'fragment', str(p, 'source', '')),
    channels: [track('shaderMix', 0, num(p, 'uAmount', 1))],
  }),
};

for (const name of ['rain', 'snow', 'petals', 'sparkle', 'embers']) {
  BUILDERS[name] = () => ({ blocking: false, particle: name, channels: [] });
}

export function coveredPresetNames(): string[] {
  return Object.keys(BUILDERS);
}

export function defaultContext(role: Role): EffectContext {
  return {
    role,
    width: 1920,
    height: 1080,
    x: 960,
    y: 980,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    alpha: 1,
    camX: 0,
    camY: 0,
    camZoom: 1,
    camRot: 0,
    letterbox: 0,
  };
}

export function planEffect(
  name: string,
  params: Record<string, ParamValue>,
  ctx: EffectContext,
): AnimationPlan {
  const preset = resolvePreset(name, ctx.role);
  const build = BUILDERS[preset];
  if (!build) throw new Error(`未知の演出: ${name}`);
  const extra = build(params, ctx);
  return {
    preset,
    duration: typeof params.duration === 'number' ? params.duration : defaultDuration(preset),
    delay: typeof params.delay === 'number' ? params.delay : 0,
    loopCount: typeof params.count === 'number' ? params.count : params.loop === true ? 2 : 1,
    clock: extra.clock ?? 'eased',
    easing: typeof params.easing === 'string' ? params.easing : extra.easing ?? 'quadOut',
    channels: extra.channels ?? [],
    reveal: extra.reveal ?? 'none',
    direction: typeof params.direction === 'string' ? params.direction : extra.direction ?? 'left',
    blend: extra.blend,
    particle: extra.particle,
    textMode: extra.textMode,
    focusDim: extra.focusDim,
    overlay: extra.overlay,
    custom: extra.custom ?? false,
    customSource: typeof params.fragment === 'string'
      ? params.fragment
      : typeof params.source === 'string'
        ? params.source
        : extra.customSource ?? '',
    blocking: extra.blocking ?? true,
  };
}
