import { useState, useEffect, useRef } from "react";

interface OnboardingProps {
  onDismiss: () => void;
}

const STEPS = [
  {
    icon: "📝",
    title: "Queue up raw material",
    body: "Add what needs doing. Each task is a piece of iron waiting for the fire.",
  },
  {
    icon: "🔥",
    title: "Forge it in one session",
    body: "Pick a task and start. The iron heats as the timer runs — dull red, then orange, then white-hot.",
  },
  {
    icon: "💀",
    title: "Leaving ruins the piece",
    body: "Quit mid-session and the metal cools wrong. The piece is scrapped and your streak resets. Starting is a commitment.",
  },
  {
    icon: "⚔️",
    title: "Finished work fills your smithy",
    body: "Every completed session forges a real item you keep. Your smithy is a record of focus you can actually look at.",
  },
];

export function Onboarding({ onDismiss }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isLast = step === STEPS.length - 1;

  // Move focus into the dialog and allow Escape to skip.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const current = STEPS[step];

  return (
    <div className="onboarding-backdrop">
      <div
        className="onboarding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-title"
        aria-describedby="ob-body"
        tabIndex={-1}
        ref={dialogRef}
      >
        <span className="ob-icon" aria-hidden="true">{current.icon}</span>

        <h2 className="ob-title" id="ob-title">{current.title}</h2>
        <p className="ob-body" id="ob-body">{current.body}</p>

        <ol className="ob-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className={`ob-dot ${i === step ? "current" : ""} ${i < step ? "done" : ""}`}
              aria-current={i === step ? "step" : undefined}
            />
          ))}
        </ol>

        <div className="ob-actions">
          <button className="btn-ghost" onClick={onDismiss}>
            Skip
          </button>
          <button
            className="btn-primary"
            onClick={() => (isLast ? onDismiss() : setStep((s) => s + 1))}
          >
            {isLast ? "Light the forge" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
