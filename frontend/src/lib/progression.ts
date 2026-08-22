/**
 * Progression rules for FocusForge.
 *
 * Design intent: reward must scale with committed effort. A 15-minute session
 * and a 60-minute session previously rolled from the same item pool, which
 * made the collection feel arbitrary. Longer heats now yield rarer pieces and
 * proportionally more XP.
 *
 * Pure functions only — no React, no storage — so this is directly testable.
 */

export type Rarity = "common" | "uncommon" | "rare" | "masterwork";

export interface Piece {
  icon: string;
  name: string;
  rarity: Rarity;
}

/** Session presets offered in the UI, in minutes. Custom values allowed too. */
export const DURATION_PRESETS = [5, 15, 25, 45, 60] as const;

/**
 * Duration is tracked in seconds so sessions can be tuned in 30-second steps.
 * Rarity and XP still reason in minutes, and accept fractional values.
 */
export const STEP_SECONDS = 30;
export const MIN_SECONDS = 60; // 1 minute
export const MAX_SECONDS = 120 * 60; // 2 hours

/** Clamp to range and snap to the nearest 30-second step. */
export function normalizeSeconds(seconds: number): number {
  const snapped = Math.round(seconds / STEP_SECONDS) * STEP_SECONDS;
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, snapped));
}

/** `90` → `"1:30"`, `1500` → `"25:00"`. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Human total, e.g. `"2h 15m"`, `"45m"`, `"90s"`. */
export function formatTotal(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const totalMin = Math.floor(seconds / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Rarity is decided purely by how long you committed to the heat. */
export function rarityForDuration(minutes: number): Rarity {
  if (minutes >= 50) return "masterwork";
  if (minutes >= 35) return "rare";
  if (minutes >= 20) return "uncommon";
  return "common";
}

const POOLS: Record<Rarity, Piece[]> = {
  common: [
    { icon: "🔩", name: "Rivet", rarity: "common" },
    { icon: "🪝", name: "Hook", rarity: "common" },
    { icon: "🔗", name: "Chain Link", rarity: "common" },
    { icon: "📌", name: "Nail", rarity: "common" },
  ],
  uncommon: [
    { icon: "🧲", name: "Horseshoe", rarity: "uncommon" },
    { icon: "🪛", name: "Chisel", rarity: "uncommon" },
    { icon: "🗝️", name: "Iron Key", rarity: "uncommon" },
    { icon: "⚙️", name: "Gear", rarity: "uncommon" },
  ],
  rare: [
    { icon: "🗡️", name: "Dagger", rarity: "rare" },
    { icon: "🪓", name: "Broad Axe", rarity: "rare" },
    { icon: "🛡️", name: "Shield", rarity: "rare" },
    { icon: "⛏️", name: "Pickaxe", rarity: "rare" },
  ],
  masterwork: [
    { icon: "⚔️", name: "Twin Blades", rarity: "masterwork" },
    { icon: "🔨", name: "Warhammer", rarity: "masterwork" },
    { icon: "👑", name: "Crown", rarity: "masterwork" },
    { icon: "🏆", name: "Great Chalice", rarity: "masterwork" },
  ],
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  masterwork: "Masterwork",
};

/** Pick a piece appropriate to the session length. */
export function pieceForDuration(
  minutes: number,
  rand: () => number = Math.random
): Piece {
  const pool = POOLS[rarityForDuration(minutes)];
  return pool[Math.floor(rand() * pool.length)];
}

/* ─────────────────────────── Ranks ─────────────────────────── */

export interface Rank {
  title: string;
  /** Cumulative focus minutes required to hold this rank. */
  atMinutes: number;
}

export const RANKS: Rank[] = [
  { title: "Apprentice", atMinutes: 0 },
  { title: "Striker", atMinutes: 120 },
  { title: "Journeyman", atMinutes: 360 },
  { title: "Smith", atMinutes: 720 },
  { title: "Master Smith", atMinutes: 1500 },
  { title: "Forgemaster", atMinutes: 3000 },
  { title: "Legend of the Anvil", atMinutes: 6000 },
];

export interface RankProgress {
  rank: Rank;
  level: number; // 1-indexed
  next: Rank | null;
  /** 0–1 toward the next rank; 1 when maxed. */
  fraction: number;
  minutesToNext: number;
}

export function rankProgress(focusMinutes: number): RankProgress {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (focusMinutes >= RANKS[i].atMinutes) idx = i;
  }
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;

  if (!next) {
    return { rank, level: idx + 1, next: null, fraction: 1, minutesToNext: 0 };
  }

  const span = next.atMinutes - rank.atMinutes;
  const into = focusMinutes - rank.atMinutes;
  return {
    rank,
    level: idx + 1,
    next,
    fraction: Math.min(1, into / span),
    minutesToNext: Math.max(0, next.atMinutes - focusMinutes),
  };
}

/* ─────────────────────────── Badges ─────────────────────────── */

export interface BadgeDef {
  id: string;
  icon: string;
  title: string;
  hint: string;
}

export interface BadgeStats {
  kept: number;
  ruined: number;
  streak: number;
  bestStreak: number;
  focusMinutes: number;
  longestSessionMinutes: number;
  masterworkCount: number;
}

export const BADGES: (BadgeDef & { earned: (s: BadgeStats) => boolean })[] = [
  {
    id: "first-piece",
    icon: "🔨",
    title: "First Strike",
    hint: "Forge your first piece",
    earned: (s) => s.kept >= 1,
  },
  {
    id: "ten-pieces",
    icon: "📦",
    title: "Stocked Shelf",
    hint: "Forge 10 pieces",
    earned: (s) => s.kept >= 10,
  },
  {
    id: "streak-3",
    icon: "🔥",
    title: "Coals Kept Warm",
    hint: "Reach a 3-session streak",
    earned: (s) => s.bestStreak >= 3,
  },
  {
    id: "streak-7",
    icon: "🌋",
    title: "Furnace Discipline",
    hint: "Reach a 7-session streak",
    earned: (s) => s.bestStreak >= 7,
  },
  {
    id: "flawless",
    icon: "💎",
    title: "Flawless Run",
    hint: "Forge 5 pieces without scrapping one",
    earned: (s) => s.kept >= 5 && s.ruined === 0,
  },
  {
    id: "masterwork",
    icon: "👑",
    title: "Masterwork",
    hint: "Complete a 50-minute session",
    earned: (s) => s.masterworkCount >= 1,
  },
  {
    id: "long-haul",
    icon: "⏳",
    title: "Long Haul",
    hint: "Complete a single 60-minute session",
    earned: (s) => s.longestSessionMinutes >= 60,
  },
  {
    id: "ten-hours",
    icon: "🏅",
    title: "Ten Hours Deep",
    hint: "Accumulate 10 hours of focus",
    earned: (s) => s.focusMinutes >= 600,
  },
];

export function earnedBadges(stats: BadgeStats) {
  return BADGES.map((b) => ({ ...b, unlocked: b.earned(stats) }));
}

/** XP awarded for a completed session — linear in minutes, bonus for rarity. */
export function xpForSession(minutes: number): number {
  const multiplier = { common: 1, uncommon: 1.15, rare: 1.35, masterwork: 1.6 }[
    rarityForDuration(minutes)
  ];
  return Math.round(minutes * multiplier);
}

/* ═══════════════════════════════════════════════════════════════════
   Renewable goals
   ═══════════════════════════════════════════════════════════════════
   The rank ladder is finite by design — it caps at 6000 minutes and then
   has nothing left to offer. Rather than adding decay (which punishes
   users for ordinary life and drives the streak-anxiety failure mode),
   progression past the ceiling comes from goals that regenerate:

     · weekly challenges that rotate on a fixed schedule
     · collection sets that reward varying session length
     · personal bests, which you beat rather than maintain

   Rank itself never decays. It is a record of work done, not a status
   to defend.
   ═══════════════════════════════════════════════════════════════════ */

/**
 * ISO-8601 week number, computed entirely in local time so the challenge
 * week rolls over at the user's midnight.
 *
 * Deliberately avoids mixing local getters with UTC-constructed dates — that
 * combination shifts the boundary by a day in any non-UTC timezone.
 */
export function isoWeek(date: Date): number {
  const toMonday0 = (d: Date) => (d.getDay() + 6) % 7; // Mon=0 … Sun=6

  // Thursday of the target's ISO week determines which year the week belongs to.
  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  thursday.setDate(thursday.getDate() - toMonday0(thursday) + 3);

  // Week 1 is the week containing Jan 4th.
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() - toMonday0(firstThursday) + 3);

  const weeks = Math.round(
    (thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000)
  );
  return 1 + weeks;
}

export interface WeeklyProgress {
  keptThisWeek: number;
  rareOrBetterThisWeek: number;
  minutesThisWeek: number;
  cleanRunThisWeek: number;
  longestThisWeek: number;
}

export interface Challenge {
  id: string;
  icon: string;
  title: string;
  target: number;
  current: (w: WeeklyProgress) => number;
  /** XP granted once, when the challenge is completed. */
  xpReward: number;
}

const CHALLENGE_POOL: Challenge[] = [
  { id: "forge-5", icon: "⚒️", title: "Forge 5 pieces", target: 5, current: (w) => w.keptThisWeek, xpReward: 50 },
  { id: "forge-10", icon: "📦", title: "Forge 10 pieces", target: 10, current: (w) => w.keptThisWeek, xpReward: 120 },
  { id: "rare-3", icon: "💠", title: "Forge 3 Rare or better", target: 3, current: (w) => w.rareOrBetterThisWeek, xpReward: 100 },
  { id: "rare-1", icon: "💠", title: "Forge a Rare or better", target: 1, current: (w) => w.rareOrBetterThisWeek, xpReward: 40 },
  { id: "mins-150", icon: "⏱️", title: "Log 150 minutes", target: 150, current: (w) => w.minutesThisWeek, xpReward: 75 },
  { id: "mins-300", icon: "⏱️", title: "Log 300 minutes", target: 300, current: (w) => w.minutesThisWeek, xpReward: 150 },
  { id: "clean-5", icon: "💎", title: "5 sessions, nothing scrapped", target: 5, current: (w) => w.cleanRunThisWeek, xpReward: 90 },
  { id: "clean-3", icon: "💎", title: "3 sessions, nothing scrapped", target: 3, current: (w) => w.cleanRunThisWeek, xpReward: 50 },
  { id: "long-45", icon: "🔥", title: "Hold a single 45m heat", target: 45, current: (w) => w.longestThisWeek, xpReward: 60 },
  { id: "long-60", icon: "🌋", title: "Hold a single 60m heat", target: 60, current: (w) => w.longestThisWeek, xpReward: 90 },
];

/**
 * Three challenges per week, rotating deterministically so the same week
 * always yields the same set (no reroll-shopping) while never running out.
 */
export function weeklyChallenges(date = new Date()): Challenge[] {
  const week = isoWeek(date);
  const n = CHALLENGE_POOL.length;
  // Stride of 3 is coprime with 10, so the window walks the whole pool.
  return [0, 1, 2].map((i) => CHALLENGE_POOL[(week * 3 + i) % n]);
}

/* ─────────────────────────── Collection sets ─────────────────────────── */

export interface SetProgress {
  rarity: Rarity;
  collected: number;
  total: number;
  complete: boolean;
}

/** How many distinct pieces exist per rarity — the set size. */
export function setSize(rarity: Rarity): number {
  return POOLS[rarity].length;
}

/**
 * Distinct-piece collection per rarity. Rewards varying session length
 * rather than grinding one duration, and stays meaningful long after the
 * rank ladder is exhausted.
 */
export function setProgress(collectedNames: Iterable<string>): SetProgress[] {
  const owned = new Set(collectedNames);
  return RARITY_TIERS.map((rarity) => {
    const total = POOLS[rarity].length;
    const collected = POOLS[rarity].filter((p) => owned.has(p.name)).length;
    return { rarity, collected, total, complete: collected === total };
  });
}

export const RARITY_TIERS: Rarity[] = ["common", "uncommon", "rare", "masterwork"];

/* ─────────────────────────── Personal bests ─────────────────────────── */

export interface PersonalBests {
  longestSessionMinutes: number;
  bestStreak: number;
  bestWeekMinutes: number;
}

export interface BestResult {
  label: string;
  value: string;
  /** True when the most recent action set a new record. */
  isNew: boolean;
}

export function formatBests(b: PersonalBests, justBeat: keyof PersonalBests | null): BestResult[] {
  return [
    {
      label: "Longest heat",
      value: b.longestSessionMinutes ? `${b.longestSessionMinutes}m` : "—",
      isNew: justBeat === "longestSessionMinutes",
    },
    {
      label: "Best streak",
      value: b.bestStreak ? `${b.bestStreak}` : "—",
      isNew: justBeat === "bestStreak",
    },
    {
      label: "Best week",
      value: b.bestWeekMinutes ? `${Math.floor(b.bestWeekMinutes / 60)}h ${b.bestWeekMinutes % 60}m` : "—",
      isNew: justBeat === "bestWeekMinutes",
    },
  ];
}
