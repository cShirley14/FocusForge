import { useState, useEffect } from "react";
import {
  rarityForDuration,
  RARITY_LABEL,
  type BadgeStats,
} from "../lib/progression.js";
import { invokeForgeMaster, invokeForgePlan, type PlanStep } from "../lib/api.js";
import type { Task } from "../App.js";

interface ForgeMasterProps {
  tasks: Task[];
  activeTaskId: string | null;
  /** True only while a session is actively running — a task mid-forge is the
   *  one case we skip re-sizing. Merely *selecting* a task must not exclude it. */
  isForging: boolean;
  stats: BadgeStats;
  /** Writes sizing back onto the tasks, keyed by task id. */
  onApplyEstimates: (estimates: Record<string, number>) => void;
  /** Adds planned steps to the queue as sized tasks (Forge Plan). */
  onAddPlannedTasks: (steps: Array<{ title: string; minutes: number }>) => void;
}

interface Estimate {
  taskId: string;
  title: string;
  minutes: number;
  why: string;
}

interface Insight {
  estimates: Estimate[];
  pattern: string;
  retro: string;
}

/**
 * Sizes tasks, surfaces patterns, and gives a retro.
 *
 * NOTE: generates locally for now. The deployed build calls POST /forge,
 * backed by Bedrock Nova Micro — see functions/forge-master/index.ts.
 */
export function ForgeMaster({ tasks, activeTaskId, isForging, stats, onApplyEstimates, onAddPlannedTasks }: ForgeMasterProps) {
  // A task is only off-limits for sizing while it's actively being forged.
  const excludedId = isForging ? activeTaskId : null;
  const unsizedCount = tasks.filter(
    (t) => !t.estimatedMinutes && t.id !== excludedId
  ).length;
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  // ─── Forge Plan (brain-dump → ordered plan) ───
  const [mode, setMode] = useState<"size" | "plan">("size");
  const [brainDump, setBrainDump] = useState("");
  const [plan, setPlan] = useState<PlanStep[] | null>(null);
  const [planTip, setPlanTip] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planAdded, setPlanAdded] = useState(false);
  const [planError, setPlanError] = useState("");

  const runPlan = async () => {
    if (!brainDump.trim()) return;
    setPlanLoading(true);
    setPlanError("");
    setPlanAdded(false);
    try {
      const result = await invokeForgePlan(brainDump);
      setPlan(result.plan || []);
      setPlanTip(result.tip || "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setPlanError(
        message.includes("Daily forge limit")
          ? "Daily limit reached. Resets tomorrow."
          : "Couldn't reach the Forge Master. Try again."
      );
    }
    setPlanLoading(false);
  };

  const addPlanToQueue = () => {
    if (!plan?.length) return;
    onAddPlannedTasks(
      plan.map((s) => ({ title: s.title, minutes: s.minutes }))
    );
    setPlanAdded(true);
  };

  const total = stats.kept + stats.ruined;

  // Reset when the task list changes (new task added / removed)
  // so the user can re-analyze with the updated queue.
  useEffect(() => {
    if (insight) {
      setInsight(null);
      setApplied(false);
    }
  }, [tasks.length]);

  const analyze = async () => {
    setLoading(true);
    setApplied(false);

    // Only size tasks that don't already have an estimate and aren't actively being forged
    const unsized = tasks.filter((t) => !t.estimatedMinutes && t.id !== excludedId);
    if (unsized.length === 0) {
      setInsight({
        estimates: [],
        pattern: "All tasks are already sized. Add new tasks to use the Forge Master.",
        retro: "Nothing to analyze.",
      });
      setLoading(false);
      return;
    }

    try {
      const result = await invokeForgeMaster();

      // Map API response back to our Estimate format, matching by title
      // Only include tasks that are still unsized locally (don't re-show already-applied ones)
      const estimates: Estimate[] = (result.estimates || [])
        .map((e: any) => {
          const match = tasks.find((t) => t.title === e.title);
          return {
            taskId: match?.id || e.title,
            title: e.title,
            minutes: e.minutes || 25,
            why: e.why || "Standard heat",
          };
        })
        .filter((e) => {
          const task = tasks.find((t) => t.id === e.taskId);
          return task && !task.estimatedMinutes && task.id !== excludedId;
        });

      const rate = total > 0 ? Math.round((stats.kept / total) * 100) : null;

      setInsight({
        estimates,
        pattern:
          rate === null
            ? "No history yet. Finish a few sessions and patterns show up here."
            : stats.ruined === 0
              ? `${rate}% completion across ${total} session${total === 1 ? "" : "s"}, nothing scrapped. Longer heats are safe to attempt.`
              : `${rate}% completion. ${stats.ruined} piece${stats.ruined === 1 ? "" : "s"} scrapped — try shorter heats until the streak holds.`,
        retro:
          result.tip || "The metal awaits your hammer.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";

      // Rate limit hit — tell the user, don't fall back to local estimates
      if (message.includes("Daily forge limit")) {
        setInsight({
          estimates: [],
          pattern: "Daily limit reached. Resets tomorrow.",
          retro: "",
        });
      } else {
        // Other errors — fall back to local heuristic
        const estimates: Estimate[] = tasks.map((t) => {
          const words = t.title.trim().split(/\s+/).length;
          const compound = /\band\b|,|;|\+/i.test(t.title);
          let minutes = 25;
          let why = "Standard heat";
          if (words <= 3 && !compound) { minutes = 15; why = "Quick task, keep momentum"; }
          else if (compound || words > 9) { minutes = 45; why = "Multi-part, give it room"; }
          else if (words > 6) { minutes = 45; why = "Broad scope"; }
          return { taskId: t.id, title: t.title, minutes, why };
        });
        setInsight({
          estimates,
          pattern: "Forge Master offline. Using local estimates.",
          retro: "Connect to the API for smarter sizing.",
        });
      }
    }

    setLoading(false);
  };

  const apply = () => {
    if (!insight) return;
    const map: Record<string, number> = {};
    for (const e of insight.estimates) map[e.taskId] = e.minutes;
    onApplyEstimates(map);
    setApplied(true);
  };

  return (
    <section className="fm-panel" aria-labelledby="fm-heading">
      <div className="fm-head">
        <h2 className="panel-title" id="fm-heading">
          <span aria-hidden="true">✨</span> Forge Master
        </h2>
        <span className="fm-badge">AI</span>
      </div>

      {/* Two modes: size existing tasks, or plan a brain-dump. Additive — the
          original sizing flow is the default and unchanged. */}
      <div className="fm-modes" role="tablist" aria-label="Forge Master mode">
        <button
          role="tab"
          aria-selected={mode === "size"}
          className={`fm-mode ${mode === "size" ? "active" : ""}`}
          onClick={() => setMode("size")}
        >
          Size tasks
        </button>
        <button
          role="tab"
          aria-selected={mode === "plan"}
          className={`fm-mode ${mode === "plan" ? "active" : ""}`}
          onClick={() => setMode("plan")}
        >
          Plan my day
        </button>
      </div>

      {mode === "plan" ? (
        <div className="fm-plan">
          {!plan && !planLoading && (
            <>
              <p className="fm-desc">
                Dump everything on your mind. The Forge Master sequences it into
                an ordered plan — deepest work first, quick wins batched.
              </p>
              <label className="sr-only" htmlFor="fm-braindump">
                Brain-dump of things to do
              </label>
              <textarea
                id="fm-braindump"
                className="fm-braindump"
                rows={4}
                placeholder={"study for calc 2 test\nemail advisor\nfix the login bug\nread a NYT article"}
                value={brainDump}
                onChange={(e) => setBrainDump(e.target.value)}
              />
              <button
                className="btn-forge-master"
                onClick={runPlan}
                disabled={!brainDump.trim()}
              >
                Plan my forge
              </button>
              {planError && <p className="fm-plan-error">{planError}</p>}
            </>
          )}

          {planLoading && (
            <p className="fm-loading">
              <span className="fm-spinner" aria-hidden="true" />
              Sequencing the work…
            </p>
          )}

          {plan && !planLoading && (
            <div className="fm-body">
              {plan.length > 0 ? (
                <>
                  <ol className="fm-plan-list">
                    {plan.map((s) => {
                      const r = rarityForDuration(s.minutes);
                      return (
                        <li className="fm-plan-step" key={s.order}>
                          <span className="fm-plan-order">{s.order}</span>
                          <span className="fm-plan-body">
                            <span className="fm-plan-title">{s.title}</span>
                            <em>
                              {s.reason} · <span className={`rarity-${r}`}>{s.minutes}m</span>
                            </em>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  {planTip && <p className="fm-pattern">{planTip}</p>}
                  <button
                    className="btn-forge-master"
                    onClick={addPlanToQueue}
                    disabled={planAdded}
                  >
                    {planAdded ? "Added to queue ✓" : "Add plan to queue"}
                  </button>
                </>
              ) : (
                <p className="fm-pattern">Nothing to plan — try adding a few lines.</p>
              )}
              <button
                className="btn-ghost"
                onClick={() => {
                  setPlan(null);
                  setPlanAdded(false);
                }}
              >
                New plan
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
      {!insight && !loading && (
        <>
          <p className="fm-desc">
            An AI apprentice that reads your history to size each task, flag
            patterns, and hand you a retro.
          </p>
          <button className="btn-forge-master" onClick={analyze}>
            {unsizedCount > 0
              ? `Size up ${unsizedCount} unsized task${unsizedCount === 1 ? "" : "s"}`
              : tasks.length > 0
                ? "All tasks sized"
                : "Show my forge report"}
          </button>
        </>
      )}

      {loading && (
        <p className="fm-loading">
          <span className="fm-spinner" aria-hidden="true" />
          Reading the coals…
        </p>
      )}

      {insight && (
        <div className="fm-body">
          {insight.estimates.length > 0 && (
            <div className="fm-section">
              <h3 className="fm-sub">Suggested heats</h3>
              {insight.estimates.map((e) => {
                const r = rarityForDuration(e.minutes);
                return (
                  <div className="fm-est-row" key={e.taskId}>
                    <span className={`fm-est rarity-${r}`}>{e.minutes}m</span>
                    <span className="fm-est-task">
                      {e.title}
                      <em>
                        {e.why} · {RARITY_LABEL[r]}
                      </em>
                    </span>
                  </div>
                );
              })}

              <button
                className="btn-forge-master"
                onClick={apply}
                disabled={applied}
              >
                {applied ? "Applied to queue ✓" : "Apply these session lengths"}
              </button>
            </div>
          )}

          <div className="fm-section">
            <h3 className="fm-sub">Pattern</h3>
            <p className="fm-pattern">{insight.pattern}</p>
          </div>

          {insight.retro && (
            <div className="fm-section">
              <h3 className="fm-sub">Retro</h3>
              <p className="fm-pattern">{insight.retro}</p>
            </div>
          )}

          <button className="btn-ghost" onClick={() => setInsight(null)}>
            Close
          </button>
        </div>
      )}
        </>
      )}
    </section>
  );
}
