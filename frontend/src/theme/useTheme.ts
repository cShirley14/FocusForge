import { useState, useEffect } from "react";

type ThemeMode = "forge" | "daybreak";

const STORAGE_KEY = "focusforge-theme";

function readInitialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "daybreak" || stored === "forge") return stored;

  // Respect OS preference on first visit
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "daybreak"
    : "forge";
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readInitialMode);

  // Theme must live on the document root so `html` and `body` — which are
  // ancestors of the app tree — also receive the custom property overrides.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = () => setMode((m) => (m === "forge" ? "daybreak" : "forge"));

  return { mode, toggle };
}
