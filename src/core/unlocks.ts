export type UnlockKind = 'bgm' | 'cg';

export type Unlocks = {
  bgm: string[];
  cg: string[];
};

export type UnlockStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const memory = new Map<string, string>();

const memoryStore: UnlockStore = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
};

function defaultStore(): UnlockStore {
  if (typeof localStorage !== 'undefined') return localStorage;
  return memoryStore;
}

function keyOf(projectName: string): string {
  return `novel-studio-unlock:${projectName}`;
}

export function emptyUnlocks(): Unlocks {
  return { bgm: [], cg: [] };
}

export function loadUnlocks(projectName: string, store: UnlockStore = defaultStore()): Unlocks {
  try {
    const raw = store.getItem(keyOf(projectName));
    if (!raw) return emptyUnlocks();
    const parsed = JSON.parse(raw) as Partial<Unlocks>;
    return {
      bgm: Array.isArray(parsed.bgm) ? parsed.bgm.filter((id) => typeof id === 'string') : [],
      cg: Array.isArray(parsed.cg) ? parsed.cg.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    return emptyUnlocks();
  }
}

export function rememberUnlock(projectName: string, kind: UnlockKind, id: string, store: UnlockStore = defaultStore()): Unlocks {
  const current = loadUnlocks(projectName, store);
  if (!id || current[kind].includes(id)) return current;
  const next = { ...current, [kind]: [...current[kind], id] };
  store.setItem(keyOf(projectName), JSON.stringify(next));
  return next;
}
