import { useState, useRef, useCallback, useEffect } from "react";
import { usePersistentState } from "./usePersistentState.js";
import { normalizeSeconds } from "../lib/progression.js";

// "cooldown-ready" = focus finished, the piece is forged, but the break has not
// started. The user either starts it manually or, if they've opted in, it
// auto-starts. This exists so a break is never forced on anyone.
type TimerState = "idle" | "focus" | "cooldown-ready" | "break";

export const DEFAULT_FOCUS_SECONDS = 25 * 60;
export const DEFAULT_BREAK_SECONDS = 5 * 60;
/** Cooldown presets offered in the UI, in minutes. */
export const BREAK_PRESETS = [3, 5, 10, 15];

interface Persisted {
  state: TimerState;
  /** Epoch ms when the current phase ends. Null while idle or cooldown-ready. */
  endsAt: number | null;
  sessionSeconds: number;
  /** User-chosen cooldown length. */
  breakSeconds: number;
  /** When true, the cooldown starts automatically as a focus session ends. */
  autoStartBreak: boolean;
}

const INITIAL: Persisted = {
  state: "idle",
  endsAt: null,
  sessionSeconds: DEFAULT_FOCUS_SECONDS,
  breakSeconds: DEFAULT_BREAK_SECONDS,
  autoStartBreak: false,
};

interface UseTimerProps {
  /** Session length in seconds. */
  onComplete: (seconds: number) => void;
  onAbandon: () => void;
}

/**
 * Timer that survives a page refresh.
 *
 * Stores an absolute end timestamp rather than a remaining count, so wall-clock
 * time is what elapses. A refresh mid-session resumes; if the deadline passed
 * while the tab was closed, the session is credited on load. Refreshing is
 * therefore never punished — only an explicit quench scraps a piece.
 */
export function useTimer({ onComplete, onAbandon }: UseTimerProps) {
  const [persisted, setPersisted] = usePersistentState<Persisted>(
    "timer",
    INITIAL
  );

  const { state, endsAt, sessionSeconds, breakSeconds, autoStartBreak } = persisted;

  const remainingFrom = (end: number | null, fallbackSecs: number) =>
    end === null
      ? fallbackSecs
      : Math.max(0, Math.round((end - Date.now()) / 1000));

  const [timeLeft, setTimeLeft] = useState(() =>
    remainingFrom(endsAt, sessionSeconds)
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Latest callbacks without re-arming the interval every render.
  const cbRef = useRef({ onComplete, onAbandon });
  useEffect(() => {
    cbRef.current = { onComplete, onAbandon };
  }, [onComplete, onAbandon]);

  const totalSeconds = state === "break" ? breakSeconds : sessionSeconds;

  const setDuration = useCallback(
    (seconds: number) => {
      if (state !== "idle") return;
      const secs = normalizeSeconds(seconds);
      setPersisted((p) => ({ ...p, sessionSeconds: secs }));
      setTimeLeft(secs);
    },
    [state, setPersisted]
  );

  /** Cooldown length. Editable except while a break is actively counting down. */
  const setBreakDuration = useCallback(
    (seconds: number) => {
      if (state === "break") return;
      const secs = normalizeSeconds(seconds);
      setPersisted((p) => ({ ...p, breakSeconds: secs }));
      // In cooldown-ready the big display previews the break, so keep it in sync.
      if (state === "cooldown-ready") setTimeLeft(secs);
    },
    [state, setPersisted]
  );

  const setAutoStartBreak = useCallback(
    (value: boolean) => setPersisted((p) => ({ ...p, autoStartBreak: value })),
    [setPersisted]
  );

  /** Enter the cooldown chooser from idle — a rest taken on its own, no forge
   *  required. Parks in cooldown-ready so the length picker + start button show. */
  const enterCooldown = useCallback(() => {
    if (state !== "idle") return;
    setPersisted((p) => ({ ...p, state: "cooldown-ready", endsAt: null }));
    setTimeLeft(breakSeconds); // preview the cooldown length in the display
  }, [state, breakSeconds, setPersisted]);

  /** Begin the cooldown from the cooldown-ready state (manual start). */
  const startBreak = useCallback(() => {
    setPersisted((p) => ({
      ...p,
      state: "break",
      endsAt: Date.now() + p.breakSeconds * 1000,
    }));
    setTimeLeft(breakSeconds);
  }, [breakSeconds, setPersisted]);

  /** Skip the cooldown entirely from cooldown-ready, straight back to idle. */
  const skipCooldown = useCallback(() => {
    setPersisted((p) => ({ ...p, state: "idle", endsAt: null }));
    setTimeLeft(sessionSeconds);
  }, [sessionSeconds, setPersisted]);

  const start = useCallback(
    (seconds?: number) => {
      const secs = normalizeSeconds(seconds ?? sessionSeconds);
      setPersisted((p) => ({
        ...p,
        state: "focus",
        endsAt: Date.now() + secs * 1000,
        sessionSeconds: secs,
      }));
      setTimeLeft(secs);
    },
    [sessionSeconds, setPersisted]
  );

  const stop = useCallback(() => {
    clear();
    cbRef.current.onAbandon();
    setPersisted((p) => ({ ...p, state: "idle", endsAt: null }));
    setTimeLeft(sessionSeconds);
  }, [clear, sessionSeconds, setPersisted]);

  const reset = useCallback(() => {
    clear();
    setPersisted((p) => ({ ...p, state: "idle", endsAt: null }));
    setTimeLeft(sessionSeconds);
  }, [clear, sessionSeconds, setPersisted]);

  // Single tick loop driven off the stored deadline.
  useEffect(() => {
    if (state === "idle" || endsAt === null) {
      clear();
      return;
    }

    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left > 0) return;

      clear();
      if (state === "focus") {
        cbRef.current.onComplete(sessionSeconds);
        // The piece is forged. Only roll into a break if the user opted into
        // auto-start; otherwise park in cooldown-ready and let them choose.
        setPersisted((p) =>
          p.autoStartBreak
            ? { ...p, state: "break", endsAt: Date.now() + p.breakSeconds * 1000 }
            : { ...p, state: "cooldown-ready", endsAt: null }
        );
        // Show the break length rather than leaving the display at 0:00
        // (auto-start begins its own countdown immediately; cooldown-ready
        // previews the chosen length until the user starts it).
        setTimeLeft(breakSeconds);
      } else {
        setPersisted((p) => ({ ...p, state: "idle", endsAt: null }));
        setTimeLeft(sessionSeconds);
      }
    };

    tick(); // settle immediately on mount / after a refresh
    intervalRef.current = setInterval(tick, 1000);
    return clear;
  }, [state, endsAt, sessionSeconds, breakSeconds, clear, setPersisted]);

  const progress = totalSeconds > 0 ? timeLeft / totalSeconds : 1;

  return {
    state,
    timeLeft,
    totalTime: totalSeconds,
    progress,
    sessionSeconds,
    breakSeconds,
    autoStartBreak,
    setDuration,
    setBreakDuration,
    setAutoStartBreak,
    start,
    enterCooldown,
    startBreak,
    skipCooldown,
    stop,
    reset,
  };
}
