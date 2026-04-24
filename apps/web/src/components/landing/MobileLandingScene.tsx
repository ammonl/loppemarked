"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";

interface MobileLandingSceneProps {
  onEnter?: () => void;
  ctaIcon: ReactNode;
}

/**
 * Dedicated mobile landing composition. Instead of scaling the desktop scene
 * down, this variant stacks the scene into three explicit bands so the
 * narrow-viewport hierarchy reads top-down:
 *   1. Title block (hand-written heading + event date/time).
 *   2. Framed hero raster with controlled focal cropping (mobile-specific
 *      asset + fixed aspect ratio + pinned object-position).
 *   3. Paper card + CTA anchored near the bottom.
 * The layout uses a grid rather than absolute overlays so the copy card never
 * collides with the image on very tall or very short phones.
 */
export function MobileLandingScene({ onEnter, ctaIcon }: MobileLandingSceneProps) {
  const { t } = useLanguage();

  return (
    <div className="flea-landing-mobile" data-testid="flea-landing-mobile">
      <header className="flea-landing-mobile__header">
        <h1 id="flea-landing-title" className="flea-landing-mobile__title">
          {t("landing.heroTitle")}
        </h1>
        <p className="flea-landing-mobile__event">
          <span className="flea-landing-mobile__event-date">{t("landing.eventDate")}</span>
          <span className="flea-landing-mobile__event-time">{t("landing.eventTime")}</span>
        </p>
      </header>

      <figure
        className="flea-landing-mobile__hero"
        data-testid="flea-landing-mobile-hero"
      >
        <img
          src="/landing/landing-hero-mobile.webp"
          alt={t("landing.heroAlt")}
          loading="eager"
          decoding="async"
          className="flea-landing-mobile__hero-image"
        />
      </figure>

      <section className="flea-landing-mobile__copy" data-testid="flea-landing-overlay">
        <p className="flea-landing-mobile__body">{t("landing.heroBody")}</p>
      </section>

      <div className="flea-landing-mobile__cta-wrap">
        <button
          type="button"
          className="flea-landing-mobile__cta"
          onClick={onEnter}
          disabled={!onEnter}
        >
          {ctaIcon}
          <span>{t("landing.primaryCta")}</span>
        </button>
      </div>
    </div>
  );
}
