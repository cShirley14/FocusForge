import { useState, useRef, type FormEvent } from "react";
import { signIn } from "../lib/auth.js";
import { ThemeToggle } from "./ThemeToggle.js";

interface LoginProps {
  onSuccess: () => void;
  mode: "forge" | "daybreak";
  onToggleTheme: () => void;
}

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000;

export function Login({ onSuccess, mode, onToggleTheme }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const failCount = useRef(0);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
      failCount.current = 0;
      onSuccess();
    } catch (err: unknown) {
      failCount.current++;
      if (failCount.current >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setError(`Too many attempts. Try again in ${LOCKOUT_MS / 1000}s.`);
        setTimeout(() => setLockedUntil(null), LOCKOUT_MS);
      } else {
        setError(err instanceof Error ? err.message : "Sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-backdrop">
      <div className="login-theme-toggle">
        <ThemeToggle mode={mode} onToggle={onToggleTheme} />
      </div>
      <form className="login-form" onSubmit={handleSubmit} aria-labelledby="login-title">
        <h1 id="login-title" className="login-brand">
          <span aria-hidden="true">⚒️</span> FocusForge
        </h1>
        <p className="login-subtitle">Sign in to start forging</p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <label className="login-label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="login-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />

        <label className="login-label" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          className="login-input"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />

        <button className="login-btn" type="submit" disabled={loading || isLocked}>
          {isLocked ? "Locked — wait…" : loading ? "Heating up…" : "Enter the Forge"}
        </button>
      </form>
    </div>
  );
}
