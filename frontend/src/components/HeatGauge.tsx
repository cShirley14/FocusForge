import { useMemo } from "react";
import { formatTotal } from "../lib/progression.js";

interface HeatGaugeProps {
  /** 1 = full time remaining, 0 = done. */
  progress: number;
  state: "idle" | "focus" | "break";
  /** Total planned session length in seconds, for the scale label. */
  sessionSeconds: number;
}

const SEGMENTS = 44;

/**
 * A forge pyrometer rather than another countdown ring.
 *
 * Segments come up to temperature left-to-right and ramp dull-red → orange →
 * yellow → white, so the gauge reads as how hot the work is rather than
 * merely how much clock is left.
 */
export function HeatGauge({ progress, state, sessionSeconds }: HeatGaugeProps) {
  const isIdle = state === "idle";
  const isBreak = state === "break";
  const heat = isIdle ? 0 : 1 - progress;
  const litCount = Math.round(heat * SEGMENTS);

  const segments = useMemo(
    () =>
      Array.from({ length: SEGMENTS }, (_, i) => ({
        at: i / (SEGMENTS - 1),
        lit: i < litCount,
      })),
    [litCount]
  );

  return (
    <div
      className={`gauge ${isBreak ? "cooling" : ""} ${isIdle ? "cold" : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(heat * 100)}
      aria-label={
        isBreak
          ? "Cooling period"
          : `Working heat, ${Math.round(heat * 100)} percent through the session`
      }
    >
      <div className="gauge-track" aria-hidden="true">
        {segments.map((s, i) => (
          <span
            key={i}
            className={`gauge-seg ${s.lit ? "lit" : ""}`}
            style={{ ["--seg-pos" as string]: s.at.toFixed(3) }}
          />
        ))}
      </div>

      <div className="gauge-scale" aria-hidden="true">
        <span>cold</span>
        <span className="gauge-scale-mid">{formatTotal(sessionSeconds)} heat</span>
        <span>white</span>
      </div>
    </div>
  );
}
