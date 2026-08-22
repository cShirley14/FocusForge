import { useState, useCallback, useMemo, useEffect } from "react";
import { ForgeVisual } from "./components/ForgeVisual.js";
import { TimerControls } from "./components/TimerControls.js";
import { DurationPicker } from "./components/DurationPicker.js";
import { TaskList } from "./components/TaskList.js";
import { Smithy } from "./components/Smithy.js";
import { RankPanel } from "./components/RankPanel.js";
import { StatsStrip } from "./components/StatsStrip.js";
import { ForgeMaster } from "./components/ForgeMaster.js";
import { ForgeReveal } from "./components/ForgeReveal.js";
import { Onboarding } from "./components/Onboarding.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { useTheme } from "./theme/useTheme.js";
import { useTimer } from "./hooks/useTimer.js";
import { useOnboarding } from "./hooks/useOnboarding.js";
import {
  usePersistentState,
  clearPersistedState,
} from "./hooks/usePersistentState.js";
import { HeatGauge } from "./components/HeatGauge.js";
import { ChallengePanel } from "./components/ChallengePanel.js";
import {
  pieceForDuration,
  rarityForDuration,
  xpForSession,
  isoWeek,
  weeklyChallenges,
  type Rarity,
  type BadgeStats,
  type WeeklyProgress,
  type PersonalBests,
} from "./lib/progression.js";
import * as api from "./lib/api.js";

export interface Task {
  id: string;
  title: string;
  /** Set by Forge Master, or defaults to the current session length. */
  estimatedMinutes?: number;
}

export interface ForgedItem {
  id: string;
  taskTitle: string;
  icon: string;
  name: string;
  rarity: Rarity;
  seconds: number;
  forgedAt: string;
  failed: boolean;
}

export function App({ onSignOut }: { onSignOut: () => void }) {
  const { mode, toggle } = useTheme();
  const { showOnboarding, dismiss, replay } = useOnboarding();

  const [tasks, setTasks] = usePersistentState<Task[]>("tasks", []);
  const [activeTaskId, setActiveTaskId] = usePersistentState<string | null>(
    "activeTaskId",
    null
  );

  // Load tasks from the API on mount
  useEffect(() => {
    api.listTasks().then((apiTasks) => {
      setTasks(apiTasks
        .filter((t) => t.title) // skip internal records
        .map((t) => ({
          id: t.taskId,
          title: t.title,
          estimatedMinutes: t.estimatedMinutes,
        })));
    }).catch(() => {});
  }, []);
  const [forgedItems, setForgedItems] = usePersistentState<ForgedItem[]>(
    "forged",
    []
  );
  const [focusSeconds, setFocusSeconds] = usePersistentState("focusSeconds", 0);
  const [streak, setStreak] = usePersistentState("streak", 0);
  const [bestStreak, setBestStreak] = usePersistentState("bestStreak", 0);
  const [longestSession, setLongestSession] = usePersistentState(
    "longestSession",
    0
  );
  const [xp, setXp] = usePersistentState("xp", 0);
  const [claimedChallenges, setClaimedChallenges] = usePersistentState<string[]>(
    "claimedChallenges",
    []
  );
  const [reveal, setReveal] = useState<ForgedItem | null>(null);
  const [showAI, setShowAI] = useState(false);

  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  const onComplete = useCallback(
    (seconds: number) => {
      if (!activeTask) return;
      const minutes = seconds / 60;
      const piece = pieceForDuration(minutes);
      const forged: ForgedItem = {
        id: crypto.randomUUID(),
        taskTitle: activeTask.title,
        icon: piece.icon,
        name: piece.name,
        rarity: piece.rarity,
        seconds,
        forgedAt: new Date().toISOString(),
        failed: false,
      };

      setForgedItems((prev) => [forged, ...prev]);
      setTasks((prev) => prev.filter((t) => t.id !== activeTask.id));
      setActiveTaskId(null);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
      setFocusSeconds((v) => v + seconds);
      setLongestSession((l) => Math.max(l, seconds));
      setXp((v) => v + xpForSession(minutes));
      setReveal(forged);
    },
    [activeTask]
  );

  const onAbandon = useCallback(() => {
    if (!activeTask) return;
    const ruined: ForgedItem = {
      id: crypto.randomUUID(),
      taskTitle: activeTask.title,
      icon: "💀",
      name: "Ruined",
      rarity: "common",
      seconds: 0,
      forgedAt: new Date().toISOString(),
      failed: true,
    };
    setForgedItems((prev) => [ruined, ...prev]);
    setStreak(0);
    setReveal(ruined);
  }, [activeTask]);

  const timer = useTimer({ onComplete, onAbandon });

  const addTask = (title: string) => {
    // Optimistic local add, then sync with API
    const tempId = crypto.randomUUID();
    setTasks((prev) => [...prev, { id: tempId, title }]);
    api.createTask(title).then((created) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? { ...t, id: created.taskId } : t))
      );
    }).catch(() => {
      // Rollback
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    });
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (activeTaskId === taskId) setActiveTaskId(null);
    api.deleteTask(taskId).catch(() => {});
  };

  /** Selecting a task adopts its estimate as the session length. */
  const selectTask = (taskId: string) => {
    setActiveTaskId(taskId);
    const t = tasks.find((x) => x.id === taskId);
    if (t?.estimatedMinutes) timer.setDuration(t.estimatedMinutes * 60);
  };

  /** Forge Master writes its sizing back onto the tasks. */
  const applyEstimates = (estimates: Record<string, number>) => {
    setTasks((prev) =>
      prev.map((t) =>
        estimates[t.id] ? { ...t, estimatedMinutes: estimates[t.id] } : t
      )
    );
    if (activeTaskId && estimates[activeTaskId]) {
      timer.setDuration(estimates[activeTaskId] * 60);
    }
    // Persist estimates to DynamoDB so they survive logout
    for (const [taskId, minutes] of Object.entries(estimates)) {
      api.updateTask(taskId, { estimatedMinutes: minutes }).catch(() => {});
    }
  };

  const kept = forgedItems.filter((i) => !i.failed);
  const ruinedCount = forgedItems.length - kept.length;

  // Weekly tally drives the rotating challenges.
  const weekly: WeeklyProgress = useMemo(() => {
    const thisWeek = isoWeek(new Date());
    const inWeek = forgedItems.filter(
      (i) => isoWeek(new Date(i.forgedAt)) === thisWeek
    );
    const keptWeek = inWeek.filter((i) => !i.failed);
    const ruinedWeek = inWeek.length - keptWeek.length;

    return {
      keptThisWeek: keptWeek.length,
      rareOrBetterThisWeek: keptWeek.filter(
        (i) => i.rarity === "rare" || i.rarity === "masterwork"
      ).length,
      minutesThisWeek: Math.floor(
        keptWeek.reduce((acc, i) => acc + i.seconds, 0) / 60
      ),
      // Clean run only counts while nothing has been scrapped this week
      cleanRunThisWeek: ruinedWeek === 0 ? keptWeek.length : 0,
      longestThisWeek: Math.floor(
        keptWeek.reduce((m, i) => Math.max(m, i.seconds), 0) / 60
      ),
    };
  }, [forgedItems]);

  const bests: PersonalBests = useMemo(
    () => ({
      longestSessionMinutes: Math.floor(longestSession / 60),
      bestStreak,
      bestWeekMinutes: weekly.minutesThisWeek,
    }),
    [longestSession, bestStreak, weekly.minutesThisWeek]
  );

  const collectedNames = useMemo(
    () => kept.map((i) => i.name),
    [kept]
  );

  const badgeStats: BadgeStats = useMemo(
    () => ({
      kept: kept.length,
      ruined: ruinedCount,
      streak,
      bestStreak,
      focusMinutes: Math.floor(focusSeconds / 60),
      longestSessionMinutes: Math.floor(longestSession / 60),
      masterworkCount: kept.filter((i) => i.rarity === "masterwork").length,
    }),
    [kept, ruinedCount, streak, bestStreak, focusSeconds, longestSession]
  );

  // Award XP when a weekly challenge completes (once per challenge per week)
  useEffect(() => {
    const thisWeek = isoWeek(new Date());
    const weekKey = `w${thisWeek}`;
    const challenges = weeklyChallenges();

    for (const c of challenges) {
      const current = Math.min(c.current(weekly), c.target);
      const claimId = `${weekKey}:${c.id}`;
      if (current >= c.target && !claimedChallenges.includes(claimId)) {
        setXp((v) => v + c.xpReward);
        setClaimedChallenges((prev) => [...prev, claimId]);
      }
    }
  }, [weekly, claimedChallenges]);

  const nextAction =
    tasks.length === 0
      ? "add"
      : !activeTask
        ? "select"
        : timer.state === "idle"
          ? "start"
          : "working";

  return (
    <div className="app">
      <div className="app-shell">
        <header className="header">
          <div className="header-left">
            <h1 className="brand">
              <span aria-hidden="true">⚒️</span> FocusForge
            </h1>
            <StatsStrip
              streak={streak}
              forgedCount={kept.length}
              ruinedCount={ruinedCount}
              focusSeconds={focusSeconds}
              xp={xp}
            />
          </div>

          <div className="header-actions">
            <button
              className="btn-ai"
              onClick={() => {
                setShowAI((v) => {
                  if (!v) {
                    // Scroll sidebar to top so the panel is visible
                    setTimeout(() => {
                      document.querySelector(".side-col")?.scrollTo({ top: 0, behavior: "smooth" });
                    }, 50);
                  }
                  return !v;
                });
              }}
              aria-expanded={showAI}
              data-tour="forge-master"
            >
              <span aria-hidden="true">✨</span> Forge Master
              <span className="ai-tag">AI</span>
            </button>
            <button className="btn-icon" onClick={replay} aria-label="Replay tutorial">
              <span aria-hidden="true">❔</span>
            </button>
            <button
              className="btn-icon"
              aria-label="Reset all saved progress"
              title="Reset all saved progress"
              onClick={() => {
                if (
                  confirm(
                    "Clear all saved progress? Tasks, pieces, rank and streaks will be erased."
                  )
                ) {
                  clearPersistedState();
                  location.reload();
                }
              }}
            >
              <span aria-hidden="true">🗑️</span>
            </button>
            <ThemeToggle mode={mode} onToggle={toggle} />
            <button
              className="btn-icon"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <span aria-hidden="true">🚪</span>
            </button>
          </div>
        </header>

        <main className="main">
          <div
            className="center-col"
            data-forging={timer.state === "focus" ? "true" : "false"}
            data-tour="anvil"
          >
            <ForgeVisual
              progress={timer.progress}
              state={timer.state}
              taskTitle={activeTask?.title || null}
              mode={mode}
              rarity={rarityForDuration(timer.sessionSeconds / 60)}
            />
            <TimerControls
              state={timer.state}
              timeLeft={timer.timeLeft}
              activeTask={activeTask}
              nextAction={nextAction}
              onStart={() => timer.start()}
              onStop={timer.stop}
              onSkipBreak={timer.reset}
            />
            <HeatGauge
              progress={timer.progress}
              state={timer.state}
              sessionSeconds={timer.sessionSeconds}
            />
            <DurationPicker
              seconds={timer.sessionSeconds}
              disabled={timer.state !== "idle"}
              onChange={timer.setDuration}
            />
          </div>

          <aside className="side-col">
            {showAI && (
              <ForgeMaster
                tasks={tasks}
                activeTaskId={activeTaskId}
                stats={badgeStats}
                onApplyEstimates={applyEstimates}
              />
            )}
            <TaskList
              tasks={tasks}
              activeTaskId={activeTaskId}
              timerState={timer.state}
              onAdd={addTask}
              onSelect={selectTask}
              onDelete={deleteTask}
            />
            <RankPanel stats={badgeStats} />
            <ChallengePanel
              weekly={weekly}
              collectedNames={collectedNames}
              bests={bests}
            />
            <Smithy items={forgedItems} latestId={reveal?.id ?? null} />
          </aside>
        </main>
      </div>

      {reveal && <ForgeReveal item={reveal} onClose={() => setReveal(null)} />}
      {showOnboarding && <Onboarding onDismiss={dismiss} />}
    </div>
  );
}
