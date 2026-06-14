"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useEffect, useState } from "react";
import { SunIcon, MoonIcon, ComputerDesktopIcon } from "@heroicons/react/24/outline";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9"></div>; // Placeholder to avoid layout shift
  }

  return (
    <div className="flex items-center gap-2 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
      <button
        onClick={() => setTheme("light")}
        className={`p-2 rounded-md ${
          theme === "light" 
            ? "bg-white text-yellow-500 shadow-sm" 
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
        title="Light mode"
        aria-label="Use light mode"
      >
        <SunIcon className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => setTheme("dark")}
        className={`p-2 rounded-md ${
          theme === "dark" 
            ? "bg-gray-700 text-blue-400 shadow-sm" 
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
        title="Dark mode"
        aria-label="Use dark mode"
      >
        <MoonIcon className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => setTheme("system")}
        className={`p-2 rounded-md ${
          theme === "system" 
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" 
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
        title="System preference"
        aria-label="Use system theme preference"
      >
        <ComputerDesktopIcon className="w-5 h-5" />
      </button>
    </div>
  );
} 