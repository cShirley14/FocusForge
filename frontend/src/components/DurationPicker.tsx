import {
  DURATION_PRESETS,
  STEP_SECONDS,
  MIN_SECONDS,
  MAX_SECONDS,
  normalizeSeconds,
  formatDuration,
  rarityForDuration,
  RARITY_LABEL,
} from "../lib/progression.js";
import { BREAK_PRESETS } from "../hooks/useTimer.js";

interface DurationPickerProps {
  seconds: number;
  disabled: boolean;
  onChange: (seconds: number) => void;
  /**
   * "focus" sizes the forging session; "cooldown" sizes the rest that follows.
   * The same control does double duty so the column never stacks two picker
   * rows — it simply re-labels for the moment that matters.
   */
  mode?: "focus" | "cooldown";
}

/**
 * Preset chips plus a 30-second stepper.
 *
 * Deliberately avoids `<input type="number">` — its native spinner arrows are
 * unstyleable across browsers and looked out of place. Stepping is explicit
 * and keyboard-operable via the buttons.
 */
export function DurationPicker({
  seconds,
  disabled,
  onChange,
  mode = "focus",
}: DurationPickerProps) {
  const isCooldown = mode === "cooldown";
  const presets = isCooldown ? BREAK_PRESETS : DURATION_PRESETS;
  const rarity = rarityForDuration(seconds / 60);
  const atMin = seconds <= MIN_SECONDS;
  const atMax = seconds >= MAX_SECONDS;

  const step = (delta: number) => onChange(normalizeSeconds(seconds + delta));

  return (
    <div className={`duration-picker ${isCooldown ? "is-cooldown" : ""}`}>
      {/* Presets and stepper share one row to keep the column short on
          short viewports; wraps only when there genuinely isn't width. */}
      <div className="duration-row">
        <div
          className="duration-presets"
          role="group"
          aria-label={isCooldown ? "Cooldown length presets" : "Session length presets"}
        >
          {presets.map((m) => {
            const secs = m * 60;
            return (
              <button
                key={m}
                type="button"
                className={`duration-chip ${seconds === secs ? "active" : ""}`}
                aria-pressed={seconds === secs}
                disabled={disabled}
                onClick={() => onChange(secs)}
              >
                {m}m
              </button>
            );
          })}
        </div>

        <div
          className="stepper"
          role="group"
          aria-label={isCooldown ? "Adjust cooldown length" : "Adjust session length"}
        >
        <button
          type="button"
          className="stepper-btn"
          onClick={() => step(-STEP_SECONDS)}
          disabled={disabled || atMin}
          aria-label="Decrease by 30 seconds"
        >
          −
        </button>

        <output className="stepper-value" aria-live="polite">
          {formatDuration(seconds)}
        </output>

        <button
          type="button"
          className="stepper-btn"
          onClick={() => step(STEP_SECONDS)}
          disabled={disabled || atMax}
          aria-label="Increase by 30 seconds"
        >
          +
        </button>
        </div>
      </div>

      {isCooldown ? (
        <p className="duration-reward duration-reward-cool">
          Rest, then back to the forge
        </p>
      ) : (
        <p className={`duration-reward rarity-${rarity}`}>
          Yields a <strong>{RARITY_LABEL[rarity]}</strong> piece
        </p>
      )}
    </div>
  );
}
