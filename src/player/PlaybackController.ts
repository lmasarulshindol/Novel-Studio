import { planEffect, defaultContext } from '../core/effects/plan';
import { commandAllowed, commandsForEditPage, scenarioPages, visiblePageText, type ScenarioPage } from '../core/scenario/pages';
import { parseScenario } from '../core/scenario/parser';
import { ScriptRunner, type Halt } from '../core/scenario/runner';
import type { Program } from '../core/scenario/types';
import type { Project } from '../core/project/project';
import type { SaveSlot } from '../core/save/save';
import { normalizeSettings, type GameSettings } from '../core/settings';
import { rememberUnlock } from '../core/unlocks';
import { NovelStage } from '../runtime/stage';

export type PlayView = {
  phase: 'boot' | 'busy' | 'dialogue' | 'choice' | 'ended';
  speaker: string;
  fullText: string;
  typed: string;
  choices: { text: string; target: string }[];
  log: { speaker: string; text: string }[];
  line: number;
  auto: boolean;
  skip: boolean;
  shake: boolean;
  fade: boolean;
  error: string;
};

function seenKey(name: string): string {
  return `novel-studio-seen:${name}`;
}

function loadSeen(name: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(name));
    const list = raw ? JSON.parse(raw) as string[] : [];
    return new Set(list);
  } catch {
    return new Set();
  }
}

function emptyView(): PlayView {
  return {
    phase: 'boot', speaker: '', fullText: '', typed: '', choices: [], log: [],
    line: 0, auto: false, skip: false, shake: false, fade: false, error: '',
  };
}

export class PlaybackController {
  private stage?: NovelStage;
  private runner?: ScriptRunner;
  private settings: GameSettings;
  private seen: Set<string>;
  private lineKey = '';
  private lineWasRead = false;
  private view: PlayView = emptyView();
  private listener: (view: PlayView) => void = () => undefined;
  private typeTimer = 0;
  private waitTimer = 0;
  private pumping = false;
  private alive = true;
  private program?: Program;
  private scriptPages: ScenarioPage[] = [];
  private presentGen = 0;

  constructor(private readonly host: HTMLElement, private readonly project: Project, settings: GameSettings) {
    this.settings = normalizeSettings(settings);
    this.seen = loadSeen(project.name);
  }

  setListener(listener: (view: PlayView) => void): void {
    this.listener = listener;
    this.emit();
  }

  setSettings(settings: GameSettings): void {
    this.settings = normalizeSettings(settings);
    this.stage?.setVolumes({
      bgm: this.settings.bgm,
      se: this.settings.se,
      voice: this.settings.voice,
      system: this.settings.system,
    });
  }

  setAuto(on: boolean): void {
    this.view.auto = on;
    this.emit();
    if (on) this.afterLineReady();
  }

  setSkip(on: boolean): void {
    this.view.skip = on;
    this.emit();
    if (on && this.view.phase === 'dialogue') this.advance();
  }

  async presentPage(script: string, pageIndex: number): Promise<void> {
    const gen = ++this.presentGen;
    await this.openStage();
    if (!this.alive || !this.stage || gen !== this.presentGen) return;
    const pages = scenarioPages(script);
    if (!pages.length) return;
    const index = Math.max(0, Math.min(pageIndex, pages.length - 1));
    const page = pages[index];
    const shown = visiblePageText(pages, index);
    this.stage.clear();
    await this.stage.playSequence(commandsForEditPage(script, index));
    if (!this.alive || gen !== this.presentGen) return;
    this.stage.setSpeaker(shown.speaker);
    this.view.phase = 'dialogue';
    this.view.speaker = shown.speaker;
    this.view.fullText = shown.text;
    this.view.typed = shown.text;
    this.view.line = page.endLine;
    this.view.choices = [];
    this.view.error = '';
    this.emit();
  }

  hitCharacter(x: number, y: number): string | null {
    return this.stage?.hitCharacter(x, y) ?? null;
  }

  characterOrigin(id: string): { x: number; y: number } | null {
    return this.stage?.characterOrigin(id) ?? null;
  }

  moveCharacter(id: string, x: number, y: number): void {
    this.stage?.moveCharacter(id, x, y);
  }

  async start(boot: 'new' | SaveSlot): Promise<void> {
    const program = parseScenario(this.project.script);
    this.program = program;
    this.scriptPages = scenarioPages(this.project.script);
    if (program.errors.length) {
      this.view.error = program.errors.map((error) => `${error.line}行: ${error.message}`).join(' / ');
    }
    this.stage?.destroy();
    this.stage = new NovelStage(this.host, this.project);
    this.stage.onTextFx = (mode) => {
      this.view.shake = mode === 'textShake';
      this.view.fade = mode === 'textFade';
      this.emit();
    };
    await this.stage.init();
    if (!this.alive) return;
    this.stage.onUnlock = (kind, id) => rememberUnlock(this.project.name, kind, id);
    this.stage.setVolumes({
      bgm: this.settings.bgm,
      se: this.settings.se,
      voice: this.settings.voice,
      system: this.settings.system,
    });
    if (boot === 'new') {
      this.runner = new ScriptRunner(program);
      await this.pump();
      return;
    }
    this.runner = new ScriptRunner(program, boot);
    await this.stage.restore(boot.stage);
    if (boot.choiceLock) {
      await this.pump();
      return;
    }
    this.view.phase = 'dialogue';
    this.view.speaker = boot.speaker;
    this.view.fullText = boot.previewText;
    this.view.typed = boot.previewText;
    this.stage.setSpeaker(boot.speaker);
    this.emit();
  }

  advance(): void {
    if (!this.alive) return;
    if (this.view.phase === 'busy') {
      this.stage?.finishTweens();
      return;
    }
    if (this.view.phase !== 'dialogue') return;
    if (this.view.typed.length < this.view.fullText.length) {
      this.completeTyping();
      return;
    }
    this.rememberLine();
    this.stage?.playSystem('cursor');
    void this.pump();
  }

  choose(index: number): void {
    this.stage?.playSystem('choice');
    try {
      this.runner?.choose(index);
    } catch (error) {
      this.view.error = error instanceof Error ? error.message : String(error);
      this.emit();
      return;
    }
    this.view.choices = [];
    void this.pump();
  }

  buildSlot(slot: number): SaveSlot | null {
    if (!this.runner || !this.stage) return null;
    const state = this.runner.exportState();
    return {
      slot,
      savedAt: new Date().toISOString(),
      previewText: this.view.fullText || (this.view.choices[0]?.text ?? ''),
      speaker: this.view.speaker,
      index: state.index,
      vars: state.vars,
      choiceLock: state.choiceLock,
      thumbnail: this.stage.captureThumbnail(),
      stage: this.stage.snapshot(),
    };
  }

  playSystem(name: 'cursor' | 'choice' | 'save'): void {
    this.stage?.playSystem(name);
  }

  destroy(): void {
    this.alive = false;
    window.clearInterval(this.typeTimer);
    window.clearTimeout(this.waitTimer);
    this.stage?.destroy();
  }

  private async openStage(): Promise<void> {
    if (this.stage || !this.alive) return;
    this.stage = new NovelStage(this.host, this.project);
    await this.stage.init();
    if (!this.alive) return;
    this.stage.setVolumes({
      bgm: this.settings.bgm,
      se: this.settings.se,
      voice: this.settings.voice,
      system: this.settings.system,
    });
  }

  private pageOf(command: Program['commands'][number]): ScenarioPage | undefined {
    const index = this.program?.commands.indexOf(command) ?? -1;
    if (index < 0) return undefined;
    return this.scriptPages.find((page) => page.commandIndexes.includes(index));
  }

  private async pump(): Promise<void> {
    if (!this.runner || !this.stage || this.pumping) return;
    this.pumping = true;
    try {
      for (;;) {
        if (!this.alive || !this.runner || !this.stage) return;
        const step = this.runner.next();
        if (step.type === 'batch') {
          const commands = step.commands.filter((command) => commandAllowed(this.pageOf(command), command));
          if (!commands.length) continue;
          this.view.phase = 'busy';
          this.view.line = commands[0].line;
          this.emit();
          await this.stage.playBatch(commands);
          continue;
        }
        if (step.type === 'dialogue') {
          const page = this.scriptPages.find((item) => item.commandIndexes.includes(step.index));
          if (page?.explicit && !page.layers.text) continue;
          this.showDialogue(step);
          return;
        }
        if (step.type === 'choice') {
          this.view.phase = 'choice';
          this.view.choices = step.options;
          this.view.line = step.line;
          this.view.fullText = '';
          this.view.typed = '';
          this.emit();
          return;
        }
        this.view.phase = 'ended';
        this.emit();
        return;
      }
    } catch (error) {
      this.view.error = error instanceof Error ? error.message : String(error);
      this.view.phase = 'ended';
      this.emit();
    } finally {
      this.pumping = false;
    }
  }

  private showDialogue(step: Extract<Halt, { type: 'dialogue' }>): void {
    this.view.phase = 'dialogue';
    this.view.speaker = step.speaker;
    this.view.fullText = step.text;
    this.view.typed = '';
    this.view.choices = [];
    this.view.line = step.line;
    this.view.shake = false;
    this.view.fade = false;
    if (step.effect) {
      try {
        const plan = planEffect(step.effect.preset, step.effect.params, defaultContext('text'));
        this.view.shake = plan.textMode === 'textShake';
        this.view.fade = plan.textMode === 'textFade';
      } catch {
        this.view.error = 'テキスト演出を読めません';
      }
    }
    this.lineKey = `${step.line}:${step.text}`;
    this.lineWasRead = this.seen.has(this.lineKey);
    this.view.log = [...this.view.log, { speaker: step.speaker, text: step.text }];
    this.stage?.setSpeaker(step.speaker);
    this.emit();
    this.startTyper();
  }

  private startTyper(): void {
    window.clearInterval(this.typeTimer);
    window.clearTimeout(this.waitTimer);
    if (this.settings.textSpeed >= 180 || (this.view.skip && this.canSkip())) {
      this.completeTyping();
      return;
    }
    const step = Math.max(1, Math.round(this.settings.textSpeed / 20));
    this.typeTimer = window.setInterval(() => {
      this.view.typed = this.view.fullText.slice(0, this.view.typed.length + step);
      this.emit();
      if (this.view.typed.length >= this.view.fullText.length) this.completeTyping();
    }, 50);
  }

  private completeTyping(): void {
    window.clearInterval(this.typeTimer);
    this.view.typed = this.view.fullText;
    this.emit();
    this.afterLineReady();
  }

  private afterLineReady(): void {
    window.clearTimeout(this.waitTimer);
    if (this.view.phase !== 'dialogue') return;
    if (this.view.skip && this.canSkip()) {
      this.waitTimer = window.setTimeout(() => this.advance(), 40);
      return;
    }
    if (this.view.auto) {
      this.waitTimer = window.setTimeout(() => {
        if (this.view.auto && this.view.phase === 'dialogue') this.advance();
      }, this.settings.autoDelay * 1000);
    }
  }

  private canSkip(): boolean {
    if (!this.view.skip) return false;
    if (!this.settings.skipRead) return true;
    return this.lineWasRead;
  }

  private rememberLine(): void {
    if (!this.lineKey) return;
    this.seen.add(this.lineKey);
    localStorage.setItem(seenKey(this.project.name), JSON.stringify([...this.seen]));
  }

  private emit(): void {
    this.listener({ ...this.view, log: [...this.view.log], choices: [...this.view.choices] });
  }
}
