'use client';

import { useAnimationControls, type TargetAndTransition } from 'framer-motion';
import { useEffect, useLayoutEffect } from 'react';

// Layout effect on the client (runs before paint), plain effect on the server
// so Next.js does not warn about useLayoutEffect during SSR.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Framer Motion animates on requestAnimationFrame, and browsers throttle that
 * to nothing in a background tab. Any element that starts at `opacity: 0`
 * therefore stays invisible until the tab is focused, and stays invisible
 * forever in any context that never runs a frame (prerender, screenshot
 * tooling, an embedded webview).
 *
 * This renders the element in its visible state and only plays the entrance
 * once the frame clock is actually running, so content is never hidden behind
 * an animation that cannot run. It also honours prefers-reduced-motion by
 * simply not playing the entrance.
 *
 * Pass stable references for `hidden` and `visible` (module-level constants),
 * because they are effect dependencies.
 */
export function useEntranceAnimation(
  hidden: TargetAndTransition | string,
  visible: TargetAndTransition | string
) {
  const controls = useAnimationControls();

  useIsomorphicLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.hidden) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    controls.set(hidden);
    controls.start(visible);
  }, [controls, hidden, visible]);

  return controls;
}
