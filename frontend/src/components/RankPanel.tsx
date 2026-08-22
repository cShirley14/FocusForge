import { rankProgress, earnedBadges, type BadgeStats } from "../lib/progression.js";

interface RankPanelProps {
  stats: BadgeStats;
}

function fmt(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Rank ladder plus badge wall. Locked badges stay visible so there is always
 * a next goal rather than an empty panel.
 */
export function RankPanel({ stats }: RankPanelProps) {
  const p = rankProgress(stats.focusMinutes);
  const badges = earnedBadges(stats);
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const pct = Math.round(p.fraction * 100);

  return (
    <section className="rank-panel" aria-labelledby="rank-heading">
      <div className="rank-head">
        <h2 className="panel-title" id="rank-heading">
          Trade Rank
        </h2>
        <span className="panel-note">Lv {p.level}</span>
      </div>

      <p className="rank-title">{p.rank.title}</p>

      <div
        className="rank-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          p.next
            ? `${pct}% toward ${p.next.title}`
            : "Highest rank reached"
        }
      >
        <span className="rank-fill" style={{ width: `${pct}%` }} />
      </div>

      <p className="rank-next">
        {p.next
          ? `${fmt(p.minutesToNext)} of focus to ${p.next.title}`
          : "Highest rank reached"}
      </p>

      <div className="badge-head">
        <h3 className="fm-sub">
          Badges{" "}
          <span className="panel-note">
            {unlockedCount}/{badges.length}
          </span>
        </h3>
      </div>

      <ul className="badge-grid">
        {badges.map((b) => (
          <li
            key={b.id}
            className={`badge ${b.unlocked ? "unlocked" : "locked"}`}
            title={b.unlocked ? b.title : `${b.title} — ${b.hint}`}
          >
            <span className="badge-icon" aria-hidden="true">
              {b.unlocked ? b.icon : "🔒"}
            </span>
            <span className="sr-only">
              {b.unlocked
                ? `${b.title}, earned`
                : `${b.title}, locked. ${b.hint}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
