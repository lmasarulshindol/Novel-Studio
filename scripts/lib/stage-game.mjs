import fs from 'node:fs';
import path from 'node:path';

const ASSET_PREFIX = 'novel-asset://local/';

export function sanitizeProductName(name) {
  const cleaned = String(name || 'ノベル')
    .replace(/[\\/:*?"<>|：＊？＂＜＞｜＼／]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return cleaned || 'ノベル';
}

export function asciiSlug(name) {
  const base = String(name || 'game').replace(/[^\w]+/g, '').slice(0, 24);
  let hash = 0;
  for (const ch of String(name || 'game')) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  return `${base || 'NovelGame'}-${hash.toString(16)}`;
}

export function decodeAssetUrl(src) {
  if (src.startsWith(ASSET_PREFIX)) return decodeURIComponent(src.slice(ASSET_PREFIX.length));
  return src;
}

export function resolveSourceFile(projectDir, src, searchRoots = []) {
  if (!src || src.startsWith('blob:') || src.startsWith('data:') || /^https?:/.test(src)) return null;
  const raw = decodeAssetUrl(src).replace(/^\/+/, '');
  const candidates = [];
  if (path.isAbsolute(raw)) candidates.push(raw);
  if (projectDir) {
    candidates.push(path.join(projectDir, raw));
    const base = path.basename(projectDir);
    if (raw.startsWith(`${base}/`)) candidates.push(path.join(projectDir, raw.slice(base.length + 1)));
  }
  for (const root of searchRoots) candidates.push(path.join(root, raw));
  return candidates.find((file) => {
    try {
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

function relativeInside(payloadDir, found, projectDir) {
  if (projectDir) {
    const rel = path.relative(projectDir, found);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel;
  }
  const inside = path.relative(payloadDir, found);
  if (inside && !inside.startsWith('..') && !path.isAbsolute(inside)) return inside;
  return path.join('assets', path.basename(found));
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'release' || entry.name === 'node_modules') continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

export function stageGame({ projectDir, project, payloadDir, searchRoots = [] }) {
  fs.rmSync(payloadDir, { recursive: true, force: true });
  fs.mkdirSync(payloadDir, { recursive: true });
  if (projectDir && fs.existsSync(projectDir)) copyDir(projectDir, payloadDir);

  const copy = structuredClone(project);
  const missing = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value.src === 'string' && value.src) {
      if (value.src.startsWith('blob:') || value.src.startsWith('data:')) {
        missing.push(value.src);
        return;
      }
      const found = resolveSourceFile(projectDir, value.src, searchRoots);
      if (!found) {
        missing.push(value.src);
        return;
      }
      const relative = relativeInside(payloadDir, found, projectDir);
      const dest = path.join(payloadDir, relative);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (path.resolve(found) !== path.resolve(dest)) fs.copyFileSync(found, dest);
      value.src = relative.replace(/\\/g, '/');
    }
    Object.values(value).forEach(visit);
  };
  visit(copy);
  if (missing.length) {
    const unsaved = missing.some((item) => item.startsWith('blob:') || item.startsWith('data:'));
    if (unsaved) throw new Error('未保存の素材があります。プロジェクトを保存してからインストーラを作成してください。');
    throw new Error(`素材が見つかりません: ${missing.slice(0, 5).join(', ')}`);
  }
  const script = typeof copy.script === 'string' ? copy.script : '';
  fs.writeFileSync(path.join(payloadDir, 'script.txt'), script, 'utf8');
  copy.scriptFile = 'script.txt';
  delete copy.script;
  fs.writeFileSync(path.join(payloadDir, 'project.json'), JSON.stringify(copy, null, 2), 'utf8');
  return { productName: sanitizeProductName(copy.name), slug: asciiSlug(copy.name) };
}
