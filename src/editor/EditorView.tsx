import { useEffect, useMemo, useRef, useState } from 'react';
import { PRESETS, PRESET_KIND_LABELS, getPreset, resolvePreset, templateFor, type Role } from '../core/effects/catalog';
import { EXPRESSION_TEMPLATE, expressionBoard, filledExpressionCount, type ExpressionSlot } from '../core/project/expressions';
import { addAsset, mediaUrl, type AssetDraft, type CharacterAsset, type Project } from '../core/project/project';
import { getTextFrame, TEXT_FRAMES } from '../core/project/text-frame';
import { MessageBox } from '../player/MessageBox';
import { canRedo, canUndo, commitHistory, createHistory, redoHistory, undoHistory, type History } from '../core/editor/history';
import {
  deleteLines,
  duplicateLines,
  editorShortcut,
  findMatch,
  moveLines,
  offsetOfLine,
  replaceAll,
  replaceOnce,
  toggleComment,
} from '../core/editor/script-edit';
import { insertLineBefore, pageLayerLabel, placeCharacterOnPage, scenarioPages, setPageLayers, type PageLayers } from '../core/scenario/pages';
import { parseScenario, updateLineParam } from '../core/scenario/parser';
import type { Command } from '../core/scenario/types';
import { clientToStage } from '../runtime/fit';
import { PlaybackController, type PlayView } from '../player/PlaybackController';
import type { GameSettings } from '../core/settings';

export function EditorView({
  project,
  projectDir,
  settings,
  onProject,
  onPlay,
  onPreviewWindow,
  onSave,
}: {
  project: Project;
  projectDir: string | null;
  settings: GameSettings;
  onProject: (project: Project) => void;
  onPlay: () => void;
  onPreviewWindow: () => void;
  onSave: () => void;
}) {
  const program = useMemo(() => parseScenario(project.script), [project.script]);
  const pages = useMemo(() => scenarioPages(project.script), [project.script]);
  const [line, setLine] = useState(1);
  const [kind, setKind] = useState<AssetDraft['kind']>('background');
  const [assetId, setAssetId] = useState('room');
  const [extra, setExtra] = useState('day');
  const [exprId, setExprId] = useState('smile');
  const [editMode, setEditMode] = useState(true);
  const [selectedObject, setSelectedObject] = useState<'text' | 'character'>('text');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [exprNotice, setExprNotice] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const safeIndex = pages.length ? Math.min(pageIndex, pages.length - 1) : 0;
  const currentPage = pages[safeIndex];
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<PlaybackController | null>(null);
  const [view, setView] = useState<PlayView | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const addFormRef = useRef<HTMLDivElement>(null);
  const playMenuRef = useRef<HTMLDetailsElement>(null);
  const editStarted = useRef(false);
  const dragRef = useRef<{ id: string; dx: number; dy: number; ox: number; oy: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const [pendingLine, setPendingLine] = useState<number | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [gotoLine, setGotoLine] = useState('1');
  const historyRef = useRef<History<Project>>(createHistory(project));
  const applyingRef = useRef(false);
  const [historyRev, setHistoryRev] = useState(0);
  const undoable = historyRev >= 0 && canUndo(historyRef.current);
  const redoable = canRedo(historyRef.current);

  const apply = (next: Project, coalesce = false) => {
    const history = commitHistory(historyRef.current, next, coalesce, sameProject);
    if (history === historyRef.current) return;
    historyRef.current = history;
    applyingRef.current = true;
    onProject(next);
    setHistoryRev((value) => value + 1);
  };
  const undoEdit = () => {
    const history = undoHistory(historyRef.current);
    if (history === historyRef.current || history.present === historyRef.current.present) return;
    historyRef.current = history;
    applyingRef.current = true;
    onProject(history.present);
    setHistoryRev((value) => value + 1);
  };
  const redoEdit = () => {
    const history = redoHistory(historyRef.current);
    if (history.present === historyRef.current.present) return;
    historyRef.current = history;
    applyingRef.current = true;
    onProject(history.present);
    setHistoryRev((value) => value + 1);
  };
  const applyEdit = (edit: { script: string; selectionStart: number; selectionEnd: number }) => {
    apply({ ...project, script: edit.script });
    setPendingSelection({ start: edit.selectionStart, end: edit.selectionEnd });
  };
  const seek = (backward: boolean) => {
    const area = areaRef.current;
    const from = backward ? (area?.selectionStart ?? 0) : (area?.selectionEnd ?? 0);
    const found = findMatch(project.script, query, from, backward, sensitive);
    if (found) setPendingSelection(found);
  };
  const jumpToLine = () => {
    setPendingSelection(offsetOfLine(project.script, Number(gotoLine) || 1));
  };

  useEffect(() => () => preview?.destroy(), [preview]);
  useEffect(() => {
    if (!host || editStarted.current) return;
    editStarted.current = true;
    const playback = new PlaybackController(host, project, settings);
    playback.setListener((next) => setView(next));
    setPreview(playback);
    setEditMode(true);
  }, [host, project, settings]);
  useEffect(() => () => previewAudio.current?.pause(), []);
  useEffect(() => {
    if (pendingLine == null) return;
    focusLine(areaRef.current, pendingLine);
    setPendingLine(null);
  }, [pendingLine, project.script]);
  useEffect(() => {
    if (!pendingSelection || !areaRef.current) return;
    areaRef.current.focus();
    areaRef.current.setSelectionRange(pendingSelection.start, pendingSelection.end);
    setPendingSelection(null);
  }, [pendingSelection, project.script]);
  useEffect(() => {
    if (applyingRef.current) {
      applyingRef.current = false;
      return;
    }
    if (!sameProject(project, historyRef.current.present)) {
      historyRef.current = createHistory(project);
      setHistoryRev((value) => value + 1);
    }
  }, [project]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const command = editorShortcut(event);
      if (!command) return;
      const target = event.target;
      const typingElsewhere = target instanceof HTMLElement
        && target !== areaRef.current
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (typingElsewhere && command !== 'save' && command !== 'find' && command !== 'replace' && command !== 'goto') return;
      event.preventDefault();
      const area = areaRef.current;
      const start = area?.selectionStart ?? 0;
      const end = area?.selectionEnd ?? start;
      if (command === 'undo') undoEdit();
      else if (command === 'redo') redoEdit();
      else if (command === 'save') onSave();
      else if (command === 'find') {
        setFindOpen(true);
        setReplaceOpen(false);
        if (query) seek(false);
      } else if (command === 'replace') {
        setFindOpen(true);
        setReplaceOpen(true);
      }       else if (command === 'goto') {
        setFindOpen(true);
        jumpToLine();
      } else if (command === 'duplicate') applyEdit(duplicateLines(project.script, start, end));
      else if (command === 'comment') applyEdit(toggleComment(project.script, start, end));
      else if (command === 'deleteLine') applyEdit(deleteLines(project.script, start, end));
      else if (command === 'moveUp') applyEdit(moveLines(project.script, start, end, -1));
      else if (command === 'moveDown') applyEdit(moveLines(project.script, start, end, 1));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  useEffect(() => {
    if (!editMode || !preview) return;
    void preview.presentPage(project.script, safeIndex);
  }, [editMode, preview, project.script, safeIndex, pages]);
  useEffect(() => {
    if (!editMode) return;
    const nextLine = pages[safeIndex]?.endLine;
    if (!nextLine) return;
    setLine(nextLine);
    focusLine(areaRef.current, nextLine);
  }, [editMode, safeIndex]);
  useEffect(() => {
    if (!editMode) return undefined;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPageIndex((value) => Math.max(0, value - 1));
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPageIndex((value) => Math.min(Math.max(pages.length - 1, 0), value + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, pages.length]);
  useEffect(() => {
    if (!editMode || !host || !preview || !currentPage) return undefined;
    const pointOf = (event: PointerEvent) => {
      const canvas = host.querySelector('canvas');
      if (!canvas) return null;
      return clientToStage(canvas.getBoundingClientRect(), event.clientX, event.clientY, project.width, project.height);
    };
    const down = (event: PointerEvent) => {
      const point = pointOf(event);
      if (!point) return;
      const id = preview.hitCharacter(point.x, point.y);
      const origin = id ? preview.characterOrigin(id) : null;
      if (!id || !origin) return;
      dragRef.current = { id, dx: point.x - origin.x, dy: point.y - origin.y, ox: origin.x, oy: origin.y };
      setSelectedCharacterId(id);
      setSelectedObject('character');
      try { host.setPointerCapture(event.pointerId); } catch { /* ポインタが無いときはドラッグだけ続ける */ }
      event.preventDefault();
    };
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const point = pointOf(event);
      if (!point) return;
      preview.moveCharacter(drag.id, point.x - drag.dx, point.y - drag.dy);
    };
    const up = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || !currentPage) return;
      const origin = preview.characterOrigin(drag.id);
      if (!origin || (origin.x === drag.ox && origin.y === drag.oy)) return;
      const placed = placeCharacterOnPage(project.script, currentPage, drag.id, origin.x, origin.y);
      const script = currentPage.explicit && !currentPage.layers.image
        ? setPageLayers(placed.script, placed.endLine, { ...currentPage.layers, image: true })
        : placed.script;
      if (script !== project.script) apply({ ...project, script });
    };
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      dragRef.current = null;
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [editMode, host, preview, currentPage, project, onProject]);

  const selected = program.commands.find((command) => command.line === line);
  const effect = selected && 'effect' in selected ? selected.effect : undefined;

  const beginEdit = () => {
    if (!host) return;
    if (editMode) {
      setEditMode(false);
      return;
    }
    preview?.destroy();
    const playback = new PlaybackController(host, project, settings);
    playback.setListener((next) => setView(next));
    setPreview(playback);
    setPageIndex(safeIndex);
    setEditMode(true);
  };

  const playPreview = () => {
    if (!host) return;
    setEditMode(false);
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
    if (!host) return;
    preview?.destroy();
    const playback = new PlaybackController(host, project, settings);
    playback.setListener((next) => setView(next));
    setPreview(playback);
    setView(null);
    setEditMode(true);
  };

  const runPlay = (action: () => void) => {
    if (playMenuRef.current) playMenuRef.current.open = false;
    action();
  };

  const prepareExpression = (character: CharacterAsset, slot: ExpressionSlot) => {
    setKind('character');
    setAssetId(character.id);
    setExtra(character.name);
    setExprId(slot.id);
    setExprNotice(`${slot.fileName} の追加を用意しました。下で画像を選び、「素材を追加」を押すと、この表情が使えます。`);
    addFormRef.current?.scrollIntoView({ block: 'center' });
    void navigator.clipboard?.writeText(slot.fileName).catch(() => undefined);
  };

  const useExpression = (character: CharacterAsset, expression: string) => {
    if (editMode && currentPage) {
      const inserted = insertLineBefore(project.script, currentPage.endLine, `expr ${character.id} ${expression}`);
      const marked = setPageLayers(inserted, currentPage.endLine + 1, { ...currentPage.layers, image: true });
      apply({ ...project, script: marked });
      return;
    }
    insertSnippet(`expr ${character.id} ${expression}`);
  };

  const toggleLayer = (key: keyof PageLayers) => {
    if (!currentPage) return;
    apply({
      ...project,
      script: setPageLayers(project.script, currentPage.endLine, { ...currentPage.layers, [key]: !currentPage.layers[key] }),
    });
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
        ? { kind, id: assetId.trim(), name: extra.trim() || assetId.trim(), expr: exprId, src }
        : { kind, id: assetId.trim(), src };
    apply(addAsset(project, draft));
    setExprNotice('');
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
      apply({ ...project, script: `${project.script.replace(/\s*$/, '')}\n${text}` });
      return;
    }
    const start = area.selectionStart;
    const next = `${project.script.slice(0, start)}${text}${project.script.slice(start)}`;
    setPendingLine(project.script.slice(0, start).split('\n').length);
    apply({ ...project, script: next });
  };

  const labels = program.commands.filter((command) => command.type === 'label');
  const explained = effect ? getPreset(resolvePreset(effect.preset, roleFor(selected))) : undefined;
  const kinds = [...new Set(PRESETS.map((preset) => preset.kind))];
  const scriptLines = project.script.split('\n');
  const pickedCharacter = project.assets.characters.find((item) => item.id === selectedCharacterId);
  const frameLayout = getTextFrame(project.textFrame).layout;
  const messageSpeaker = editMode ? (currentPage?.layers.text ? currentPage.speaker : '') : (view?.speaker ?? '');
  const messageText = editMode ? (currentPage?.layers.text ? currentPage.text : '') : (view?.typed ?? '');
  const showMessage = Boolean(editMode ? currentPage : view);

  return (
    <div className="editor">
      <header className="topbar">
        <strong>ノベルスタジオ</strong>
        <span>{project.name}</span>
        <details className="menu" ref={playMenuRef}>
          <summary>再生</summary>
          <div className="menu-panel">
            <button type="button" onClick={() => runPlay(onPlay)}>本編として再生</button>
            <button type="button" onClick={() => runPlay(onPreviewWindow)}>別ウィンドウで再生</button>
            <button type="button" onClick={() => runPlay(playPreview)}>この舞台で再生</button>
          </div>
        </details>
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
            {project.assets.characters.map((item) => {
              const count = filledExpressionCount(item);
              return (
                <li key={item.id} className="expr-character">
                  <span>人物 {item.name}（{count.filled}/{count.total}）</span>
                  <div className="expr-grid">
                    {expressionBoard(item).map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className={slot.filled ? 'expr-slot' : 'expr-slot missing'}
                        title={slot.filled ? `${item.name}の${slot.label}` : `${slot.fileName} を追加すると使えます`}
                        onClick={() => (slot.filled ? useExpression(item, slot.id) : prepareExpression(item, slot))}
                      >
                        {slot.filled ? <img src={mediaUrl(slot.src)} alt="" /> : <span className="expr-empty">画像を置く</span>}
                        <span>{slot.label}</span>
                        {slot.filled ? null : <small>{slot.fileName}</small>}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
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
          <div ref={addFormRef}>
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
          {kind === 'character' ? (
            <label>表情
              <select value={exprId} onChange={(event) => setExprId(event.target.value)}>
                {EXPRESSION_TEMPLATE.map((item) => <option key={item.id} value={item.id}>{item.label}（{item.id}）</option>)}
              </select>
            </label>
          ) : null}
          <input ref={fileRef} type="file" accept="image/*,audio/mpeg,audio/ogg,audio/wav,audio/mp4,.mp3,.ogg,.wav,.m4a,.frag,.glsl" />
          <button type="button" onClick={() => void add()}>素材を追加</button>
          {exprNotice ? <p className="hint">{exprNotice}</p> : null}
          <p className="hint">空いている表情の「画像を置く」を押すと、この欄がそのファイル名になります。入っている表情は、編集中のページの顔に入ります。</p>
          </div>
        </aside>
        <section className="script-pane">
          <div className="script-tools">
            <div className="edit-commands">
              <button type="button" onClick={undoEdit} disabled={!undoable}>取り消す</button>
              <button type="button" onClick={redoEdit} disabled={!redoable}>やり直す</button>
              <span className="line-status">{line}行目</span>
              <button type="button" onClick={() => { setFindOpen(true); setReplaceOpen(false); }}>検索</button>
              <button type="button" onClick={() => { setFindOpen(true); setReplaceOpen(true); }}>置換</button>
              <details className="shortcut-help">
                <summary>操作</summary>
                <p>Ctrl+Z 取り消す / Ctrl+Y または Ctrl+Shift+Z やり直す / Ctrl+S 保存</p>
                <p>Ctrl+F 検索 / Ctrl+H 置換 / Ctrl+G 行へ移動</p>
                <p>Ctrl+D 行を複製 / Ctrl+/ コメント / Ctrl+Shift+K 行を削除</p>
                <p>Alt+↑ Alt+↓ 行を移動</p>
              </details>
            </div>
            {findOpen ? (
              <div className="find-bar">
                <input value={query} placeholder="検索" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); seek(event.shiftKey); }
                }} />
                <button type="button" onClick={() => seek(false)}>次へ</button>
                <button type="button" onClick={() => seek(true)}>前へ</button>
                {replaceOpen ? (
                  <>
                    <input value={replacement} placeholder="置換" onChange={(event) => setReplacement(event.target.value)} />
                    <button type="button" onClick={() => {
                      const area = areaRef.current;
                      const edit = replaceOnce(project.script, query, replacement, area?.selectionStart ?? 0, area?.selectionEnd ?? 0, sensitive);
                      if (edit) applyEdit(edit);
                    }}>置換</button>
                    <button type="button" onClick={() => {
                      const script = replaceAll(project.script, query, replacement, sensitive);
                      applyEdit({ script, selectionStart: 0, selectionEnd: 0 });
                    }}>すべて</button>
                  </>
                ) : null}
                <label className="check"><input type="checkbox" checked={sensitive} onChange={(event) => setSensitive(event.target.checked)} />大文字小文字</label>
                <input value={gotoLine} onChange={(event) => setGotoLine(event.target.value)} onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); jumpToLine(); }
                }} />
                <button type="button" onClick={jumpToLine}>行へ</button>
                <button type="button" onClick={() => setFindOpen(false)}>閉じる</button>
              </div>
            ) : null}
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
            <details className="effect-guide">
              <summary>行の一覧</summary>
              <ol className="command-list">
                {program.commands.filter((command) => command.type !== 'label').map((command, index) => (
                  <li key={`${command.line}-${index}`} className={command.line === line ? 'current' : ''}>
                    <button type="button" onClick={() => { setLine(command.line); focusLine(areaRef.current, command.line); }}>{command.line}. {command.source}</button>
                  </li>
                ))}
              </ol>
            </details>
          </div>
          <div className="script-editor">
            <div className="line-gutter" ref={gutterRef}>
              {scriptLines.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={line === index + 1 ? 'current' : ''}
                  aria-label={`${index + 1}行目`}
                  onClick={() => {
                    setLine(index + 1);
                    focusLine(areaRef.current, index + 1);
                    if (gutterRef.current && areaRef.current) gutterRef.current.scrollTop = areaRef.current.scrollTop;
                  }}
                >{index + 1}</button>
              ))}
            </div>
            <textarea
              ref={areaRef}
              wrap="off"
              spellCheck={false}
              value={project.script}
              onChange={(event) => apply({ ...project, script: event.target.value }, true)}
              onClick={(event) => setLine(lineNumber(event.currentTarget))}
              onKeyUp={(event) => setLine(lineNumber(event.currentTarget))}
              onScroll={(event) => {
                if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
              }}
            />
          </div>
          {program.errors.length ? <p className="error-line">{program.errors.map((error) => `${error.line}行: ${error.message}`).join(' / ')}</p> : null}
          {effect ? (
            <div className="inspector">
              <h2>演出 {explained?.label ?? effect.preset}</h2>
              {explained ? <p className="hint">{explained.detail}</p> : null}
              <div className="inspector-fields">
                <label>duration
                  <input
                    value={String(effect.params.duration ?? '')}
                    onChange={(event) => apply({ ...project, script: updateLineParam(project.script, line, 'duration', event.target.value || '0.5') }, true)}
                  />
                </label>
                <label>easing
                  <input
                    value={String(effect.params.easing ?? '')}
                    onChange={(event) => apply({ ...project, script: updateLineParam(project.script, line, 'easing', event.target.value || 'quadOut') }, true)}
                  />
                </label>
                <label>amount
                  <input
                    value={String(effect.params.amount ?? '')}
                    onChange={(event) => apply({ ...project, script: updateLineParam(project.script, line, 'amount', event.target.value || '1') }, true)}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </section>
        <aside className="preview-pane">
          <div className={`preview-stage frame-layout-${frameLayout}`}>
            <div className={`stage-host preview${editMode ? ' placing' : ''}`} ref={setHost} />
            <div className="stage-overlay">
              <div className="stage-tools">
                <button type="button" className={editMode ? 'on' : ''} onClick={beginEdit}>{editMode ? '編集中' : '編集'}</button>
                <button type="button" title="前のページ" aria-label="前のページ" disabled={!editMode || safeIndex <= 0} onClick={() => setPageIndex(safeIndex - 1)}>前のページ</button>
                <span>{pages.length ? `${safeIndex + 1} / ${pages.length}` : '0 / 0'}</span>
                <button type="button" title="次のページ" aria-label="次のページ" disabled={!editMode || safeIndex >= pages.length - 1} onClick={() => setPageIndex(safeIndex + 1)}>次のページ</button>
                {editMode && currentPage ? (
                  <>
                    <span className="hint">{pageLayerLabel(currentPage.layers)}</span>
                    <label className="check"><input type="checkbox" checked={currentPage.layers.text} onChange={() => toggleLayer('text')} />テキストを更新</label>
                    <label className="check"><input type="checkbox" checked={currentPage.layers.image} onChange={() => toggleLayer('image')} />画像も変える</label>
                    <label className="check"><input type="checkbox" checked={currentPage.layers.audio} onChange={() => toggleLayer('audio')} />音声も再生</label>
                  </>
                ) : null}
                {!editMode && view ? <button type="button" onClick={stopPreview}>停止</button> : null}
              </div>
            </div>
            {showMessage ? (
              <div className="stage-bottom">
                {editMode && selectedObject === 'text' ? (
                  <div className="frame-popover">
                    {TEXT_FRAMES.map((frame) => (
                      <button
                        key={frame.id}
                        type="button"
                        className={project.textFrame === frame.id ? 'on' : ''}
                        onClick={() => apply({ ...project, textFrame: frame.id })}
                      >{frame.label}</button>
                    ))}
                    <p className="hint">{getTextFrame(project.textFrame).detail}</p>
                  </div>
                ) : null}
                {editMode && selectedObject === 'character' ? (
                  <p className="stage-chip">{pickedCharacter ? `${pickedCharacter.name}を` : '立ち絵を'}ドラッグすると、このページの位置が台本に残ります。</p>
                ) : null}
                <MessageBox
                  frame={project.textFrame}
                  speaker={messageSpeaker}
                  text={messageText}
                  opacity={settings.windowOpacity}
                  className={`preview-message ${editMode && selectedObject === 'text' ? 'object-selected' : ''}`}
                  onClick={editMode ? () => setSelectedObject('text') : undefined}
                />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function sameProject(left: Project, right: Project): boolean {
  return left.name === right.name
    && left.script === right.script
    && JSON.stringify(left.assets) === JSON.stringify(right.assets)
    && JSON.stringify(left.title) === JSON.stringify(right.title)
    && left.textFrame === right.textFrame;
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
  const style = getComputedStyle(area);
  const fontSize = parseFloat(style.fontSize) || 16;
  const parsed = parseFloat(style.lineHeight);
  const lineHeight = Number.isFinite(parsed) ? parsed : fontSize * 1.55;
  const top = (line - 1) * lineHeight;
  if (top < area.scrollTop || top > area.scrollTop + area.clientHeight - lineHeight) {
    area.scrollTop = Math.max(0, top - area.clientHeight / 3);
  }
}
