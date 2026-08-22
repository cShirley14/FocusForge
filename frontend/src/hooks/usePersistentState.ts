import { useState, useEffect, useRef } from "react";

const PREFIX = "focusforge:";

/**
 * useState backed by localStorage.
 *
 * Work-in-progress persistence: the app is not yet wired to DynamoDB, so a
 * refresh would otherwise wipe every task, piece, and rank. Storage failures
 * (private browsing, quota) degrade to plain in-memory state rather than
 * throwing.
 */
export function usePersistentState<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const storageKey = PREFIX + key;

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  // Skip the write on first render — nothing has changed yet.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* non-fatal: state stays in memory for this tab */
    }
  }, [storageKey, value]);

  return [value, setValue];
}

/** Remove every FocusForge key. Used by the reset control. */
export function clearPersistedState() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* non-fatal */
  }
}
