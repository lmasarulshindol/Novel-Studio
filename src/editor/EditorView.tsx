import { useEffect, useMemo, useRef, useState } from 'react';
import { PRESETS, PRESET_KIND_LABELS, getPreset, resolvePreset, templateFor, type Role } from '../core/effects/catalog';
import { addAsset, mediaUrl, type AssetDraft, type Project } from '../core/project/project';
import { parseScenario, updateLineParam } from '../core/scenario/parser';
import type { Command } from '../core/scenario/types';
import { PlaybackController, type PlayView } from '../player/PlaybackController';
import type { GameSettings } from '../core/settings';

export function EditorView({
  project,
  projectDir,
  settings,
  onProject,
  onPlay,
  onPreviewWindow,
}: {
  project: Project;
  projectDir: string | null;
  settings: GameSettings;
  onProject: (project: Project) => void;
  onPlay: () => void;
  onPreviewWindow: () => void;
}) {
  const program = useMemo(() => parseScenario(project.script), [project.script]);
  const [line, setLine] = useState(1);
  const [kind, setKind] = useState<AssetDraft['kind']>('background');
  const [assetId, setAssetId] = useState('room');
  const [extra, setExtra] = useState('day');
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<PlaybackController | null>(null);
  const [view, setView] = useState<PlayView | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const [pendingLine, setPendingLine] = useState<number | null>(null);

  useEffect(() => () => preview?.destroy(), [preview]);
  useEffect(() => () => previewAudio.current?.pause(), []);
  useEffect(() => {
    if (pendingLine == null) return;
    focusLine(areaRef.current, pendingLine);
    setPendingLine(null);
  }, [pendingLine, project.script]);

  const selected = program.commands.find((command) => command.line === line);
  const effect = selected && 'effect' in selected ? selected.effect : undefined;

  const playPreview = () => {
    if (!host) return;
    preview?.destroy();
    const playback = new PlaybackController(host, project, settings);
    playback.setListener((next) => {
      setView(next);
      setLine(next.line);
      focusLine(areaRef.current, next.line);
    });
    setPreview(playback);
    void playback.start('new');
  };

  const stopPreview = () => {
    preview?.destroy();
    setPreview(null);
    setView(null);
  };

  const add = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !assetId.trim()) return;
    let src = URL.createObjectURL(file);
    if (window.novelStudio && projectDir) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      src = await window.novelStudio.importAsset(projectDir, subdir(kind), file.name, bytes);
    }
    const draft: AssetDraft = kind === 'background'
      ? { kind, id: assetId.trim(), variant: extra.trim() || undefined, src }
      : kind === 'character'
        ? { kind, id: assetId.trim(), name: extra.trim() || assetId.trim(), expr: 'smile', src }
        : { kind, id: assetId.trim(), src };
    onProject(addAsset(project, draft));
    if (fileRef.current) fileRef.current.value = '';
  };

  const listen = (src: string, loop: boolean) => {
    previewAudio.current?.pause();
    const audio = new Audio(mediaUrl(src));
    audio.loop = loop;
    audio.volume = loop ? settings.bgm : settings.se;
    previewAudio.current = audio;
    void audio.play().catch(() => undefined);
  };

  const insertSnippet = (snippet: string) => {
    const area = areaRef.current;
    const text = snippet.endsWith('\n') ? snippet : `${snippet}\n`;
    if (!area) {
      onProject({ ...project, script: `${project.script.replace(/\s*$/, '')}\n${text}` });
      return;
    }
    const start = area.selectionStart;
    const next = `${project.script.slice(0, start)}${text}${project.script.slice(start)}`;
    setPendingLine(project.script.slice(0, start).split('\n').length);
    onProject({ ...project, script: next });
  };

  const labels = program.commands.filter((command) => command.type === 'label');
  const explained = effect ? getPreset(resolvePreset(effect.preset, roleFor(selected))) : undefined;
  const kinds = [...new Set(PRESETS.map((preset) => preset.kind))];

  return (
    <div className="editor">
      <header className="topbar">
        <strong>ノベルスタジオ</strong>
        <span>{project.name}</span>
        <button type="button" onClick={onPlay}>本編を再生</button>
        <button type="button" onClick={onPreviewWindow}>ウィンドウでプレビュー</button>
      </header>
      <div className="editor-body">
        <aside>
          <h2>素材</h2>
          <ul className="asset-list">
            {project.assets.backgrounds.map((item) => (
              <li key={`${item.id}-${item.variant}`} className="asset-row">
                <img className="asset-thumb" src={mediaUrl(item.src)} alt="" />
                <span>背景 {item.id} {item.variant}</span>
              </li>
            ))}
            {project.assets.characters.map((item) => (
              <li key={item.id} className="asset-row">
                {item.expressions[0] ? <img className="asset-thumb" src={mediaUrl(item.expressions[0].src)} alt="" /> : <span className="asset-thumb" />}
                <span>人物 {item.name}（{item.expressions.map((expr) => expr.id).join(' / ')}）</span>
              </li>
            ))}
            {project.assets.cgs.map((item) => (
              <li key={item.id} className="asset-row">
                <img className="asset-thumb" src={mediaUrl(item.src)} alt="" />
                <span>CG {item.id}</span>
              </li>
            ))}
            {project.assets.bgm.map((item) => (
              <AudioAsset key={item.id} label={`BGM ${item.id}`} onListen={() => listen(item.src, true)} onInsert={() => insertSnippet(`play bgm ${item.id} loop fade=1.2`)} />
            ))}
            {project.assets.se.map((item) => (
              <AudioAsset key={`se-${item.id}`} label={`SE ${item.id}`} onListen={() => listen(item.src, false)} onInsert={() => insertSnippet(`play se ${item.id}`)} />
            ))}
            {project.assets.voice.map((item) => (
              <AudioAsset key={`voice-${item.id}`} label={`ボイス ${item.id}`} onListen={() => listen(item.src, false)} onInsert={() => insertSnippet(`play voice ${item.id}`)} />
            ))}
          </ul>
          <label>種類
            <select value={kind} onChange={(event) => setKind(event.target.value as AssetDraft['kind'])}>
              <option value="background">背景</option>
              <option value="character">人物</option>
              <option value="bgm">BGM</option>
              <option value="se">効果音</option>
              <option value="voice">ボイス</option>
              <option value="cg">CG</option>
              <option value="ui">タイトル画像</option>
            </select>
          </label>
          <label>ID<input value={assetId} onChange={(event) => setAssetId(event.target.value)} /></label>
          <label>{kind === 'character' ? '表示名' : 'バリアント'}<input value={extra} onChange={(event) => setExtra(event.target.value)} /></label>
          <input ref={fileRef} type="file" accept="image/*,audio/mpeg,audio/ogg,audio/wav,audio/mp4,.mp3,.ogg,.wav,.m4a,.frag,.glsl" />
          <button type="button" onClick={() => void add()}>素材を追加</button>
          <p className="hint">画像に加えて mp3 / ogg / wav を置けます。ブラウザでは追加した素材はこのセッション中だけ使えます。</p>
        </aside>
        <section className="script-pane">
          <div className="script-tools">
            {labels.length ? (
              <div className="label-list">
                {labels.map((command) => (
                  <button key={`${command.name}-${command.line}`} type="button" onClick={() => { setLine(command.line); focusLine(areaRef.current, command.line); }}>#{command.name}</button>
                ))}
              </div>
            ) : null}
            <select defaultValue="" onChange={(event) => {
              const name = event.target.value;
              if (!name) return;
              insertSnippet(templateFor(name));
              event.target.value = '';
            }}>
              <option value="">演出を挿入</option>
              {PRESETS.map((preset) => <option key={preset.name} value={preset.name}>{preset.label}</option>)}
            </select>
            <details className="effect-guide">
              <summary>演出の説明（{PRESETS.length}）</summary>
              {kinds.map((kind) => (
                <section key={kind}>
                  <h3>{PRESET_KIND_LABELS[kind]}</h3>
                  {PRESETS.filter((preset) => preset.kind === kind).map((preset) => (
                    <div key={preset.name} className="effect-item">
                      <strong>{preset.label}</strong>
                      <p>{preset.detail}</p>
                      <button type="button" onClick={() => insertSnippet(templateFor(preset.name))}>この行を挿入</button>
                    </div>
                  ))}
                </section>
              ))}
            </details>
          </div>
          <textarea
            ref={areaRef}
            spellCheck={false}
            value={project.script}
            onChange={(event) => onProject({ ...project, script: event.target.value })}
            onClick={(event) => setLine(lineNumber(event.currentTarget))}
            onKeyUp={(event) => setLine(lineNumber(event.currentTarget))}
          />
          {program.errors.length ? <p className="error-line">{program.errors.map((error) => `${error.line}行: ${error.message}`).join(' / ')}</p> : null}
        </section>
        <aside className="preview-pane">
          <div className="stage-host preview" ref={setHost} />
          <div className="preview-controls">
            <button type="button" onClick={playPreview}>プレビュー再生</button>
            <button type="button" onClick={stopPreview}>停止</button>
          </div>
          {view ? <p className="preview-line">{view.speaker} {view.typed}</p> : null}
          <ol className="command-list">
            {program.commands.filter((command) => command.type !== 'label').map((command, index) => (
              <li key={`${command.line}-${index}`} className={command.line === view?.line ? 'current' : ''}>
                <button type="button" onClick={() => { setLine(command.line); focusLine(areaRef.current, command.line); }}>{command.line}. {command.source}</button>
              </li>
            ))}
          </ol>
          {effect ? (
            <div className="inspector">
              <h2>演出 {explained?.label ?? effect.preset}</h2>
              {explained ? <p className="hint">{explained.detail}</p> : null}
              <label>duration
                <input
                  value={String(effect.params.duration ?? '')}
                  onChange={(event) => onProject({ ...project, script: updateLineParam(project.script, line, 'duration', event.target.value || '0.5') })}
                />
              </label>
              <label>easing
                <input
                  value={String(effect.params.easing ?? '')}
                  onChange={(event) => onProject({ ...project, script: updateLineParam(project.script, line, 'easing', event.target.value || 'quadOut') })}
                />
              </label>
              <label>amount
                <input
                  value={String(effect.params.amount ?? '')}
                  onChange={(event) => onProject({ ...project, script: updateLineParam(project.script, line, 'amount', event.target.value || '1') })}
                />
              </label>
            </div>
          ) : <p className="hint">{selected ? 'この行に演出パラメータはありません。' : '行を選ぶとパラメータを編集できます。'}</p>}
        </aside>
      </div>
    </div>
  );
}

function roleFor(command: Command | undefined): Role {
  if (!command) return 'fx';
  if (command.type === 'bg' || command.type === 'transition') return 'bg';
  if (command.type === 'show') return 'show';
  if (command.type === 'hide') return 'hide';
  if (command.type === 'expr') return 'expr';
  if (command.type === 'cg') return 'cg';
  if (command.type === 'camera') return 'camera';
  if (command.type === 'particle') return 'particle';
  if (command.type === 'dialogue') return 'text';
  return 'fx';
}

function AudioAsset({ label, onListen, onInsert }: { label: string; onListen: () => void; onInsert: () => void }) {
  return (
    <li className="asset-row audio">
      <span>{label}</span>
      <span className="asset-actions">
        <button type="button" onClick={onListen}>聴く</button>
        <button type="button" onClick={onInsert}>挿入</button>
      </span>
    </li>
  );
}

function subdir(kind: AssetDraft['kind']): string {
  if (kind === 'background') return 'backgrounds';
  if (kind === 'character') return 'chars';
  if (kind === 'cg') return 'cgs';
  if (kind === 'ui') return 'ui';
  if (kind === 'shader') return 'shaders';
  return 'audio';
}

function lineNumber(area: HTMLTextAreaElement): number {
  return area.value.slice(0, area.selectionStart).split('\n').length;
}

function focusLine(area: HTMLTextAreaElement | null, line: number): void {
  if (!area || line < 1) return;
  const lines = area.value.split('\n');
  let start = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) start += lines[i].length + 1;
  area.focus();
  area.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
}
