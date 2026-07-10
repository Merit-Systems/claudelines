"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TermTheme } from "@/components/terminal-preview";

const STORAGE_KEY = "claudelines-preview-theme";

const PreviewThemeContext = createContext<{
  theme: TermTheme;
  setTheme: (t: TermTheme) => void;
}>({ theme: "dark", setTheme: () => {} });

export function PreviewThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hydrate with the SSR-safe default, then adopt the stored preference on
  // the client. useSyncExternalStore-style read avoids setState-in-effect.
  const [theme, setThemeState] = useState<TermTheme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      // queue after paint; avoids cascading-render lint and hydration issues
      const id = requestAnimationFrame(() =>
        setThemeState(stored as TermTheme),
      );
      return () => cancelAnimationFrame(id);
    }
  }, []);

  const setTheme = (t: TermTheme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  return (
    <PreviewThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </PreviewThemeContext.Provider>
  );
}

export function usePreviewTheme() {
  return useContext(PreviewThemeContext);
}

/** Navbar control: sets the default terminal theme for every preview. */
export function GlobalPreviewThemeToggle() {
  const { theme, setTheme } = usePreviewTheme();
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Default preview theme"
      title="Default terminal theme for previews"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? (
        <Sun className="size-3.5" />
      ) : (
        <Moon className="size-3.5" />
      )}
    </Button>
  );
}
