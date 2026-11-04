"use client";

import { useEffect, useRef } from "react";

/**
 * Closes an overlay with Escape and returns focus to the control that opened
 * it. An overlay that only closes on a click strands a keyboard user inside
 * it, and focus that never comes back leaves the next Tab from the top of
 * the page.
 *
 * `containerRef` is the overlay's own content. A pointer press inside it is
 * ignored here so the control under the pointer still receives its click —
 * closing on pointerdown would unmount the content mid-press.
 */
export function useDismissable(
  isOpen: boolean,
  onClose: () => void,
  triggerRef?: React.RefObject<HTMLElement | null>,
  containerRef?: React.RefObject<HTMLElement | null>
) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeRef.current();
      triggerRef?.current?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef?.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      closeRef.current();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen, triggerRef, containerRef]);
}
