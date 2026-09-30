export const EASING_NAMES = [
  'linear',
  'quadIn',
  'quadOut',
  'quadInOut',
  'cubicIn',
  'cubicOut',
  'cubicInOut',
  'sineIn',
  'sineOut',
  'sineInOut',
  'expoIn',
  'expoOut',
  'expoInOut',
  'circIn',
  'circOut',
  'circInOut',
  'backIn',
  'backOut',
  'backInOut',
  'elasticIn',
  'elasticOut',
  'elasticInOut',
  'bounceIn',
  'bounceOut',
  'bounceInOut',
] as const;

export type EasingName = (typeof EASING_NAMES)[number];

const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;
const c5 = (2 * Math.PI) / 4.5;

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

function elasticOut(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function elasticIn(t: number): number {
  if (t === 0 || t === 1) return t;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
}

const fns: Record<string, (t: number) => number> = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  sineIn: (t) => 1 - Math.cos((t * Math.PI) / 2),
  sineOut: (t) => Math.sin((t * Math.PI) / 2),
  expoIn: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  expoOut: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  circIn: (t) => 1 - Math.sqrt(1 - t * t),
  circOut: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  backIn: (t) => c3 * t * t * t - c1 * t * t,
  backOut: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  elasticIn,
  elasticOut,
  bounceIn: (t) => 1 - bounceOut(1 - t),
  bounceOut,
};

function inOut(t: number, inn: (t: number) => number, out: (t: number) => number): number {
  return t < 0.5 ? inn(t * 2) / 2 : out(t * 2 - 1) / 2 + 0.5;
}

fns.quadInOut = (t) => inOut(t, fns.quadIn, fns.quadOut);
fns.cubicInOut = (t) => inOut(t, fns.cubicIn, fns.cubicOut);
fns.sineInOut = (t) => inOut(t, fns.sineIn, fns.sineOut);
fns.expoInOut = (t) => inOut(t, fns.expoIn, fns.expoOut);
fns.circInOut = (t) => inOut(t, fns.circIn, fns.circOut);
fns.backInOut = (t) => {
  if (t < 0.5) return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
  return (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
};
fns.elasticInOut = (t) => {
  if (t === 0 || t === 1) return t;
  return t < 0.5
    ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
    : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
};
fns.bounceInOut = (t) => (t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2);

export function ease(name: string, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  const fn = fns[name] ?? fns.linear;
  return fn(x);
}
