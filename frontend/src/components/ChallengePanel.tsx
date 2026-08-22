import {
  weeklyChallenges,
  setProgress,
  formatBests,
  RARITY_LABEL,
  type WeeklyProgress,
  type PersonalBests,
} from "../lib/progression.js";

interface ChallengePanelProps {
  weekly: WeeklyProgress;
  collectedNames: string[];
  bests: PersonalBests;
}

/**
 * The renewable half of progression. Weekly challenges rotate forever, sets
 * reward variety over grinding, and bests are beaten rather than defended —
 * so there is always a next goal after the rank ladder caps out.
 */
export function ChallengePanel({
  weekly,
  collectedNames,
  bests,
}: ChallengePanelProps) {
  const challenges = weeklyChallenges();
  const sets = setProgress(collectedNames);
  const records = formatBests(bests, null);

  return (
    <section className="challenge-panel" aria-labelledby="ch-heading">
      <div className="rank-head">
        <h2 className="panel-title" id="ch-heading">
          This Week
        </h2>
        <span className="panel-note">resets Monday</span>
      </div>

      <ul className="challenge-list">
        {challenges.map((c) => {
          const current = Math.min(c.current(weekly), c.target);
          const pct = Math.round((current / c.target) * 100);
          const done = current >= c.target;

          return (
            <li key={c.id} className={`challenge ${done ? "done" : ""}`}>
              <span className="ch-icon" aria-hidden="true">
                {done ? "✅" : c.icon}
              </span>
              <div className="ch-main">
                <span className="ch-title">{c.title}</span>
                <div
                  className="ch-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={c.target}
                  aria-valuenow={current}
                  aria-label={`${c.title}: ${current} of ${c.target}`}
                >
                  <span className="ch-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="ch-count">
                {current}/{c.target}
                {done && <em className="ch-xp">+{c.xpReward} XP</em>}
              </span>
            </li>
          );
        })}
      </ul>

      <h3 className="fm-sub set-heading">Collections</h3>
      <ul className="set-list">
        {sets.map((s) => (
          <li key={s.rarity} className={`set-row rarity-${s.rarity}`}>
            <span className="set-label">{RARITY_LABEL[s.rarity]}</span>
            <span className="set-pips" aria-hidden="true">
              {Array.from({ length: s.total }).map((_, i) => (
                <span key={i} className={`pip ${i < s.collected ? "on" : ""}`} />
              ))}
            </span>
            <span className="set-count">
              {s.collected}/{s.total}
              {s.complete && " ✓"}
            </span>
            <span className="sr-only">
              {RARITY_LABEL[s.rarity]} set: {s.collected} of {s.total} collected
              {s.complete ? ", complete" : ""}
            </span>
          </li>
        ))}
      </ul>

      <h3 className="fm-sub set-heading">Personal bests</h3>
      <dl className="bests-list">
        {records.map((r) => (
          <div className="best-row" key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
