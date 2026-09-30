export type ParamValue = string | number | boolean;

export type EffectSpec = {
  preset: string;
  params: Record<string, ParamValue>;
};

export type CommandBase = {
  line: number;
  source: string;
  parallelNext: boolean;
};

export type ChoiceOption = {
  text: string;
  target: string;
};

export type Command =
  | (CommandBase & { type: 'label'; name: string })
  | (CommandBase & { type: 'bg'; id: string; variant?: string; effect?: EffectSpec })
  | (CommandBase & { type: 'show'; character: string; expr: string; at: string; effect?: EffectSpec })
  | (CommandBase & { type: 'place'; character: string; at: string })
  | (CommandBase & { type: 'hide'; character: string; effect?: EffectSpec })
  | (CommandBase & { type: 'expr'; character: string; expr: string; effect?: EffectSpec })
  | (CommandBase & { type: 'cg'; id: string; effect?: EffectSpec })
  | (CommandBase & { type: 'fx'; target: string; effect: EffectSpec })
  | (CommandBase & { type: 'camera'; effect: EffectSpec })
  | (CommandBase & { type: 'transition'; effect: EffectSpec })
  | (CommandBase & { type: 'particle'; effect: EffectSpec })
  | (CommandBase & { type: 'play'; channel: 'bgm' | 'se' | 'voice'; id: string; loop: boolean; fade: number })
  | (CommandBase & { type: 'stop'; channel: 'bgm' | 'se' | 'voice'; fade: number })
  | (CommandBase & { type: 'dialogue'; speaker: string; text: string; effect?: EffectSpec })
  | (CommandBase & { type: 'wait'; duration: number })
  | (CommandBase & { type: 'choice'; options: ChoiceOption[] })
  | (CommandBase & { type: 'jump'; target: string })
  | (CommandBase & { type: 'set'; name: string; value: ParamValue })
  | (CommandBase & {
      type: 'if';
      name: string;
      op?: string;
      value?: ParamValue;
      target: string;
    });

export type Program = {
  commands: Command[];
  labels: Record<string, number>;
  errors: { line: number; message: string }[];
};

export type Value = ParamValue;

export function coerceParam(raw: string): ParamValue {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}
