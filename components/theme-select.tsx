"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
function readTheme(): Theme {
  const saved = document.cookie
    .split("; ")
    .find((part) => part.startsWith("shelfy-theme="))
    ?.split("=")[1];
  return saved === "light" || saved === "dark" ? saved : "system";
}
function subscribe(listener: () => void) {
  window.addEventListener("shelfy-theme-change", listener);
  return () => window.removeEventListener("shelfy-theme-change", listener);
}
export function ThemeSelect() {
  const theme = useSyncExternalStore(
    subscribe,
    readTheme,
    () => "system" as const,
  );
  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <label className="theme-control">
      Theme
      <select
        value={theme}
        onChange={(event) => {
          const value = event.target.value as Theme;
          if (value === "system") delete document.documentElement.dataset.theme;
          else document.documentElement.dataset.theme = value;
          document.cookie = `shelfy-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          window.dispatchEvent(new Event("shelfy-theme-change"));
        }}
      >
        <option value="system">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
