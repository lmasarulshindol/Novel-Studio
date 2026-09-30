import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { asciiSlug, resolveSourceFile, sanitizeProductName, stageGame } from '../scripts/lib/stage-game.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleDir = path.join(root, 'projects', 'sample');

describe('作品の書き出し', () => {
  it('作品名からファイルに使えない文字を除く', () => {
    expect(sanitizeProductName('見本：放課後の演出')).toBe('見本 放課後の演出');
    expect(sanitizeProductName('   ')).toBe('ノベル');
  });

  it('日本語の作品名でも衝突しにくいIDになる', () => {
    const a = asciiSlug('見本：放課後の演出');
    const b = asciiSlug('別の作品');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[\w-]+$/);
  });

  it('見本の公開パスをプロジェクト内のファイルへ解決する', () => {
    const found = resolveSourceFile(sampleDir, 'sample/backgrounds/classroom_day.png', [path.join(root, 'projects')]);
    expect(found && fs.existsSync(found)).toBe(true);
  });

  it('見本をプレイヤー用フォルダへまとめる', () => {
    const project = JSON.parse(fs.readFileSync(path.join(sampleDir, 'project.json'), 'utf8')) as { script?: string; scriptFile?: string };
    project.script = fs.readFileSync(path.join(sampleDir, 'script.txt'), 'utf8');
    const payload = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-stage-'));
    const staged = stageGame({
      projectDir: sampleDir,
      project,
      payloadDir: payload,
      searchRoots: [path.join(root, 'projects')],
    });
    const written = JSON.parse(fs.readFileSync(path.join(payload, 'project.json'), 'utf8')) as {
      script?: string;
      scriptFile: string;
      assets: { backgrounds: { src: string }[] };
    };
    expect(staged.productName).toBe('見本 放課後の演出');
    expect(written.script).toBeUndefined();
    expect(fs.existsSync(path.join(payload, written.scriptFile))).toBe(true);
    expect(fs.existsSync(path.join(payload, written.assets.backgrounds[0].src))).toBe(true);
    fs.rmSync(payload, { recursive: true, force: true });
  });
});
