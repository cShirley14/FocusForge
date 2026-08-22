import { formatTotal } from "../lib/progression.js";

interface StatsStripProps {
  streak: number;
  forgedCount: number;
  ruinedCount: number;
  focusSeconds: number;
  xp: number;
}

/**
 * Always rendered, including at zero — the goal has to be visible before
 * the user has earned anything, otherwise the hook is invisible on first run.
 */
export function StatsStrip({
  streak,
  forgedCount,
  ruinedCount,
  focusSeconds,
  xp,
}: StatsStripProps) {
  return (
    <dl className="stats-strip">
      <div className="stat">
        <dt>
          <span aria-hidden="true">🔥</span> Streak
        </dt>
        <dd>{streak}</dd>
      </div>
      <div className="stat">
        <dt>
          <span aria-hidden="true">⚒️</span> Forged
        </dt>
        <dd>{forgedCount}</dd>
      </div>
      <div className="stat">
        <dt>
          <span aria-hidden="true">⏱️</span> Focus
        </dt>
        <dd>{formatTotal(focusSeconds)}</dd>
      </div>
      <div className="stat">
        <dt>
          <span aria-hidden="true">⭐</span> XP
        </dt>
        <dd>{xp}</dd>
      </div>
      {ruinedCount > 0 && (
        <div className="stat stat-bad">
          <dt>
            <span aria-hidden="true">💀</span> Ruined
          </dt>
          <dd>{ruinedCount}</dd>
        </div>
      )}
    </dl>
  );
}
