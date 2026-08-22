import { useEffect } from "react";
import { RARITY_LABEL, formatTotal } from "../lib/progression.js";
import type { ForgedItem } from "../App.js";

interface ForgeRevealProps {
  item: ForgedItem;
  onClose: () => void;
}

/** The completion moment — sized to the reward so long sessions land harder. */
export function ForgeReveal({ item, onClose }: ForgeRevealProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4600);
    return () => clearTimeout(t);
  }, [onClose]);

  const ruined = item.failed;

  // Bigger commitments get a bigger burst.
  const sparkCount = ruined
    ? 0
    : { common: 10, uncommon: 14, rare: 20, masterwork: 28 }[item.rarity];

  return (
    <div className="reveal-backdrop" onClick={onClose}>
      <div
        className={`reveal ${ruined ? "ruined" : `rarity-${item.rarity}`}`}
        role="alertdialog"
        aria-live="assertive"
        aria-labelledby="reveal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {sparkCount > 0 && (
          <div className="reveal-sparks" aria-hidden="true">
            {Array.from({ length: sparkCount }).map((_, i) => (
              <span
                key={i}
                className="reveal-spark"
                style={{
                  ["--angle" as string]: `${(360 / sparkCount) * i}deg`,
                  ["--delay" as string]: `${i * 0.015}s`,
                }}
              />
            ))}
          </div>
        )}

        <span className="reveal-icon" aria-hidden="true">
          {item.icon}
        </span>

        <p className="reveal-kicker">
          {ruined ? "Piece ruined" : `${RARITY_LABEL[item.rarity]} forged`}
        </p>

        <h2 className="reveal-title" id="reveal-title">
          {ruined ? "The metal cooled wrong" : item.name}
        </h2>

        <p className="reveal-task">{item.taskTitle}</p>

        {ruined ? (
          <p className="reveal-note">Streak reset to zero.</p>
        ) : (
          <p className="reveal-meta">
            {formatTotal(item.seconds)} heat
          </p>
        )}

        <button className="btn-ghost" onClick={onClose}>
          {ruined ? "Try again" : "Back to the forge"}
        </button>
      </div>
    </div>
  );
}
