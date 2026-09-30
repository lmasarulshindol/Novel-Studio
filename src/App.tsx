import { useEffect, useRef, useState } from 'react';
import { EditorView } from './editor/EditorView';
import { createEmptyProject, loadProjectUrl, normalizeProject, type Project } from './core/project/project';
import { PlayerView } from './player/PlayerView';
import { loadSaves, loadSettings, storeSaves, storeSettings } from './storage';
import { defaultSettings, type GameSettings } from './core/settings';
import { emptySaveFile, type SaveFile } from './core/save/save';

export function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [dir, setDir] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [playerOnly, setPlayerOnly] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(defaultSettings());
  const [saves, setSaves] = useState<SaveFile>(emptySaveFile());
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [savedScript, setSavedScript] = useState<string | null>(null);
  const workMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const playerQuery = new URLSearchParams(window.location.search).get('player') === '1';
    void (async () => {
      try {
        if (playerQuery && window.novelStudio) {
          const preview = await window.novelStudio.takePreviewProject();
          if (preview) {
            setProject(normalizeProject(preview));
            setPlayerOnly(true);
            setMode('play');
            return;
          }
        }
        const bundled = await window.novelStudio?.loadBundledProject();
        if (bundled) {
          setProject(normalizeProject(bundled));
          setPlayerOnly(true);
          setMode('play');
          return;
        }
        if (playerQuery) {
          setError('プレビューする作品がありません');
          return;
        }
        const loaded = await loadProjectUrl('/sample/project.json');
        setProject(loaded);
        setSavedScript(loaded.script);
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();
    void loadSettings().then(setSettings);
    void loadSaves().then(setSaves);
  }, []);

  const changeSettings = (next: GameSettings) => {
    setSettings(next);
    void storeSettings(next);
  };
  const changeSaves = (next: SaveFile) => {
    setSaves(next);
    void storeSaves(next);
  };

  const dirty = Boolean(project && savedScript !== null && project.script !== savedScript);
  const confirmDiscard = () => !dirty || window.confirm('保存していない台本の変更があります。破棄して開きますか？');
  const adopt = (next: Project, directory: string | null) => {
    if (!confirmDiscard()) return;
    setProject(next);
    setDir(directory);
    setSavedScript(next.script);
  };

  const openFile = async (file: File) => {
    const raw = JSON.parse(await file.text()) as unknown;
    adopt(normalizeProject(raw), null);
  };

  const openBundled = (url: string) => {
    if (workMenuRef.current) workMenuRef.current.open = false;
    void loadProjectUrl(url).then((next) => adopt(next, null));
  };

  const openNative = async () => {
    const opened = await window.novelStudio?.openProject();
    if (!opened) return;
    adopt(normalizeProject(opened.project), opened.dir);
  };

  const save = async () => {
    if (!project) return null;
    if (window.novelStudio) {
      const savedDir = await window.novelStudio.saveProject(dir, project);
      if (savedDir) setDir(savedDir);
    } else {
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'project.json';
      link.click();
    }
    setSavedScript(project.script);
    setNotice('保存しました');
    return dir;
  };

  const previewWindow = async () => {
    if (!project) return;
    if (!window.novelStudio) {
      setMode('play');
      return;
    }
    await window.novelStudio.openPreview(project);
  };

  const exportInstaller = async () => {
    if (!project || exporting) return;
    if (!window.novelStudio) {
      setNotice('インストーラの作成は Windows アプリから行えます。npm run app で起動してください。');
      return;
    }
    setExporting(true);
    setNotice('インストーラを作成しています。初回は数分かかります。');
    try {
      const exe = await window.novelStudio.exportInstaller(dir, project);
      setNotice(exe ? `作成しました: ${exe}` : '作成を取り消しました。');
    } catch (reason: unknown) {
      setNotice(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setExporting(false);
    }
  };

  const leavePlayer = () => {
    if (playerOnly) {
      void window.novelStudio?.closeWindow();
      return;
    }
    setMode('edit');
  };

  if (!project) {
    return <main className="boot">{error || '見本を読み込んでいます…'}</main>;
  }

  return (
    <main>
      {mode === 'edit' ? (
        <>
          <div className="filebar">
            <button type="button" onClick={() => adopt(createEmptyProject(), null)}>新規</button>
            <details className="menu" ref={workMenuRef}>
              <summary>作品を開く</summary>
              <div className="menu-panel">
                <button type="button" onClick={() => openBundled('/sample/project.json')}>見本：放課後の演出</button>
                <button type="button" onClick={() => openBundled('/duet/project.json')}>二人の放課後</button>
              </div>
            </details>
            <button type="button" onClick={() => void openNative()}>プロジェクトを開く</button>
            <label className="file-open">JSONを開く<input type="file" accept="application/json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void openFile(file);
            }} /></label>
            <button type="button" onClick={() => void save()}>保存</button>
            {dirty ? <span className="dirty">未保存</span> : null}
            <button type="button" onClick={() => void exportInstaller()} disabled={exporting}>インストーラを作成</button>
            {notice ? <span className="hint">{notice}</span> : null}
          </div>
          <EditorView
            project={project}
            projectDir={dir}
            settings={settings}
            onProject={setProject}
            onPlay={() => setMode('play')}
            onPreviewWindow={() => void previewWindow()}
            onSave={() => void save()}
          />
        </>
      ) : (
        <PlayerView project={project} settings={settings} saves={saves} onSettings={changeSettings} onSaves={changeSaves} onExit={leavePlayer} />
      )}
    </main>
  );
}
