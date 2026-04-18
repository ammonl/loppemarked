"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_OPENING_DATETIME, GREENHOUSES, type Greenhouse } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useHistoryState } from "@/hooks/useHistoryState";
import { LanguageSelector } from "@/components/LanguageSelector";
import { PreOpenPage } from "@/components/PreOpenPage";
import { LandingPage } from "@/components/LandingPage";
import { GreenhouseMapPage } from "@/components/GreenhouseMapPage";
import { WaitlistForm } from "@/components/WaitlistForm";
import { AdminPage } from "@/components/AdminPage";
import { LoadingSplash } from "@/components/LoadingSplash";
import { ProjectAbout } from "@/components/ProjectAbout";
import { colors, fonts } from "@/styles/theme";

type View = "public" | "admin";

/** Polling interval when in pre-open state (30 seconds). */
const PRE_OPEN_POLL_MS = 30_000;

interface PublicStatus {
  isOpen: boolean;
  openingDatetime: string | null;
  serverTime?: string;
}

export default function Home() {
  const { t, ready } = useLanguage();
  const [view, setView] = useHistoryState<View>("home.view", "public");
  const [selectedGreenhouse, setSelectedGreenhouse] = useHistoryState<Greenhouse | null>("home.greenhouse", null);
  const [showWaitlistForm, setShowWaitlistForm] = useHistoryState<boolean>("home.waitlistForm", false);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [statusResolved, setStatusResolved] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/public/status");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      /* API unreachable — safe default is pre-open (deny early access) */
    } finally {
      setStatusResolved(true);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Server-authoritative gate: trust the server's isOpen flag.
  // When API is unreachable (status === null), default to pre-open (safe/deny).
  const preOpen = status ? !status.isOpen : true;
  const openingDatetime = status?.openingDatetime ?? DEFAULT_OPENING_DATETIME;

  // Poll /public/status while in pre-open so the page auto-transitions
  // at the correct server-determined time without requiring a manual refresh.
  useEffect(() => {
    if (preOpen) {
      pollRef.current = setInterval(fetchStatus, PRE_OPEN_POLL_MS);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [preOpen, fetchStatus]);

  function renderContent() {
    if (view === "admin") {
      return (
        <AdminPage
          onBack={() => setView("public")}
        />
      );
    }
    if (preOpen) {
      return <PreOpenPage openingDatetime={openingDatetime} />;
    }
    if (selectedGreenhouse) {
      return (
        <GreenhouseMapPage
          greenhouse={selectedGreenhouse}
          onBack={() => {
            setSelectedGreenhouse(null);
            fetchStatus();
          }}
          onSelectGreenhouse={setSelectedGreenhouse}
        />
      );
    }
    if (showWaitlistForm) {
      return (
        <WaitlistForm
          onCancel={() => setShowWaitlistForm(false)}
        />
      );
    }
    return <LandingPage onEnter={() => setSelectedGreenhouse(GREENHOUSES[0])} />;
  }

  if (!ready || !statusResolved) {
    return <LoadingSplash />;
  }

  const publicView = view === "public";
  const mainBackground = publicView ? colors.fleaCream : colors.backgroundLight;

  return (
    <main style={{ fontFamily: fonts.sans, color: colors.fleaPenInk, background: mainBackground, minHeight: "100vh" }}>
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          padding: "1rem 1.5rem",
          borderBottom: `1px solid ${publicView ? colors.fleaSand : colors.borderTan}`,
          background: publicView ? colors.fleaCream : "transparent",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div />
        <button
          type="button"
          onClick={() => {
            setView("public");
            setSelectedGreenhouse(null);
            setShowWaitlistForm(false);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            color: publicView ? colors.fleaTerracottaDark : colors.inkBrown,
            fontFamily: publicView ? fonts.display : fonts.heading,
            fontSize: publicView ? "1.9rem" : "1.25rem",
            lineHeight: 1,
          }}
          aria-label={t("common.appName")}
        >
          {publicView && (
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden fill="none">
              <path
                d="M12 20s-6-4.5-6-9a4 4 0 0 1 6-3.4A4 4 0 0 1 18 11c0 4.5-6 9-6 9z"
                fill={colors.fleaTerracotta}
                stroke={colors.fleaTerracottaDark}
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
              <path
                d="M12 10c.4-1.5 1.6-2.4 3-2.4"
                stroke={colors.fleaSageDark}
                strokeWidth="1.1"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          )}
          <h1
            style={{
              fontSize: "inherit",
              margin: 0,
              fontFamily: "inherit",
              color: "inherit",
              fontWeight: 700,
              letterSpacing: publicView ? "0.04em" : "normal",
            }}
          >
            {t("common.appName")}
          </h1>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "flex-end" }}>
          {publicView && (
            <button
              type="button"
              onClick={() => setView("admin")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: colors.warmBrown,
                opacity: 0.4,
                fontFamily: fonts.sans,
              }}
            >
              {t("admin.link")}
            </button>
          )}
          <LanguageSelector />
        </div>
      </header>

      {renderContent()}
      {publicView && <ProjectAbout />}
    </main>
  );
}
