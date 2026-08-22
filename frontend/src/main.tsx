import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { Login } from "./components/Login.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { useTheme } from "./theme/useTheme.js";
import { isAuthenticated, signOut } from "./lib/auth.js";
import "./theme/global.css";

function Root() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const { mode, toggle } = useTheme();

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} mode={mode} onToggleTheme={toggle} />;
  }

  return <App onSignOut={() => { signOut(); setAuthed(false); }} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
