"use client";

import { useEffect } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

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

// Rendered footprint of each variant (mark + gap + wordmark box), reserved on
// the host so the logo's box holds its space before the custom element upgrades
// — otherwise the empty tag paints at zero size and pops in with a layout shift.
const RESERVED_BOX: Record<"header" | "footer", { minWidth: number; minHeight: number }> = {
  header: { minWidth: 211, minHeight: 46 },
  footer: { minWidth: 164, minHeight: 36 },
};

/**
 * Thin wrapper around the shared `<un17-logo>` web component from `@un17/logo`.
 * Registers the custom element on mount (a browser-only side effect) and forwards
 * every attribute — `variant`, sizing/color overrides, and ARIA props — straight
 * through to the tag.
 *
 * For decorative use, pass `aria-hidden="true"` as a string: React renders a
 * boolean `aria-hidden` on a custom element as `aria-hidden=""`, which does not
 * reliably hide it from assistive tech.
 */
export function Un17Logo({ variant = "header", style, ...rest }: Un17LogoProps) {
  useEffect(() => {
    // Registering the element touches browser-only globals, so import it after
    // mount. Swallow a failed chunk load so it never surfaces as an unhandled
    // rejection — the logo simply stays absent.
    import("@un17/logo").catch(() => {});
  }, []);

  // Skip the default reservation when the caller overrides sizing, so the
  // reserved box can't disagree with a custom footprint.
  const hasSizeOverride =
    rest["mark-size"] !== undefined || rest.width !== undefined || rest.height !== undefined;
  const reservedStyle: CSSProperties | undefined = hasSizeOverride
    ? style
    : { display: "inline-flex", ...RESERVED_BOX[variant], ...style };

  return <un17-logo variant={variant} style={reservedStyle} {...rest} />;
}
