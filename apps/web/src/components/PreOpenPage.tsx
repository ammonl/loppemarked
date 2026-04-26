"use client";

import { useEffect, useState } from "react";
import { OPENING_TIMEZONE } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { HeroScene } from "@/components/HeroScene";
import { landingSceneAssets } from "@/components/landing/sceneConfig";
import "@/styles/landing.css";

function formatOpeningDatetime(iso: string, locale: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: OPENING_TIMEZONE,
  }).format(date);
}

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function diffParts(targetMs: number, nowMs: number): CountdownParts {
  const totalSeconds = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

interface PreOpenPageProps {
  openingDatetime: string;
  /**
   * Offset in milliseconds to add to `Date.now()` so countdown math runs
   * against the server clock instead of the (potentially drifted) client
   * clock. Negative when the client clock is running ahead of the server.
   * Defaults to 0 when no server time is available yet.
   */
  serverTimeOffsetMs?: number;
}

export function PreOpenPage({ openingDatetime, serverTimeOffsetMs = 0 }: PreOpenPageProps) {
  const { language, t } = useLanguage();
  const locale = language === "da" ? "da-DK" : "en-GB";
  const formattedDate = formatOpeningDatetime(openingDatetime, locale);
  const targetMs = new Date(openingDatetime).getTime();

  // Initialize from a deterministic snapshot so the SSR markup matches the
  // first client paint; the interval below then keeps the diff fresh.
  const [parts, setParts] = useState<CountdownParts>(() => diffParts(targetMs, targetMs));

  useEffect(() => {
    // Only refresh once, and only if we actually observed a positive
    // remaining time during this mount; this prevents a reload loop when the
    // server clock has not yet caught up to the client.
    let wasRunning = false;
    let refreshed = false;
    const tick = () => {
      const now = Date.now() + serverTimeOffsetMs;
      const remaining = targetMs - now;
      setParts(diffParts(targetMs, now));
      if (remaining > 0) {
        wasRunning = true;
        return;
      }
      if (wasRunning && !refreshed && typeof window !== "undefined") {
        refreshed = true;
        window.location.reload();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs, serverTimeOffsetMs]);

  return (
    <section className="flea-landing flea-preopen" aria-labelledby="flea-preopen-title">
      <HeroScene
        className="flea-landing__scene"
        background={landingSceneAssets.background}
        midground={landingSceneAssets.midground}
        foreground={landingSceneAssets.foreground}
      >
        <div className="flea-landing__overlay" data-testid="flea-preopen-overlay">
          <div className="flea-landing__copy flea-preopen__copy">
            <p className="flea-preopen__tagline">{t("status.shareYourTreasures")}</p>
            <h1 id="flea-preopen-title" className="flea-landing__title">
              {t("status.preOpenTitle")}
            </h1>
            <p className="flea-landing__body">{t("status.preOpenDescription")}</p>

            <dl className="flea-preopen__event" data-testid="flea-preopen-event">
              <div className="flea-preopen__event-row">
                <dt className="flea-preopen__event-label">{t("status.eventDateLabel")}</dt>
                <dd className="flea-preopen__event-value">{t("landing.eventDate")}</dd>
              </div>
              <div className="flea-preopen__event-row">
                <dt className="flea-preopen__event-label">{t("status.eventTimeLabel")}</dt>
                <dd className="flea-preopen__event-value">{t("landing.eventTime")}</dd>
              </div>
              <div className="flea-preopen__event-row">
                <dt className="flea-preopen__event-label">{t("status.eventPlaceLabel")}</dt>
                <dd className="flea-preopen__event-value">{t("landing.eventPlace")}</dd>
              </div>
            </dl>

            <FlipBoardCountdown
              parts={parts}
              labels={{
                days: t("status.countdownDays"),
                hours: t("status.countdownHours"),
                minutes: t("status.countdownMinutes"),
                seconds: t("status.countdownSeconds"),
              }}
              ariaLabel={t("status.countdownAriaLabel")}
            />

            <p className="flea-preopen__opens">
              <span className="flea-preopen__opens-label">{t("status.openingDatetime")}</span>
              <time className="flea-preopen__opens-value" dateTime={openingDatetime}>
                {formattedDate}
              </time>
            </p>

            <p className="flea-preopen__eligibility">{t("status.eligibility")}</p>
          </div>
        </div>
      </HeroScene>
    </section>
  );
}

interface FlipBoardCountdownProps {
  parts: CountdownParts;
  labels: { days: string; hours: string; minutes: string; seconds: string };
  ariaLabel: string;
}

function FlipBoardCountdown({ parts, labels, ariaLabel }: FlipBoardCountdownProps) {
  // Days can exceed two digits for far-out openings; clamp the rest to two
  // digits so the flip tiles stay aligned.
  const dayWidth = parts.days >= 100 ? 3 : 2;
  // role="timer" gives the board an accessible name; we deliberately omit
  // aria-live so screen readers don't announce every per-second tick.
  return (
    <div className="flea-flipboard" role="timer" aria-label={ariaLabel} data-testid="flea-flipboard">
      <FlipUnit value={parts.days} label={labels.days} digits={dayWidth} />
      <FlipSeparator />
      <FlipUnit value={parts.hours} label={labels.hours} digits={2} />
      <FlipSeparator />
      <FlipUnit value={parts.minutes} label={labels.minutes} digits={2} />
      <FlipSeparator />
      <FlipUnit value={parts.seconds} label={labels.seconds} digits={2} />
    </div>
  );
}

interface FlipUnitProps {
  value: number;
  label: string;
  digits: number;
}

function FlipUnit({ value, label, digits }: FlipUnitProps) {
  const display = String(Math.max(0, value)).padStart(digits, "0");
  return (
    <div className="flea-flipboard__unit">
      <div className="flea-flipboard__tiles" aria-hidden="true">
        {display.split("").map((digit, index) => (
          <FlipDigit key={`${index}-${digits}`} digit={digit} />
        ))}
      </div>
      <span className="flea-flipboard__label" aria-hidden="true">
        {label}
      </span>
    </div>
  );
}

function FlipDigit({ digit }: { digit: string }) {
  // Re-mounting the inner card whenever the digit changes restarts the CSS
  // flip keyframe; that's cheaper and more reliable than juggling JS state.
  return (
    <span className="flea-flipboard__tile">
      <span key={digit} className="flea-flipboard__card">
        <span className="flea-flipboard__card-half flea-flipboard__card-half--top">{digit}</span>
        <span className="flea-flipboard__card-half flea-flipboard__card-half--bottom">{digit}</span>
      </span>
    </span>
  );
}

function FlipSeparator() {
  return (
    <span className="flea-flipboard__sep" aria-hidden="true">
      <span />
      <span />
    </span>
  );
}
