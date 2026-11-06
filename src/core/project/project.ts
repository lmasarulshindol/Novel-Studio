import { normalizeTextFrame, type TextFrameId } from './text-frame';

export type MediaAsset = {
  id: string;
  src: string;
  variant?: string;
};

export type ExpressionAsset = {
  id: string;
  src: string;
};

export type CharacterAsset = {
  id: string;
  name: string;
  expressions: ExpressionAsset[];
};

/** タイトルから選べるヒロインルート（任意・後方互換） */
export type ProjectRoute = {
  id: string;
  label: string;
  age: number;
  blurb: string;
  startLabel: string;
  hLabel: string;
  portrait?: string;
};

export type Project = {
  name: string;
  width: number;
  height: number;
  script: string;
  textFrame: TextFrameId;
  title: {
    background: string;
    backgroundVariant?: string;
    logo: string;
    bgm?: string;
  };
  assets: {
    backgrounds: MediaAsset[];
    characters: CharacterAsset[];
    bgm: MediaAsset[];
    se: MediaAsset[];
    voice: MediaAsset[];
    cgs: MediaAsset[];
    ui: MediaAsset[];
    shaders: MediaAsset[];
  };
  routes?: ProjectRoute[];
};

export type AssetDraft =
  | { kind: 'background'; id: string; variant?: string; src: string }
  | { kind: 'character'; id: string; name: string; expr: string; src: string }
  | { kind: 'bgm' | 'se' | 'voice' | 'cg' | 'ui' | 'shader'; id: string; src: string };

export function createEmptyProject(): Project {
  return normalizeProject({
    name: '無題',
    script: '# start\n「語り」 こんにちは。\n',
  });
}

function normalizeRoutes(raw: unknown): ProjectRoute[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const routes: ProjectRoute[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<ProjectRoute>;
    const id = String(row.id ?? '').trim();
    const label = String(row.label ?? '').trim();
    const startLabel = String(row.startLabel ?? '').trim();
    const hLabel = String(row.hLabel ?? '').trim();
    if (!id || !label || !startLabel || !hLabel) continue;
    const age = Number(row.age);
    routes.push({
      id,
      label,
      age: Number.isFinite(age) ? age : 0,
      blurb: String(row.blurb ?? '').trim(),
      startLabel,
      hLabel,
      portrait: row.portrait ? String(row.portrait).trim() : undefined,
    });
  }
  return routes.length ? routes : undefined;
}

export function normalizeProject(raw: unknown): Project {
  const source = (raw ?? {}) as Partial<Project> & { scriptFile?: string };
  const assets = source.assets ?? {
    backgrounds: [],
    characters: [],
    bgm: [],
    se: [],
    voice: [],
    cgs: [],
    ui: [],
    shaders: [],
  };
  const routes = normalizeRoutes(source.routes);
  const project: Project = {
    name: source.name || '無題',
    width: source.width || 1920,
    height: source.height || 1080,
    script: source.script || '',
    textFrame: normalizeTextFrame(source.textFrame),
    title: {
      background: source.title?.background || '',
      backgroundVariant: source.title?.backgroundVariant,
      logo: source.title?.logo || '',
      bgm: source.title?.bgm,
    },
    assets: {
      backgrounds: assets.backgrounds ?? [],
      characters: assets.characters ?? [],
      bgm: assets.bgm ?? [],
      se: assets.se ?? [],
      voice: assets.voice ?? [],
      cgs: assets.cgs ?? [],
      ui: assets.ui ?? [],
      shaders: assets.shaders ?? [],
    },
  };
  if (routes) project.routes = routes;
  return project;
}

export function addAsset(project: Project, draft: AssetDraft): Project {
  const next = structuredClone(project);
  if (draft.kind === 'background') {
    const existing = next.assets.backgrounds.find((item) => item.id === draft.id && item.variant === draft.variant);
    if (existing) existing.src = draft.src;
    else next.assets.backgrounds.push({ id: draft.id, variant: draft.variant, src: draft.src });
    return next;
  }
  if (draft.kind === 'character') {
    let character = next.assets.characters.find((item) => item.id === draft.id);
    if (!character) {
      character = { id: draft.id, name: draft.name || draft.id, expressions: [] };
      next.assets.characters.push(character);
    }
    if (draft.name) character.name = draft.name;
    const expression = character.expressions.find((item) => item.id === draft.expr);
    if (expression) expression.src = draft.src;
    else character.expressions.push({ id: draft.expr, src: draft.src });
    return next;
  }
  const bucket = draft.kind === 'bgm' ? next.assets.bgm
    : draft.kind === 'se' ? next.assets.se
      : draft.kind === 'voice' ? next.assets.voice
        : draft.kind === 'cg' ? next.assets.cgs
          : draft.kind === 'ui' ? next.assets.ui
            : next.assets.shaders;
  const existing = bucket.find((item) => item.id === draft.id);
  if (existing) existing.src = draft.src;
  else bucket.push({ id: draft.id, src: draft.src });
  return next;
}

export function findBackground(project: Project, id: string, variant?: string): MediaAsset | undefined {
  const list = project.assets.backgrounds;
  if (variant) {
    return list.find((item) => item.id === id && item.variant === variant)
      ?? list.find((item) => item.id === `${id}_${variant}`)
      ?? list.find((item) => item.id === id);
  }
  return list.find((item) => item.id === id && !item.variant) ?? list.find((item) => item.id === id);
}

export function findCharacter(project: Project, id: string): CharacterAsset | undefined {
  return project.assets.characters.find((item) => item.id === id);
}

export function findByName(project: Project, name: string): CharacterAsset | undefined {
  return project.assets.characters.find((item) => item.name === name || item.id === name);
}

export function findExpression(project: Project, id: string, expr: string): ExpressionAsset | undefined {
  return findCharacter(project, id)?.expressions.find((item) => item.id === expr)
    ?? findCharacter(project, id)?.expressions[0];
}

export function findAudio(project: Project, channel: 'bgm' | 'se' | 'voice', id: string): MediaAsset | undefined {
  const list = channel === 'bgm' ? project.assets.bgm : channel === 'se' ? project.assets.se : project.assets.voice;
  return list.find((item) => item.id === id);
}

/** 声のパック名があれば `パック_id` を優先し、無ければ元のボイスに戻す。 */
export function findVoice(project: Project, id: string, pack?: string): MediaAsset | undefined {
  const named = pack?.trim();
  if (named && named !== 'gemini') {
    const packed = findAudio(project, 'voice', `${named}_${id}`);
    if (packed) return packed;
  }
  return findAudio(project, 'voice', id);
}

export function findCg(project: Project, id: string): MediaAsset | undefined {
  return project.assets.cgs.find((item) => item.id === id);
}

export function findUi(project: Project, id: string): MediaAsset | undefined {
  return project.assets.ui.find((item) => item.id === id);
}

/** ルートカード用。UI id、`キャラ/表情`、表情 src のいずれか */
export function resolveRoutePortrait(project: Project, portrait?: string): string | undefined {
  if (!portrait?.trim()) return undefined;
  const key = portrait.trim();
  const ui = findUi(project, key);
  if (ui?.src) return mediaUrl(ui.src);
  const slash = key.indexOf('/');
  if (slash >= 0) {
    const charId = key.slice(0, slash);
    const exprId = key.slice(slash + 1);
    const expr = findExpression(project, charId, exprId);
    if (expr?.src) return mediaUrl(expr.src);
  }
  for (const character of project.assets.characters) {
    for (const expression of character.expressions) {
      if (expression.id === key || expression.src === key) return mediaUrl(expression.src);
    }
  }
  const character = findCharacter(project, key);
  if (character?.expressions[0]?.src) return mediaUrl(character.expressions[0].src);
  return undefined;
}

export function findShader(project: Project, id: string): MediaAsset | undefined {
  return project.assets.shaders.find((item) => item.id === id);
}

export function mediaUrl(src: string): string {
  if (!src) return '';
  if (/^(https?:|blob:|data:|novel-asset:)/.test(src)) return src;
  if (/^[a-zA-Z]:[\\/]/.test(src)) return `novel-asset://local/${encodeURI(src.replace(/\\/g, '/'))}`;
  if (src.startsWith('/')) return src;
  return `/${src.replace(/^\/+/, '')}`;
}

export async function loadProjectUrl(url: string): Promise<Project> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`プロジェクトを読めません: ${url}`);
  const raw = await response.json() as { script?: string; scriptFile?: string };
  const project = normalizeProject(raw);
  if (!project.script && raw.scriptFile) {
    const base = url.replace(/[^/]+$/, '');
    const script = await fetch(`${base}${raw.scriptFile}`);
    if (!script.ok) throw new Error(`シナリオを読めません: ${raw.scriptFile}`);
    project.script = await script.text();
  }
  return project;
}
