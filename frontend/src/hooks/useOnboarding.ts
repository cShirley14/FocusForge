import { useState } from "react";

const STORAGE_KEY = "focusforge-onboarded";

/**
 * First-run tutorial gate. Persists completion so returning users
 * are never shown it again.
 */
export function useOnboarding() {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private browsing / storage disabled — treat as seen rather than
      // blocking the app behind a modal that can never be dismissed.
      return true;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* non-fatal */
    }
    setSeen(true);
  };

  const replay = () => setSeen(false);

  return { showOnboarding: !seen, dismiss, replay };
}
