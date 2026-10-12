"use client";

import { createContext, useContext, useEffect, useState } from "react";

export const DAISYUI_THEMES = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
] as const;

export type DaisyTheme = (typeof DAISYUI_THEMES)[number];
export type Theme = DaisyTheme | "system";

export const DARK_THEMES: ReadonlySet<string> = new Set([
  "dark",
  "synthwave",
  "halloween",
  "forest",
  "black",
  "luxury",
  "dracula",
  "business",
  "night",
  "coffee",
  "dim",
  "sunset",
]);

export function isDarkTheme(theme: string): boolean {
  return DARK_THEMES.has(theme);
}

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: DaisyTheme;
  setTheme: (theme: Theme) => void;
  themes: readonly DaisyTheme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<DaisyTheme>("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("theme") as Theme | null;
      if (storedTheme && (storedTheme === "system" || (DAISYUI_THEMES as readonly string[]).includes(storedTheme))) {
        setTheme(storedTheme);
      }
    } catch {
      // localStorage may fail in restricted contexts
    }
    setMounted(true);
  }, []);

  // Compute resolved theme and apply data-theme attribute
  useEffect(() => {
    if (!mounted) return;

    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Ignore localStorage write error
    }

    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const computed: DaisyTheme =
      theme === "system" ? (systemDark ? "dark" : "light") : theme;

    setResolvedTheme(computed);

    const root = window.document.documentElement;
    root.setAttribute("data-theme", computed);
    root.classList.remove("light", "dark");
    root.classList.add(isDarkTheme(computed) ? "dark" : "light");
  }, [theme, mounted]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const computed: DaisyTheme = mediaQuery.matches ? "dark" : "light";
      setResolvedTheme(computed);
      const root = window.document.documentElement;
      root.setAttribute("data-theme", computed);
      root.classList.remove("light", "dark");
      root.classList.add(computed === "dark" ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        themes: DAISYUI_THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}