import type { Value } from '../scenario/types';

export const SLOT_COUNT = 10;

export type NodeSnap = {
  id: string;
  kind: 'bg' | 'char' | 'cg';
  expr?: string;
  variant?: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  blend: string;
};

export type StageSnapshot = {
  background?: NodeSnap;
  characters: NodeSnap[];
  cg?: NodeSnap;
  camera: { x: number; y: number; zoom: number; rotation: number; letterbox: number };
  particle: string | null;
};

export type SaveSlot = {
  slot: number;
  savedAt: string;
  previewText: string;
  speaker: string;
  thumbnail?: string;
  index: number;
  vars: Record<string, Value>;
  choiceLock: boolean;
  stage: StageSnapshot;
};

export type SaveFile = {
  slots: (SaveSlot | null)[];
};

export function emptySaveFile(): SaveFile {
  return { slots: Array.from({ length: SLOT_COUNT }, () => null) };
}

export function normalizeSaves(raw: unknown): SaveFile {
  const file = emptySaveFile();
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as SaveFile).slots)) return file;
  (raw as SaveFile).slots.forEach((slot, index) => {
    if (index < SLOT_COUNT) file.slots[index] = slot ?? null;
  });
  return file;
}

export function writeSlot(file: SaveFile, slot: SaveSlot): SaveFile {
  if (slot.slot < 0 || slot.slot >= SLOT_COUNT) throw new Error('セーブスロットが範囲外です');
  const slots = file.slots.slice();
  slots[slot.slot] = { ...slot, vars: { ...slot.vars }, stage: structuredClone(slot.stage) };
  return { slots };
}

export function readSlot(file: SaveFile, index: number): SaveSlot | null {
  return file.slots[index] ?? null;
}

export function latestSlot(file: SaveFile): SaveSlot | null {
  const filled = file.slots.filter((slot): slot is SaveSlot => slot !== null);
  if (!filled.length) return null;
  return filled.reduce((best, slot) => (slot.savedAt > best.savedAt ? slot : best));
}
