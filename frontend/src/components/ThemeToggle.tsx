interface ThemeToggleProps {
  mode: "forge" | "daybreak";
  onToggle: () => void;
}

export function ThemeToggle({ mode, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${mode === "forge" ? "daybreak" : "forge"} mode`}
      className="btn-theme"
    >
      {mode === "forge" ? "🌞" : "🌚"}
    </button>
  );
}
