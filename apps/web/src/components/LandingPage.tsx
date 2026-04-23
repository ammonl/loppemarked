"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { HeroScene } from "@/components/HeroScene";
import { landingSceneAssets } from "@/components/landing/sceneConfig";
import "@/styles/landing.css";

interface LandingPageProps {
  onEnter?: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const { t } = useLanguage();

  return (
    <section className="flea-landing" aria-labelledby="flea-landing-title">
      <HeroScene
        className="flea-landing__scene"
        background={landingSceneAssets.background}
        midground={landingSceneAssets.midground}
        foreground={landingSceneAssets.foreground}
        overlayAbove={
          <div className="flea-landing__cta-wrap">
            <button
              type="button"
              className="flea-landing__cta"
              onClick={onEnter}
              disabled={!onEnter}
            >
              <KeyIcon />
              <span>{t("landing.primaryCta")}</span>
            </button>
          </div>
        }
      >
        <div className="flea-landing__overlay" data-testid="flea-landing-overlay">
          <div className="flea-landing__copy">
            <h1 id="flea-landing-title" className="flea-landing__title">
              {t("landing.heroTitle")}
            </h1>
            <p className="flea-landing__body">{t("landing.heroBody")}</p>
          </div>
        </div>
      </HeroScene>
    </section>
  );
}

function KeyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2 21 2" />
      <path d="M17 6l3 3" />
      <path d="M14 9l2 2" />
    </svg>
  );
}
