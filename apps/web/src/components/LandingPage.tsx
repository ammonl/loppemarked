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
      >
        <div className="flea-landing__overlay" data-testid="flea-landing-overlay">
          <div className="flea-landing__copy">
            <span className="flea-landing__eyebrow" aria-hidden>
              UN17 Village · 2026
            </span>
            <h1 id="flea-landing-title" className="flea-landing__title">
              {t("landing.heroTitle")}
            </h1>
            <p className="flea-landing__body">{t("landing.heroBody")}</p>
          </div>

          <Corkboard
            title={t("landing.corkboardTitle")}
            notes={[
              {
                slot: "date",
                label: t("landing.eventDateLabel"),
                value: t("landing.eventDateValue"),
              },
              {
                slot: "place",
                label: t("landing.eventPlaceLabel"),
                value: t("landing.eventPlaceValue"),
              },
              {
                slot: "time",
                label: t("landing.eventTimeLabel"),
                value: t("landing.eventTimeValue"),
              },
            ]}
          />

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
        </div>
      </HeroScene>
    </section>
  );
}

type CorkboardSlot = "date" | "place" | "time";

interface CorkboardNote {
  slot: CorkboardSlot;
  label: string;
  value: string;
}

function Corkboard({ title, notes }: { title: string; notes: CorkboardNote[] }) {
  return (
    <div className="flea-corkboard" role="group" aria-label={title}>
      {notes.map((note) => (
        <article
          key={note.slot}
          className={`flea-note flea-note--${note.slot}`}
        >
          <div className="flea-note__label">{note.label}</div>
          <div className="flea-note__value">{note.value}</div>
        </article>
      ))}
    </div>
  );
}

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2 21 2" />
      <path d="M17 6l3 3" />
      <path d="M14 9l2 2" />
    </svg>
  );
}
