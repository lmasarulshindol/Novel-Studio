import { useEffect, useRef, useState } from 'react';
import {
  findBackground,
  findUi,
  mediaUrl,
  type Project,
} from '../core/project/project';
import { readSlot, writeSlot, type SaveFile, type SaveSlot } from '../core/save/save';
import { type GameSettings } from '../core/settings';
import { loadUnlocks, rememberUnlock, type Unlocks } from '../core/unlocks';
import { playSystemCue } from '../runtime/audio';
import { PlaybackController, type PlayView } from './PlaybackController';

type Boot = 'new' | SaveSlot;

export function PlayerView({
  project,
  settings,
  saves,
  onSettings,
  onSaves,
  onExit,
}: {
  project: Project;
  settings: GameSettings;
  saves: SaveFile;
  onSettings: (settings: GameSettings) => void;
  onSaves: (saves: SaveFile) => void;
  onExit: () => void;
}) {
  const [screen, setScreen] = useState<'title' | 'config' | 'load' | 'game' | 'gallery' | 'sound'>('title');
  const [unlocks, setUnlocks] = useState<Unlocks>(() => loadUnlocks(project.name));
  const [boot, setBoot] = useState<Boot | null>(null);
  const latest = saves.slots.filter((slot): slot is SaveSlot => slot !== null).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))[0];
  const bg = findBackground(project, project.title.background, project.title.backgroundVariant);
  const logo = findUi(project, project.title.logo);

  useEffect(() => {
    if (!project.title.bgm || screen !== 'title') return undefined;
    const audio = new Audio(mediaUrl(project.assets.bgm.find((item) => item.id === project.title.bgm)?.src ?? ''));
    audio.loop = true;
    audio.volume = settings.bgm;
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
    };
  }, [project, screen, settings.bgm]);

  useEffect(() => {
    if (project.title.bgm) rememberUnlock(project.name, 'bgm', project.title.bgm);
    if (screen === 'title') setUnlocks(loadUnlocks(project.name));
  }, [project, screen]);

  const cue = () => playSystemCue(settings.system, 'cursor');

  useEffect(() => {
    if (!settings.fullscreen) return;
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    void window.novelStudio?.setFullScreen(true);
    return () => {
      void window.novelStudio?.setFullScreen(false);
    };
  }, [settings.fullscreen]);

  if (screen === 'config') {
    return <ConfigScreen settings={settings} onChange={onSettings} onBack={() => setScreen('title')} />;
  }
  if (screen === 'gallery') {
    return <GalleryScreen project={project} unlocks={unlocks} onBack={() => setScreen('title')} />;
  }
  if (screen === 'sound') {
    return <SoundScreen project={project} unlocks={unlocks} settings={settings} onBack={() => setScreen('title')} />;
  }
  if (screen === 'load') {
    return (
      <SlotScreen
        title="ロード"
        saves={saves}
        onPick={(slot) => {
          if (!slot) return;
          setBoot(slot);
          setScreen('game');
        }}
        onBack={() => setScreen('title')}
      />
    );
  }
  if (screen === 'game' && boot) {
    return (
      <GameScreen
        project={project}
        settings={settings}
        saves={saves}
        boot={boot}
        onSettings={onSettings}
        onSaves={onSaves}
        onTitle={() => {
          setBoot(null);
          setScreen('title');
        }}
      />
    );
  }

  return (
    <section className="title-screen" style={{ backgroundImage: bg ? `url(${mediaUrl(bg.src)})` : undefined }}>
      <div className="title-card">
        {logo ? <img src={mediaUrl(logo.src)} alt="" className="title-logo" /> : null}
        <h1>{project.name}</h1>
        <div className="menu-col">
          <button type="button" onClick={() => { cue(); setBoot('new'); setScreen('game'); }}>はじめから</button>
          <button type="button" disabled={!latest} onClick={() => { if (!latest) return; cue(); setBoot(latest); setScreen('game'); }}>つづきから</button>
          <button type="button" onClick={() => { cue(); setScreen('load'); }}>ロード</button>
          <button type="button" onClick={() => { cue(); setScreen('gallery'); }}>回想</button>
          <button type="button" onClick={() => { cue(); setScreen('sound'); }}>サウンド</button>
          <button type="button" onClick={() => { cue(); setScreen('config'); }}>設定</button>
          <button type="button" onClick={() => { cue(); onExit(); }}>終了</button>
        </div>
      </div>
    </section>
  );
}

function ConfigScreen({ settings, onChange, onBack }: { settings: GameSettings; onChange: (settings: GameSettings) => void; onBack: () => void }) {
  const field = (key: keyof GameSettings, label: string, min: number, max: number, step: number) => (
    <label className="slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(settings[key])}
        onChange={(event) => onChange({ ...settings, [key]: Number(event.target.value) })}
      />
      <b>{Number(settings[key]).toFixed(step < 1 ? 2 : 0)}</b>
    </label>
  );
  return (
    <section className="panel-screen">
      <h2>設定</h2>
      {field('textSpeed', '文字速度', 1, 200, 1)}
      {field('autoDelay', 'オート待ち（秒）', 0.2, 8, 0.1)}
      {field('bgm', 'BGM', 0, 1, 0.01)}
      {field('se', '効果音', 0, 1, 0.01)}
      {field('voice', 'ボイス', 0, 1, 0.01)}
      {field('system', 'システム音', 0, 1, 0.01)}
      {field('windowOpacity', 'ウィンドウ不透明度', 0.15, 1, 0.01)}
      <label className="check"><input type="checkbox" checked={settings.fullscreen} onChange={(event) => onChange({ ...settings, fullscreen: event.target.checked })} />フルスクリーン</label>
      <label className="check"><input type="checkbox" checked={settings.skipRead} onChange={(event) => onChange({ ...settings, skipRead: event.target.checked })} />既読のみスキップ</label>
      <button type="button" onClick={onBack}>戻る</button>
    </section>
  );
}

function SlotBody({ index, slot }: { index: number; slot: SaveSlot | null }) {
  return (
    <>
      {slot?.thumbnail ? <img className="slot-thumb" src={slot.thumbnail} alt="" /> : <span className="slot-thumb empty" />}
      <span className="slot-copy">
        <strong>{index + 1}</strong>
        <span>{slot ? `${slot.speaker} ${slot.previewText}` : '空き'}</span>
        <small>{slot ? new Date(slot.savedAt).toLocaleString() : ''}</small>
      </span>
    </>
  );
}

function GalleryScreen({ project, unlocks, onBack }: { project: Project; unlocks: Unlocks; onBack: () => void }) {
  const items = project.assets.cgs;
  return (
    <section className="panel-screen">
      <h2>回想</h2>
      {items.length === 0 ? <p>CGはまだ登録されていません。</p> : (
        <div className="gallery-grid">
          {items.map((item) => {
            const open = unlocks.cg.includes(item.id);
            return (
              <figure key={item.id} className={open ? '' : 'locked'}>
                {open ? <img src={mediaUrl(item.src)} alt={item.id} /> : <div className="slot-thumb empty gallery-blank" />}
                <figcaption>{open ? item.id : '未開放'}</figcaption>
              </figure>
            );
          })}
        </div>
      )}
      <button type="button" onClick={onBack}>戻る</button>
    </section>
  );
}

function SoundScreen({
  project, unlocks, settings, onBack,
}: {
  project: Project;
  unlocks: Unlocks;
  settings: GameSettings;
  onBack: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState('');
  useEffect(() => () => audioRef.current?.pause(), []);
  const play = (id: string, src: string) => {
    audioRef.current?.pause();
    const audio = new Audio(mediaUrl(src));
    audio.loop = true;
    audio.volume = settings.bgm;
    audioRef.current = audio;
    setPlaying(id);
    void audio.play().catch(() => undefined);
  };
  const stop = () => {
    audioRef.current?.pause();
    setPlaying('');
  };
  return (
    <section className="panel-screen">
      <h2>サウンド</h2>
      <div className="menu-col">
        {project.assets.bgm.map((item) => {
          const open = unlocks.bgm.includes(item.id);
          return (
            <button key={item.id} type="button" disabled={!open} onClick={() => play(item.id, item.src)}>
              {open ? `${playing === item.id ? '再生中 ' : ''}${item.id}` : `${item.id}（未開放）`}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={stop}>停止</button>
      <button type="button" onClick={() => { stop(); onBack(); }}>戻る</button>
    </section>
  );
}

function SlotScreen({ title, saves, onPick, onBack }: { title: string; saves: SaveFile; onPick: (slot: SaveSlot | null) => void; onBack: () => void }) {
  return (
    <section className="panel-screen">
      <h2>{title}</h2>
      <div className="slot-grid">
        {saves.slots.map((slot, index) => (
          <button key={index} type="button" className="slot" disabled={title === 'ロード' && !slot} onClick={() => onPick(slot ? { ...slot, slot: index } : null)}>
            <SlotBody index={index} slot={slot} />
          </button>
        ))}
      </div>
      <button type="button" onClick={onBack}>戻る</button>
    </section>
  );
}

function GameScreen({
  project, settings, saves, boot, onSettings, onSaves, onTitle,
}: {
  project: Project;
  settings: GameSettings;
  saves: SaveFile;
  boot: Boot;
  onSettings: (settings: GameSettings) => void;
  onSaves: (saves: SaveFile) => void;
  onTitle: () => void;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const ctrlRef = useRef<PlaybackController | null>(null);
  const [view, setView] = useState<PlayView | null>(null);
  const [overlay, setOverlay] = useState<'none' | 'config' | 'save' | 'load' | 'log'>('none');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!host) return undefined;
    const playback = new PlaybackController(host, project, settings);
    playback.setListener(setView);
    ctrlRef.current = playback;
    void playback.start(boot);
    return () => {
      ctrlRef.current?.destroy();
      ctrlRef.current = null;
    };
  }, [host, project, boot]);

  useEffect(() => {
    ctrlRef.current?.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        ctrlRef.current?.advance();
      }
      if (event.key === 'Escape') setOverlay((value) => (value === 'none' ? 'log' : 'none'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const saveTo = (index: number) => {
    const slot = ctrlRef.current?.buildSlot(index);
    if (!slot) return;
    ctrlRef.current?.playSystem('save');
    onSaves(writeSlot(saves, slot));
    setOverlay('none');
  };

  return (
    <section className="game-screen" onContextMenu={(event) => { event.preventDefault(); setHidden((value) => !value); }}>
      <div className="stage-host" ref={setHost} onClick={() => overlay === 'none' && ctrlRef.current?.advance()} />
      {!hidden && view && (
        <div className="hud">
          <div className="hud-buttons" onClick={(event) => event.stopPropagation()}>
            <button type="button" className={view.auto ? 'on' : ''} onClick={() => ctrlRef.current?.setAuto(!view.auto)}>オート</button>
            <button type="button" className={view.skip ? 'on' : ''} onClick={() => ctrlRef.current?.setSkip(!view.skip)}>スキップ</button>
            <button type="button" onClick={() => setOverlay('log')}>ログ</button>
            <button type="button" onClick={() => setOverlay('save')}>セーブ</button>
            <button type="button" onClick={() => setOverlay('load')}>ロード</button>
            <button type="button" onClick={() => setOverlay('config')}>設定</button>
            <button type="button" onClick={onTitle}>タイトル</button>
          </div>
          {view.phase === 'ended' ? <p className="ended">了</p> : null}
          {view.error ? <p className="error-line">{view.error}</p> : null}
          {view.phase === 'choice' ? (
            <div className="choices" onClick={(event) => event.stopPropagation()}>
              {view.choices.map((choice, index) => (
                <button key={choice.target + index} type="button" onClick={() => ctrlRef.current?.choose(index)}>{choice.text}</button>
              ))}
            </div>
          ) : (
            <div
              className={`message ${view.shake ? 'shake' : ''} ${view.fade ? 'fade-in' : ''}`}
              style={{ background: `rgba(18, 12, 8, ${settings.windowOpacity})` }}
              onClick={() => ctrlRef.current?.advance()}
            >
              {view.speaker ? <p className="speaker">{view.speaker}</p> : null}
              <p className="body">{view.typed}</p>
            </div>
          )}
        </div>
      )}
      {overlay === 'config' ? (
        <div className="overlay"><ConfigScreen settings={settings} onChange={onSettings} onBack={() => setOverlay('none')} /></div>
      ) : null}
      {overlay === 'save' ? (
        <div className="overlay">
          <section className="panel-screen">
            <h2>セーブ</h2>
            <div className="slot-grid">
              {saves.slots.map((slot, index) => (
                <button key={index} type="button" className="slot" onClick={() => saveTo(index)}>
                  <SlotBody index={index} slot={slot} />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setOverlay('none')}>戻る</button>
          </section>
        </div>
      ) : null}
      {overlay === 'load' ? (
        <div className="overlay">
          <SlotScreen
            title="ロード"
            saves={saves}
            onPick={(slot) => {
              if (!slot) return;
              const saved = readSlot(saves, slot.slot);
              if (!saved || !host) return;
              ctrlRef.current?.destroy();
              const playback = new PlaybackController(host, project, settings);
              playback.setListener(setView);
              ctrlRef.current = playback;
              void playback.start(saved);
              setOverlay('none');
            }}
            onBack={() => setOverlay('none')}
          />
        </div>
      ) : null}
      {overlay === 'log' ? (
        <div className="overlay" onClick={() => setOverlay('none')}>
          <div className="log-list">
            {view?.log.map((line, index) => (
              <p key={index}><b>{line.speaker}</b> {line.text}</p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
