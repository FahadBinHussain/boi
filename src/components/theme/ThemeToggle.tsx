"use client";

import { useTheme, DAISYUI_THEMES, type DaisyTheme } from "@/contexts/ThemeContext";
import { useEffect, useState } from "react";
import { FiCheck, FiChevronDown, FiDroplet, FiMonitor } from "react-icons/fi";
import MotionIcon from "@/components/ui/MotionIcon";

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="btn btn-ghost btn-sm gap-2 opacity-0 pointer-events-none">
        <span className="w-4 h-4"></span>
        <span>Theme</span>
      </div>
    );
  }

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-sm gap-2 border border-base-content/10 hover:border-base-content/20"
        title="Change theme"
        aria-label="Change theme"
      >
        <MotionIcon animation="spin" trigger="hover">
          <FiDroplet className="w-4 h-4 text-primary" />
        </MotionIcon>
        <span className="hidden sm:inline text-xs font-medium">
          {theme === "system" ? `System (${capitalize(resolvedTheme)})` : capitalize(theme)}
        </span>
        <MotionIcon animation="bounce" trigger="hover">
          <FiChevronDown className="w-3 h-3 opacity-60" />
        </MotionIcon>
      </div>

      <ul
        tabIndex={0}
        className="dropdown-content z-[100] mt-2 p-2 shadow-2xl bg-base-200 text-base-content rounded-box w-60 max-h-96 overflow-y-auto menu menu-sm gap-1 border border-base-content/10"
      >
        <li className="menu-title text-xs font-bold uppercase tracking-wider px-2 py-1 text-base-content/60">
          Preferences
        </li>
        <li>
          <button
            onClick={() => {
              setTheme("system");
              const elem = document.activeElement as HTMLElement | null;
              elem?.blur();
            }}
            className={`flex items-center justify-between py-2 px-3 rounded-lg ${
              theme === "system" ? "active font-bold" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <MotionIcon animation="pulse">
                <FiMonitor className="w-4 h-4" />
              </MotionIcon>
              <span>System</span>
            </div>
            {theme === "system" && (
              <MotionIcon animation="bounce">
                <FiCheck className="w-4 h-4 text-primary" />
              </MotionIcon>
            )}
          </button>
        </li>

        <li className="menu-title text-xs font-bold uppercase tracking-wider px-2 pt-3 pb-1 text-base-content/60">
          DaisyUI Themes ({DAISYUI_THEMES.length})
        </li>

        {DAISYUI_THEMES.map((themeName: DaisyTheme) => {
          const isSelected = theme === themeName;
          return (
            <li key={themeName}>
              <button
                onClick={() => {
                  setTheme(themeName);
                  const elem = document.activeElement as HTMLElement | null;
                  elem?.blur();
                }}
                className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                  isSelected ? "active font-bold" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSelected ? (
                    <MotionIcon animation="bounce">
                      <FiCheck className="w-4 h-4 text-primary" />
                    </MotionIcon>
                  ) : (
                    <span className="w-4 h-4" />
                  )}
                  <span>{capitalize(themeName)}</span>
                </div>

                {/* DaisyUI theme color preview badge */}
                <span
                  data-theme={themeName}
                  className="bg-base-100 rounded-btn flex gap-0.5 p-1 border border-base-content/10 shrink-0"
                >
                  <span className="w-2 h-4 rounded-sm bg-primary block" />
                  <span className="w-2 h-4 rounded-sm bg-secondary block" />
                  <span className="w-2 h-4 rounded-sm bg-accent block" />
                  <span className="w-2 h-4 rounded-sm bg-neutral block" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}