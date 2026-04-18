"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { colors } from "@/styles/theme";
import "@/styles/landing.css";

interface LandingPageProps {
  onEnter?: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const { t } = useLanguage();

  return (
    <section className="flea-landing" aria-labelledby="flea-landing-title">
      <div className="flea-landing__hero">
        <div className="flea-landing__hero-copy">
          <span className="flea-landing__eyebrow" aria-hidden>
            UN17 Village · 2026
          </span>
          <h1 id="flea-landing-title" className="flea-landing__title">
            {t("landing.heroTitle")}
          </h1>
          <p className="flea-landing__body">{t("landing.heroBody")}</p>
          <MarketScene
            knitwearLabel={t("landing.vignetteKnitwearLabel")}
            blanketLabel={t("landing.vignetteBlanketLabel")}
            jewelryLabel={t("landing.vignetteJewelryLabel")}
            cameraLabel={t("landing.vignetteCameraLabel")}
          />
        </div>
        <HeroIllustration />
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

function HeroIllustration() {
  return (
    <div className="flea-hero-illustration" aria-hidden>
      <svg
        viewBox="0 0 320 320"
        width="100%"
        height="100%"
        role="presentation"
      >
        <defs>
          <linearGradient id="fleaSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.fleaSandLight} />
            <stop offset="100%" stopColor={colors.fleaCream} />
          </linearGradient>
          <linearGradient id="fleaFloor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.fleaSand} />
            <stop offset="100%" stopColor={colors.fleaFloorShadow} />
          </linearGradient>
        </defs>

        <circle cx="160" cy="160" r="150" fill="url(#fleaSky)" />

        {/* bunting */}
        <path
          d="M20 70 Q80 110 160 70 T300 70"
          fill="none"
          stroke={colors.fleaPenInk}
          strokeWidth="1.2"
          opacity="0.55"
        />
        {[40, 80, 120, 160, 200, 240, 280].map((cx, idx) => (
          <polygon
            key={cx}
            points={`${cx - 10},${80 + (idx % 2) * 2} ${cx + 10},${80 + (idx % 2) * 2} ${cx},${100 + (idx % 2) * 3}`}
            fill={
              idx % 3 === 0
                ? colors.fleaTerracotta
                : idx % 3 === 1
                ? colors.fleaSage
                : colors.fleaCorkDark
            }
            opacity="0.9"
          />
        ))}

        {/* floor */}
        <rect x="10" y="230" width="300" height="80" fill="url(#fleaFloor)" />
        <path
          d="M10 232 Q160 225 310 232"
          stroke={colors.fleaCorkDark}
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />

        {/* long table with cloth */}
        <rect x="55" y="200" width="210" height="40" rx="4" fill={colors.fleaTerracotta} />
        <path
          d="M55 210 L65 240 L80 210 L95 240 L110 210 L125 240 L140 210 L155 240 L170 210 L185 240 L200 210 L215 240 L230 210 L245 240 L260 210"
          stroke={colors.fleaTerracottaDark}
          strokeWidth="1"
          fill="none"
          opacity="0.55"
        />

        {/* folded knit stack */}
        <g transform="translate(72 170)">
          <rect x="0" y="20" width="46" height="10" rx="2" fill={colors.fleaSage} />
          <rect x="2" y="10" width="42" height="10" rx="2" fill={colors.fleaCorkDark} />
          <rect x="4" y="0" width="38" height="10" rx="2" fill={colors.fleaSand} />
        </g>

        {/* jewelry box */}
        <g transform="translate(135 180)">
          <rect x="0" y="6" width="38" height="20" rx="2" fill={colors.fleaCorkDark} />
          <rect x="0" y="0" width="38" height="8" rx="2" fill={colors.fleaTerracottaDark} />
          <circle cx="19" cy="16" r="2" fill={colors.fleaSand} />
        </g>

        {/* camera */}
        <g transform="translate(190 170)">
          <rect x="0" y="6" width="40" height="24" rx="3" fill={colors.fleaPenInk} />
          <rect x="12" y="2" width="14" height="6" rx="1" fill={colors.fleaPenInk} />
          <circle cx="20" cy="18" r="8" fill={colors.fleaSand} />
          <circle cx="20" cy="18" r="5" fill={colors.fleaCorkDark} />
        </g>

        {/* two figures */}
        <g transform="translate(95 110)">
          <circle cx="20" cy="20" r="12" fill={colors.fleaSand} />
          <path
            d="M6 40 Q20 30 34 40 L34 60 Q20 56 6 60 Z"
            fill={colors.fleaSage}
          />
          <circle cx="16" cy="18" r="1.5" fill={colors.fleaPenInk} />
          <circle cx="24" cy="18" r="1.5" fill={colors.fleaPenInk} />
          <path d="M16 24 Q20 27 24 24" stroke={colors.fleaPenInk} strokeWidth="1" fill="none" />
        </g>
        <g transform="translate(195 108)">
          <circle cx="20" cy="20" r="12" fill={colors.fleaSand} />
          <path
            d="M6 40 Q20 30 34 40 L34 60 Q20 56 6 60 Z"
            fill={colors.fleaTerracotta}
          />
          <circle cx="16" cy="18" r="1.5" fill={colors.fleaPenInk} />
          <circle cx="24" cy="18" r="1.5" fill={colors.fleaPenInk} />
          <path d="M15 24 Q20 28 25 24" stroke={colors.fleaPenInk} strokeWidth="1" fill="none" />
        </g>

        {/* heart between figures */}
        <path
          d="M160 130 l-5 -6 a4 4 0 1 1 5 -5 a4 4 0 1 1 5 5 z"
          fill={colors.fleaTerracottaDark}
        />
      </svg>
    </div>
  );
}

interface MarketSceneProps {
  knitwearLabel: string;
  blanketLabel: string;
  jewelryLabel: string;
  cameraLabel: string;
}

function MarketScene({ knitwearLabel, blanketLabel, jewelryLabel, cameraLabel }: MarketSceneProps) {
  return (
    <div className="flea-vignettes" role="list">
      <VignetteItem tint={colors.fleaSage} rotate={-4} label={knitwearLabel}>
        <SweaterIcon />
      </VignetteItem>
      <VignetteItem tint={colors.fleaSand} rotate={3} label={blanketLabel}>
        <BlanketIcon />
      </VignetteItem>
      <VignetteItem tint={colors.fleaTerracotta} rotate={-2} label={jewelryLabel}>
        <JewelryIcon />
      </VignetteItem>
      <VignetteItem tint={colors.fleaCorkDark} rotate={4} label={cameraLabel}>
        <CameraIcon />
      </VignetteItem>
    </div>
  );
}

function VignetteItem({
  children,
  tint,
  rotate,
  label,
}: {
  children: React.ReactNode;
  tint: string;
  rotate: number;
  label: string;
}) {
  return (
    <span
      className="flea-vignette"
      role="listitem"
      aria-label={label}
      title={label}
      style={{ background: tint, transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
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

function SweaterIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke={colors.fleaCream} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 12 L10 7 H22 L26 12 L22 15 V25 H10 V15 Z" />
      <path d="M12 16 h8" />
    </svg>
  );
}

function BlanketIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke={colors.fleaPenInk} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="9" width="22" height="16" rx="2" />
      <path d="M5 14h22M5 19h22" />
    </svg>
  );
}

function JewelryIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke={colors.fleaCream} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="12" width="20" height="12" rx="2" />
      <path d="M6 16h20" />
      <path d="M14 12a2 2 0 0 1 4 0" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke={colors.fleaCream} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="24" height="14" rx="2" />
      <path d="M12 10l2-3h4l2 3" />
      <circle cx="16" cy="17" r="4" />
    </svg>
  );
}
