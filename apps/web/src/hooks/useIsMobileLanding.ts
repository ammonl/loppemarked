"use client";

import { useEffect, useState } from "react";
import { LANDING_MOBILE_MEDIA_QUERY } from "@/components/landing/sceneConfig";

/**
 * Tracks whether the viewport currently matches the mobile landing breakpoint
 * (see `LANDING_MOBILE_MEDIA_QUERY` in `sceneConfig.ts` for the shared source
 * of truth; the matching `@media` block lives in `styles/landing.css`).
 *
 * On the server (and during first client paint) this returns `false`, so SSR
 * renders the desktop scene by default. After hydration a matchMedia listener
 * updates the result; narrow viewports flip to the mobile scene on the next
 * render. Kept as a hook (rather than CSS display toggles) so each composition
 * only mounts the DOM and requests the assets it actually needs.
 */
export function useIsMobileLanding(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(LANDING_MOBILE_MEDIA_QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}
