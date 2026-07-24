"use client";

import { useEffect } from "react";
import type { HTMLAttributes } from "react";

// `@un17/logo` registers a `<un17-logo>` custom element whose class extends
// HTMLElement, so importing the package runs browser-only code. Declaring the
// tag here lets JSX type-check it; the element is registered client-side in the
// effect below rather than at module load, keeping server rendering safe.
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- JSX augmentation requires the namespace form.
  namespace JSX {
    interface IntrinsicElements {
      "un17-logo": Un17LogoAttributes;
    }
  }
}

interface Un17LogoAttributes extends HTMLAttributes<HTMLElement> {
  variant?: "header" | "footer";
  color?: string;
  ghost?: string;
  "mark-size"?: number | string;
  width?: number | string;
  height?: number | string;
  static?: boolean;
}

export type Un17LogoProps = Un17LogoAttributes;

/**
 * Thin wrapper around the shared `<un17-logo>` web component from `@un17/logo`.
 * Registers the custom element on mount (a browser-only side effect) and forwards
 * every attribute — `variant`, sizing/color overrides, and ARIA props — straight
 * through to the tag.
 */
export function Un17Logo(props: Un17LogoProps) {
  useEffect(() => {
    void import("@un17/logo");
  }, []);

  return <un17-logo {...props} />;
}
