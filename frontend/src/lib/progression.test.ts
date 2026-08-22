import { describe, it, expect } from "vitest";
import {
  rarityForDuration,
  pieceForDuration,
  rankProgress,
  earnedBadges,
  xpForSession,
  RANKS,
  type BadgeStats,
} from "./progression.js";

describe("rarityForDuration", () => {
  it("scales rarity with committed time", () => {
    expect(rarityForDuration(10)).toBe("common");
    expect(rarityForDuration(19)).toBe("common");
    expect(rarityForDuration(20)).toBe("uncommon");
    expect(rarityForDuration(34)).toBe("uncommon");
    expect(rarityForDuration(35)).toBe("rare");
    expect(rarityForDuration(49)).toBe("rare");
    expect(rarityForDuration(50)).toBe("masterwork");
    expect(rarityForDuration(120)).toBe("masterwork");
  });
});

describe("pieceForDuration", () => {
  it("draws from the pool matching the session length", () => {
    // Deterministic rand -> always first item in the pool
    const first = () => 0;
    expect(pieceForDuration(15, first).rarity).toBe("common");
    expect(pieceForDuration(25, first).rarity).toBe("uncommon");
    expect(pieceForDuration(45, first).rarity).toBe("rare");
    expect(pieceForDuration(60, first).rarity).toBe("masterwork");
  });

  it("stays in bounds at the top of the random range", () => {
    // Math.random() never returns 1, but guard the boundary anyway
    const nearOne = () => 0.999999;
    expect(pieceForDuration(60, nearOne)).toBeDefined();
    expect(pieceForDuration(60, nearOne).name).toBeTruthy();
  });
});

describe("xpForSession", () => {
  it("grows with duration", () => {
    expect(xpForSession(45)).toBeGreaterThan(xpForSession(25));
    expect(xpForSession(25)).toBeGreaterThan(xpForSession(15));
  });

  it("pays a rarity bonus so long sessions beat splitting them up", () => {
    // One 60m masterwork should beat four 15m commons of equal raw minutes
    expect(xpForSession(60)).toBeGreaterThan(4 * xpForSession(15));
  });
});

describe("rankProgress", () => {
  it("starts at Apprentice", () => {
    const p = rankProgress(0);
    expect(p.rank.title).toBe("Apprentice");
    expect(p.level).toBe(1);
    expect(p.next?.title).toBe("Striker");
  });

  it("promotes exactly at the threshold", () => {
    expect(rankProgress(119).rank.title).toBe("Apprentice");
    expect(rankProgress(120).rank.title).toBe("Striker");
  });

  it("reports fractional progress toward the next rank", () => {
    // Halfway between Apprentice (0) and Striker (120)
    const p = rankProgress(60);
    expect(p.fraction).toBeCloseTo(0.5, 5);
    expect(p.minutesToNext).toBe(60);
  });

  it("caps at the final rank without a next target", () => {
    const top = RANKS[RANKS.length - 1];
    const p = rankProgress(top.atMinutes + 10_000);
    expect(p.rank.title).toBe(top.title);
    expect(p.next).toBeNull();
    expect(p.fraction).toBe(1);
    expect(p.minutesToNext).toBe(0);
  });
});

describe("earnedBadges", () => {
  const base: BadgeStats = {
    kept: 0,
    ruined: 0,
    streak: 0,
    bestStreak: 0,
    focusMinutes: 0,
    longestSessionMinutes: 0,
    masterworkCount: 0,
  };

  it("unlocks nothing on a fresh account", () => {
    expect(earnedBadges(base).filter((b) => b.unlocked)).toHaveLength(0);
  });

  it("unlocks First Strike after one kept piece", () => {
    const got = earnedBadges({ ...base, kept: 1 });
    expect(got.find((b) => b.id === "first-piece")?.unlocked).toBe(true);
  });

  it("withholds Flawless Run once a piece has been scrapped", () => {
    const clean = earnedBadges({ ...base, kept: 5, ruined: 0 });
    expect(clean.find((b) => b.id === "flawless")?.unlocked).toBe(true);

    const scrapped = earnedBadges({ ...base, kept: 5, ruined: 1 });
    expect(scrapped.find((b) => b.id === "flawless")?.unlocked).toBe(false);
  });

  it("keeps streak badges on best streak, not current", () => {
    // Streak was broken, but the best run should still count
    const got = earnedBadges({ ...base, streak: 0, bestStreak: 7 });
    expect(got.find((b) => b.id === "streak-3")?.unlocked).toBe(true);
    expect(got.find((b) => b.id === "streak-7")?.unlocked).toBe(true);
  });

  it("always returns every badge so locked ones can be shown as goals", () => {
    expect(earnedBadges(base)).toHaveLength(earnedBadges({ ...base, kept: 99 }).length);
  });
});

/* ─── Renewable goals ─── */

import {
  isoWeek,
  weeklyChallenges,
  setProgress,
  setSize,
  formatBests,
  RARITY_TIERS,
  type WeeklyProgress,
} from "./progression.js";

describe("weeklyChallenges", () => {
  it("returns three challenges", () => {
    expect(weeklyChallenges(new Date(2026, 7, 20))).toHaveLength(3);
  });

  it("is deterministic for a given week", () => {
    const a = weeklyChallenges(new Date(2026, 7, 20));
    const b = weeklyChallenges(new Date(2026, 7, 20));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("rotates between different weeks", () => {
    const w1 = weeklyChallenges(new Date(2026, 7, 20));
    const w2 = weeklyChallenges(new Date(2026, 7, 27));
    expect(w1.map((c) => c.id)).not.toEqual(w2.map((c) => c.id));
  });

  it("never returns duplicates within a week", () => {
    // Walk a year of weeks; each set must have three distinct challenges
    for (let d = 0; d < 52; d++) {
      const date = new Date(2026, 0, 1 + d * 7);
      const ids = weeklyChallenges(date).map((c) => c.id);
      expect(new Set(ids).size).toBe(3);
    }
  });

  it("keeps regenerating indefinitely — no exhaustion", () => {
    // The whole point: unlike badges, this never runs dry
    const seen = new Set<string>();
    for (let d = 0; d < 104; d++) {
      const date = new Date(2026, 0, 1 + d * 7);
      weeklyChallenges(date).forEach((c) => seen.add(c.id));
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it("measures progress against the weekly tally", () => {
    const w: WeeklyProgress = {
      keptThisWeek: 4,
      rareOrBetterThisWeek: 1,
      minutesThisWeek: 120,
      cleanRunThisWeek: 4,
      longestThisWeek: 45,
    };
    for (const c of weeklyChallenges(new Date(2026, 7, 20))) {
      expect(c.current(w)).toBeGreaterThanOrEqual(0);
      expect(c.target).toBeGreaterThan(0);
    }
  });
});

describe("isoWeek", () => {
  it("gives stable week numbers inside the same week", () => {
    // Mon 2026-08-17 .. Sun 2026-08-23
    expect(isoWeek(new Date(2026, 7, 17))).toBe(isoWeek(new Date(2026, 7, 21)));
  });

  it("advances across a week boundary", () => {
    expect(isoWeek(new Date(2026, 7, 24))).toBe(
      isoWeek(new Date(2026, 7, 17)) + 1
    );
  });
});

describe("setProgress", () => {
  it("reports zero collected for a new account", () => {
    const sets = setProgress([]);
    expect(sets).toHaveLength(RARITY_TIERS.length);
    expect(sets.every((s) => s.collected === 0)).toBe(true);
    expect(sets.every((s) => !s.complete)).toBe(true);
  });

  it("counts distinct pieces, not duplicates", () => {
    const sets = setProgress(["Rivet", "Rivet", "Rivet"]);
    const common = sets.find((s) => s.rarity === "common")!;
    expect(common.collected).toBe(1);
  });

  it("marks a set complete only when every piece is owned", () => {
    const sets = setProgress([
      "Twin Blades",
      "Warhammer",
      "Crown",
      "Great Chalice",
    ]);
    const mw = sets.find((s) => s.rarity === "masterwork")!;
    expect(mw.collected).toBe(setSize("masterwork"));
    expect(mw.complete).toBe(true);
  });

  it("ignores unknown names", () => {
    const sets = setProgress(["Not A Real Piece"]);
    expect(sets.every((s) => s.collected === 0)).toBe(true);
  });
});

describe("formatBests", () => {
  it("shows placeholders before any record exists", () => {
    const out = formatBests(
      { longestSessionMinutes: 0, bestStreak: 0, bestWeekMinutes: 0 },
      null
    );
    expect(out.every((r) => r.value === "—")).toBe(true);
    expect(out.every((r) => !r.isNew)).toBe(true);
  });

  it("flags only the record just beaten", () => {
    const out = formatBests(
      { longestSessionMinutes: 60, bestStreak: 4, bestWeekMinutes: 300 },
      "bestStreak"
    );
    expect(out.find((r) => r.label === "Best streak")!.isNew).toBe(true);
    expect(out.find((r) => r.label === "Longest heat")!.isNew).toBe(false);
  });
});

/* ─── Duration helpers (30-second granularity) ─── */

import {
  normalizeSeconds,
  formatDuration,
  formatTotal,
  MIN_SECONDS,
  MAX_SECONDS,
  STEP_SECONDS,
} from "./progression.js";

describe("normalizeSeconds", () => {
  it("snaps to the nearest 30-second step", () => {
    expect(normalizeSeconds(100)).toBe(90);
    expect(normalizeSeconds(105)).toBe(120);
    expect(normalizeSeconds(1500)).toBe(1500);
  });

  it("clamps to the 1-minute floor", () => {
    expect(normalizeSeconds(0)).toBe(MIN_SECONDS);
    expect(normalizeSeconds(-500)).toBe(MIN_SECONDS);
    expect(normalizeSeconds(10)).toBe(MIN_SECONDS);
  });

  it("clamps to the 2-hour ceiling", () => {
    expect(normalizeSeconds(999_999)).toBe(MAX_SECONDS);
  });

  it("allows a 1-minute session", () => {
    // Previously the floor was 5 minutes, which was arbitrary
    expect(normalizeSeconds(60)).toBe(60);
  });

  it("stays on-step when walked from the floor to the ceiling", () => {
    let v = MIN_SECONDS;
    while (v < MAX_SECONDS) {
      expect(v % STEP_SECONDS).toBe(0);
      v = normalizeSeconds(v + STEP_SECONDS);
    }
    expect(v).toBe(MAX_SECONDS);
  });
});

describe("formatDuration", () => {
  it("renders m:ss", () => {
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(1500)).toBe("25:00");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(7200)).toBe("120:00");
  });
});

describe("formatTotal", () => {
  it("renders seconds, minutes and hours appropriately", () => {
    expect(formatTotal(30)).toBe("30s");
    expect(formatTotal(90)).toBe("1m");
    expect(formatTotal(1500)).toBe("25m");
    expect(formatTotal(3600)).toBe("1h");
    expect(formatTotal(4500)).toBe("1h 15m");
  });
});

describe("rarity with sub-minute precision", () => {
  it("keeps thresholds correct for fractional minutes", () => {
    expect(rarityForDuration(1170 / 60)).toBe("common"); // 19.5m — under 20
    expect(rarityForDuration(1230 / 60)).toBe("uncommon"); // 20.5m
    expect(rarityForDuration(90 / 60)).toBe("common"); // 1.5m
    expect(rarityForDuration(2970 / 60)).toBe("rare"); // 49.5m
    expect(rarityForDuration(3030 / 60)).toBe("masterwork"); // 50.5m
  });
});
