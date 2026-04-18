"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { fonts, colors } from "@/styles/theme";

interface LandingPageProps {
  onEnter?: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const { t } = useLanguage();

  return (
    <section className="flea-landing" aria-labelledby="flea-landing-title">
      <style>{landingStyles}</style>

      <div className="flea-landing__hero">
        <div className="flea-landing__hero-copy">
          <span className="flea-landing__eyebrow" aria-hidden>
            UN17 Village · 2026
          </span>
          <h1 id="flea-landing-title" className="flea-landing__title">
            {t("landing.heroTitle")}
          </h1>
          <p className="flea-landing__body">{t("landing.heroBody")}</p>
          <MarketScene />
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
            tint: "#F4E8D4",
          },
          {
            label: t("landing.eventTimeLabel"),
            value: t("landing.eventTimeValue"),
            tilt: -1.5,
            icon: <ClockIcon />,
            tint: "#F7EEDD",
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
        <PriceTag label={t("landing.priceTagLabel")} />
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

function PriceTag({ label }: { label: string }) {
  return (
    <div className="flea-price-tag" aria-hidden>
      <span className="flea-price-tag__hole" />
      <span className="flea-price-tag__text">{label}</span>
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
            <stop offset="100%" stopColor="#D7B98E" />
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

function MarketScene() {
  return (
    <div className="flea-vignettes" aria-hidden>
      <VignetteItem tint={colors.fleaSage} rotate={-4}>
        <SweaterIcon />
      </VignetteItem>
      <VignetteItem tint={colors.fleaSand} rotate={3}>
        <BlanketIcon />
      </VignetteItem>
      <VignetteItem tint={colors.fleaTerracotta} rotate={-2}>
        <JewelryIcon />
      </VignetteItem>
      <VignetteItem tint={colors.fleaCorkDark} rotate={4}>
        <CameraIcon />
      </VignetteItem>
    </div>
  );
}

function VignetteItem({
  children,
  tint,
  rotate,
}: {
  children: React.ReactNode;
  tint: string;
  rotate: number;
}) {
  return (
    <span
      className="flea-vignette"
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

const landingStyles = `
  .flea-landing {
    max-width: 1080px;
    margin: 0 auto;
    padding: 2rem 1.25rem 1.5rem;
    font-family: ${fonts.sans};
    color: ${colors.fleaPenInk};
    position: relative;
  }

  .flea-landing__hero {
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: 2rem;
    align-items: center;
    padding: 1.5rem 0 2rem;
  }

  .flea-landing__eyebrow {
    display: inline-block;
    font-family: ${fonts.marker};
    color: ${colors.fleaTerracottaDark};
    font-size: 1.15rem;
    letter-spacing: 0.12em;
    margin-bottom: 0.5rem;
  }

  .flea-landing__title {
    font-family: ${fonts.display};
    font-size: clamp(2.5rem, 6vw, 4.25rem);
    line-height: 1.02;
    letter-spacing: 0.03em;
    color: ${colors.fleaTerracottaDark};
    margin: 0 0 1rem;
    font-weight: 700;
  }

  .flea-landing__body {
    font-family: ${fonts.sans};
    font-size: 1.05rem;
    line-height: 1.65;
    color: ${colors.fleaPenInk};
    margin: 0 0 1.25rem;
    max-width: 36rem;
  }

  .flea-hero-illustration {
    position: relative;
    aspect-ratio: 1 / 1;
    max-width: 420px;
    width: 100%;
    justify-self: center;
    filter: drop-shadow(0 8px 18px rgba(91, 70, 54, 0.14));
  }

  .flea-vignettes {
    display: flex;
    gap: 0.65rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .flea-vignette {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(91, 70, 54, 0.18);
  }

  .flea-corkboard {
    margin: 1rem auto 2rem;
    max-width: 860px;
  }

  .flea-corkboard__frame {
    background: linear-gradient(180deg, #8A5F3E, #6A4626);
    padding: 14px;
    border-radius: 14px;
    box-shadow: 0 12px 30px rgba(91, 70, 54, 0.18), inset 0 0 0 2px rgba(255,255,255,0.06);
  }

  .flea-corkboard__surface {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
    padding: 2rem 1.5rem;
    border-radius: 8px;
    background-color: ${colors.fleaCork};
    background-image:
      radial-gradient(circle at 12% 18%, rgba(138, 95, 60, 0.28) 0 1.2px, transparent 1.6px),
      radial-gradient(circle at 32% 72%, rgba(74, 50, 30, 0.35) 0 1.4px, transparent 1.8px),
      radial-gradient(circle at 64% 24%, rgba(138, 95, 60, 0.32) 0 1.2px, transparent 1.6px),
      radial-gradient(circle at 82% 62%, rgba(74, 50, 30, 0.32) 0 1.4px, transparent 1.8px),
      radial-gradient(circle at 48% 48%, rgba(160, 122, 85, 0.45) 0 1.2px, transparent 1.6px),
      radial-gradient(circle at 8% 84%, rgba(74, 50, 30, 0.25) 0 1.2px, transparent 1.6px),
      radial-gradient(circle at 92% 12%, rgba(74, 50, 30, 0.25) 0 1.2px, transparent 1.6px);
    background-size: 120px 120px, 160px 160px, 180px 180px, 140px 140px, 200px 200px, 150px 150px, 170px 170px;
    box-shadow: inset 0 0 0 2px rgba(74, 50, 30, 0.2), inset 0 0 24px rgba(74, 50, 30, 0.25);
  }

  .flea-note {
    position: relative;
    padding: 1.5rem 1.1rem 1rem;
    border-radius: 3px;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22), 0 1px 0 rgba(0,0,0,0.08);
    min-height: 130px;
    text-align: left;
    color: ${colors.fleaPenInk};
  }

  .flea-note__pin {
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #E46E52, #8A3A26 70%);
    box-shadow: 0 2px 3px rgba(0,0,0,0.35);
  }

  .flea-note__icon {
    margin-bottom: 0.35rem;
  }

  .flea-note__label {
    font-family: ${fonts.marker};
    font-weight: 700;
    font-size: 1.35rem;
    letter-spacing: 0.05em;
    color: ${colors.fleaTerracottaDark};
    text-transform: uppercase;
  }

  .flea-note__value {
    font-family: ${fonts.marker};
    font-size: 1.2rem;
    line-height: 1.3;
    color: ${colors.fleaPenInk};
  }

  .flea-landing__cta-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin: 0.5rem auto 1rem;
    position: relative;
    flex-wrap: wrap;
  }

  .flea-landing__cta {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    background: ${colors.fleaTerracotta};
    color: ${colors.fleaCream};
    border: none;
    padding: 0.95rem 1.9rem;
    border-radius: 999px;
    font-family: ${fonts.marker};
    font-size: 1.4rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    cursor: pointer;
    box-shadow: 0 8px 18px rgba(166, 86, 66, 0.28);
    transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
  }

  .flea-landing__cta:hover:not(:disabled) {
    background: ${colors.fleaTerracottaDark};
    transform: translateY(-1px);
    box-shadow: 0 10px 22px rgba(166, 86, 66, 0.32);
  }

  .flea-landing__cta:disabled {
    cursor: default;
    opacity: 0.85;
  }

  .flea-price-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: ${colors.fleaSand};
    color: ${colors.fleaPenInk};
    padding: 0.4rem 0.9rem 0.4rem 1.1rem;
    border-radius: 4px 16px 16px 4px;
    font-family: ${fonts.marker};
    font-size: 1.05rem;
    box-shadow: 0 3px 6px rgba(91, 70, 54, 0.18);
    transform: rotate(-4deg);
    position: relative;
  }

  .flea-price-tag__hole {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${colors.fleaCream};
    box-shadow: inset 0 0 0 1px ${colors.fleaCorkDark};
  }

  .flea-price-tag__text {
    font-weight: 600;
  }

  @media (max-width: 760px) {
    .flea-landing__hero {
      grid-template-columns: 1fr;
      gap: 1rem;
      text-align: center;
      padding: 1rem 0 1.5rem;
    }

    .flea-landing__body {
      margin-left: auto;
      margin-right: auto;
    }

    .flea-vignettes {
      justify-content: center;
    }

    .flea-corkboard__surface {
      grid-template-columns: 1fr;
      gap: 1.5rem;
      padding: 1.5rem 1rem;
    }

    .flea-hero-illustration {
      max-width: 300px;
    }

    .flea-landing__cta {
      font-size: 1.25rem;
      padding: 0.85rem 1.5rem;
    }
  }
`;
