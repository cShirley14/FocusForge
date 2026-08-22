import { useState } from "react";
import { RARITY_LABEL, formatTotal, type Rarity } from "../lib/progression.js";
import type { ForgedItem } from "../App.js";

interface SmithyProps {
  items: ForgedItem[];
  latestId: string | null;
}

const COLLAPSED_LIMIT = 9;
const EMPTY_SLOTS = 6;

const RARITY_ORDER: Rarity[] = ["masterwork", "rare", "uncommon", "common"];

/**
 * The collection grows without bound, so the grid shows the most recent
 * pieces and rolls the rest into a per-rarity tally rather than an
 * endlessly scrolling wall.
 */
export function Smithy({ items, latestId }: SmithyProps) {
  const [expanded, setExpanded] = useState(false);

  const kept = items.filter((i) => !i.failed);
  const visible = expanded ? items : items.slice(0, COLLAPSED_LIMIT);
  const hidden = items.length - visible.length;
  const placeholders = Math.max(0, EMPTY_SLOTS - items.length);

  const tally = RARITY_ORDER.map((r) => ({
    rarity: r,
    count: kept.filter((i) => i.rarity === r).length,
  })).filter((t) => t.count > 0);

  return (
    <section className="smithy" aria-labelledby="smithy-heading">
      <div className="smithy-head">
        <h2 className="panel-title" id="smithy-heading">
          Smithy
        </h2>
        <span className="panel-note">
          {items.length === 0 ? "empty" : `${kept.length} kept`}
        </span>
      </div>

      {items.length === 0 && (
        <p className="smithy-hint">
          Finish a session to forge your first piece. Longer heats yield rarer
          work.
        </p>
      )}

      {tally.length > 0 && (
        <ul className="rarity-tally">
          {tally.map((t) => (
            <li key={t.rarity} className={`tally rarity-${t.rarity}`}>
              <span className="tally-count">{t.count}</span>
              <span className="tally-label">{RARITY_LABEL[t.rarity]}</span>
            </li>
          ))}
        </ul>
      )}

      <ul className="smithy-grid">
        {visible.map((item) => (
          <li
            key={item.id}
            className={[
              "smithy-slot filled",
              `rarity-${item.rarity}`,
              item.failed ? "failed" : "",
              item.id === latestId ? "just-forged" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={`${item.name} · ${formatTotal(item.seconds)} · ${item.taskTitle}`}
          >
            <span className="slot-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="slot-label">{item.name}</span>
            <span className="sr-only">
              {item.failed
                ? `Ruined piece from ${item.taskTitle}`
                : `${RARITY_LABEL[item.rarity]} ${item.name}, ${formatTotal(item.seconds)} session, from ${item.taskTitle}`}
            </span>
          </li>
        ))}

        {!expanded &&
          Array.from({ length: placeholders }).map((_, i) => (
            <li key={`empty-${i}`} className="smithy-slot empty" aria-hidden="true">
              <span className="slot-icon">⬡</span>
            </li>
          ))}
      </ul>

      {hidden > 0 && (
        <button className="btn-ghost btn-block" onClick={() => setExpanded(true)}>
          Show {hidden} more
        </button>
      )}
      {expanded && items.length > COLLAPSED_LIMIT && (
        <button className="btn-ghost btn-block" onClick={() => setExpanded(false)}>
          Collapse
        </button>
      )}
    </section>
  );
}
