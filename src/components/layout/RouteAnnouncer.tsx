"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A client-side route change replaces the page without moving focus, so a
 * keyboard or screen-reader user is left on the previous page's last element
 * and never hears the new page. After a route change this moves focus to the
 * main landmark and announces the new page heading in a polite live region.
 *
 * The live region is rendered from the start, empty, so assistive technology
 * has it registered before the first update.
 */
export default function RouteAnnouncer() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const main = document.getElementById("main-content");
    if (main instanceof HTMLElement) {
      main.focus({ preventScroll: true });
    }

    const heading = document.querySelector("main h1");
    const label = heading?.textContent?.trim();
    setMessage(label ? `${label} page loaded` : "Page loaded");
  }, [pathname]);

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
