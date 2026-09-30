export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  coalescing: boolean;
};

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], coalescing: false };
}

export function commitHistory<T>(
  history: History<T>,
  next: T,
  coalesce: boolean,
  same: (left: T, right: T) => boolean,
  limit = 80,
): History<T> {
  if (same(history.present, next)) return history;
  if (coalesce && history.coalescing) {
    return { ...history, present: next, future: [] };
  }
  const past = [...history.past, history.present];
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    present: next,
    future: [],
    coalescing: coalesce,
  };
}

export function undoHistory<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return { ...history, coalescing: false };
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    coalescing: false,
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    coalescing: false,
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}
