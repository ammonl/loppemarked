"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { colors } from "@/styles/theme";
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
                label: t("landing.eventDateLabel"),
                value: t("landing.eventDateValue"),
                tilt: -3,
                icon: <CalendarIcon />,
                tint: colors.fleaNotePaper,
              },
              {
                label: t("landing.eventPlaceLabel"),
                value: t("landing.eventPlaceValue"),
                tilt: 2.5,
                icon: <PinIcon />,
                tint: colors.fleaNotePaperWarm,
              },
              {
                label: t("landing.eventTimeLabel"),
                value: t("landing.eventTimeValue"),
                tilt: -1.5,
                icon: <ClockIcon />,
                tint: colors.fleaNotePaperLight,
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
            <FleaTag label={t("landing.fleaTagLabel")} />
          </div>
        </div>
      </HeroScene>
    </section>
  );
}

interface CorkboardNote {
  label: string;
  value: string;
  tilt: number;
  tint: string;
  icon: React.ReactNode;
}

function Corkboard({ title, notes }: { title: string; notes: CorkboardNote[] }) {
  return (
    <div
      className="flea-corkboard"
      role="group"
      aria-label={title}
    >
      <div className="flea-corkboard__frame">
        <div className="flea-corkboard__surface">
          {notes.map((note, i) => (
            <article
              key={note.label}
              className="flea-note"
              style={{
                background: note.tint,
                transform: `rotate(${note.tilt}deg)`,
                zIndex: notes.length - i,
              }}
            >
              <span className="flea-note__pin" aria-hidden />
              <div className="flea-note__icon" aria-hidden>
                {note.icon}
              </div>
              <div className="flea-note__label">{note.label}</div>
              <div className="flea-note__value">{note.value}</div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function FleaTag({ label }: { label: string }) {
  return (
    <div className="flea-tag" aria-hidden>
      <span className="flea-tag__hole" />
      <span className="flea-tag__text">{label}</span>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.fleaPenInk} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.fleaPenInk} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.fleaPenInk} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
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
