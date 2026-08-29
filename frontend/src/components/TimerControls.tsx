import type { Task } from "../App.js";

interface TimerControlsProps {
  state: "idle" | "focus" | "cooldown-ready" | "break";
  timeLeft: number;
  activeTask: Task | null;
  nextAction: "add" | "select" | "start" | "working";
  onStart: () => void;
  onStop: () => void;
  onSkipBreak: () => void;
  /** Begin the cooldown from the cooldown-ready state. */
  onStartBreak: () => void;
  /** Dismiss the cooldown offer and return straight to idle. */
  onSkipCooldown: () => void;
  /** Enter the cooldown chooser from idle (a rest with no forge first). */
  onEnterCooldown: () => void;
  /** Cooldown length in seconds, for the "Start cooldown" label. */
  breakSeconds: number;
}

const GUIDANCE: Record<string, string> = {
  add: "Add a task in the queue to begin",
  select: "Pick a task from the queue",
  start: "Ready — the iron is on the anvil",
  working: "",
};

export function TimerControls({
  state,
  timeLeft,
  activeTask,
  nextAction,
  onStart,
  onStop,
  onSkipBreak,
  onStartBreak,
  onSkipCooldown,
  onEnterCooldown,
  breakSeconds,
}: TimerControlsProps) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const display = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
  const breakMin = Math.round(breakSeconds / 60);

  return (
    <div className="timer-block">
      <p className="timer-display" aria-live="off">
        {display}
      </p>

      {/* One clear statement of what to do next, always present */}
      <p className="timer-guidance">
        {state === "focus" ? (
          <span className="guidance-active">
            Forging{activeTask ? ` · ${activeTask.title}` : ""}
          </span>
        ) : state === "cooldown-ready" ? (
          <span>Piece forged — rest when you're ready</span>
        ) : state === "break" ? (
          <span>Cooling down — next piece in {display}</span>
        ) : (
          <span>{GUIDANCE[nextAction]}</span>
        )}
      </p>

      <div className="timer-buttons">
        {state === "idle" && (
          <>
            <button
              onClick={onStart}
              disabled={nextAction !== "start"}
              className="btn-primary"
            >
              <span aria-hidden="true">🔥</span> Start forging
            </button>
            <button
              onClick={onEnterCooldown}
              className="btn-cool-ghost"
              title="Take a timed rest without forging first"
            >
              <span aria-hidden="true">❄️</span> Cooldown
            </button>
          </>
        )}
        {state === "focus" && (
          <button onClick={onStop} className="btn-danger">
            Quench — ruins the piece
          </button>
        )}
        {state === "cooldown-ready" && (
          <>
            <button onClick={onStartBreak} className="btn-cool">
              <span aria-hidden="true">❄️</span> Start {breakMin}m cooldown
            </button>
            <button onClick={onSkipCooldown} className="btn-secondary">
              Skip, back to the forge
            </button>
          </>
        )}
        {state === "break" && (
          <button onClick={onSkipBreak} className="btn-secondary">
            Skip break
          </button>
        )}
      </div>

      {state === "focus" && (
        <p className="timer-warning">
          <span aria-hidden="true">⚠️</span> Leaving now scraps this piece and
          resets your streak
        </p>
      )}
    </div>
  );
}
