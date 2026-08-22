import { useState, useRef, useCallback, useEffect } from "react";
import { usePersistentState } from "./usePersistentState.js";
import { normalizeSeconds } from "../lib/progression.js";

type TimerState = "idle" | "focus" | "break";

export const DEFAULT_FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

interface Persisted {
  state: TimerState;
  /** Epoch ms when the current phase ends. Null while idle. */
  endsAt: number | null;
  sessionSeconds: number;
}

const INITIAL: Persisted = {
  state: "idle",
  endsAt: null,
  sessionSeconds: DEFAULT_FOCUS_SECONDS,
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

  const { state, endsAt, sessionSeconds } = persisted;

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

  const totalSeconds = state === "break" ? BREAK_SECONDS : sessionSeconds;

  const setDuration = useCallback(
    (seconds: number) => {
      if (state !== "idle") return;
      const secs = normalizeSeconds(seconds);
      setPersisted((p) => ({ ...p, sessionSeconds: secs }));
      setTimeLeft(secs);
    },
    [state, setPersisted]
  );

  const start = useCallback(
    (seconds?: number) => {
      const secs = normalizeSeconds(seconds ?? sessionSeconds);
      setPersisted({
        state: "focus",
        endsAt: Date.now() + secs * 1000,
        sessionSeconds: secs,
      });
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
        setPersisted((p) => ({
          ...p,
          state: "break",
          endsAt: Date.now() + BREAK_SECONDS * 1000,
        }));
      } else {
        setPersisted((p) => ({ ...p, state: "idle", endsAt: null }));
        setTimeLeft(sessionSeconds);
      }
    };

    tick(); // settle immediately on mount / after a refresh
    intervalRef.current = setInterval(tick, 1000);
    return clear;
  }, [state, endsAt, sessionSeconds, clear, setPersisted]);

  const progress = totalSeconds > 0 ? timeLeft / totalSeconds : 1;

  return {
    state,
    timeLeft,
    totalTime: totalSeconds,
    progress,
    sessionSeconds,
    setDuration,
    start,
    stop,
    reset,
  };
}
