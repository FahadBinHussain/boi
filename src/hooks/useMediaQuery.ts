"use client";

import { useEffect, useState } from "react";

/**
 * Tracks a CSS media query from React.
 *
 * The admin sidebar is only off-canvas below the `md` breakpoint and a docked
 * rail above it, so the `inert` state that keeps the hidden drawer out of the
 * tab order has to follow the same breakpoint as the CSS, not the open/closed
 * state alone. Starting at `false` keeps the first server and client render
 * identical, so there is no hydration mismatch; the real value lands on the
 * next frame.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}
