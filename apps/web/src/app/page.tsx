"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_OPENING_DATETIME } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import { useHistoryState } from "@/hooks/useHistoryState";
import { LanguageSelector } from "@/components/LanguageSelector";
import { BrandLogo } from "@/components/BrandLogo";
import { PreOpenPage } from "@/components/PreOpenPage";
import { LandingPage } from "@/components/LandingPage";
import { TableMapPage } from "@/components/TableMapPage";
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
  const [showTableMap, setShowTableMap] = useHistoryState<boolean>("home.tableMap", false);
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
    if (showTableMap) {
      return (
        <TableMapPage
          onBack={() => {
            setShowTableMap(false);
            fetchStatus();
          }}
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
    return <LandingPage onEnter={() => setShowTableMap(true)} />;
  }

  if (!ready || !statusResolved) {
    return <LoadingSplash />;
  }

  const publicView = view === "public";
  const mainBackground = publicView ? colors.fleaCream : colors.backgroundLight;

  const goHome = () => {
    setView("public");
    setShowTableMap(false);
    setShowWaitlistForm(false);
    if (typeof window !== "undefined") {
      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
  };

  return (
    <main style={{ fontFamily: fonts.sans, color: colors.fleaPenInk, background: mainBackground, minHeight: "100vh" }}>
      {publicView ? (
        <PublicHeader
          t={t}
          onHome={goHome}
          onAdmin={() => setView("admin")}
        />
      ) : (
        <AdminHeader t={t} onHome={goHome} />
      )}

      {renderContent()}
      {publicView && <ProjectAbout />}
    </main>
  );
}

interface PublicHeaderProps {
  t: (key: TranslationKey) => string;
  onHome: () => void;
  onAdmin: () => void;
}

function PublicHeader({ t, onHome, onAdmin }: PublicHeaderProps) {
  const handleAboutClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (typeof document === "undefined") return;
    const target = document.getElementById("about");
    if (!target) return;
    // Respect users who opt out of motion animations.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "0.75rem 1.5rem",
        background: colors.fleaCream,
        borderBottom: `1px solid ${colors.fleaSand}`,
        boxShadow: "0 1px 6px rgba(91, 70, 54, 0.06)",
        color: colors.fleaPenInk,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <button
        type="button"
        onClick={onHome}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          margin: 0,
          display: "inline-flex",
          alignItems: "center",
          lineHeight: 1,
        }}
        aria-label={t("common.appName")}
      >
        <BrandLogo variant="header" reactToBookingSuccess decorative />
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <button
            type="button"
            onClick={onHome}
            style={publicNavLinkStyle}
          >
            {t("nav.home")}
          </button>
          <a
            href="#about"
            onClick={handleAboutClick}
            style={publicNavLinkStyle}
          >
            {t("nav.about")}
          </a>
        </nav>
        <span aria-hidden style={{ width: 1, height: 20, background: colors.fleaSand }} />
        <button
          type="button"
          onClick={onAdmin}
          style={{
            ...publicNavLinkStyle,
            fontSize: "0.75rem",
            opacity: 0.55,
          }}
        >
          {t("admin.link")}
        </button>
        <LanguageSelector />
      </div>
    </header>
  );
}

const publicNavLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  margin: 0,
  cursor: "pointer",
  fontFamily: fonts.sans,
  fontSize: "0.9rem",
  fontWeight: 500,
  letterSpacing: "0.02em",
  color: colors.fleaPenInk,
  textDecoration: "none",
  opacity: 0.9,
};

interface AdminHeaderProps {
  t: (key: TranslationKey) => string;
  onHome: () => void;
}

function AdminHeader({ t, onHome }: AdminHeaderProps) {
  return (
    <header
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "1rem 1.5rem",
        borderBottom: `1px solid ${colors.borderTan}`,
        background: "transparent",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div />
      <button
        type="button"
        onClick={onHome}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          margin: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          color: colors.inkBrown,
          fontFamily: fonts.heading,
          fontSize: "1.25rem",
          lineHeight: 1,
        }}
        aria-label={t("common.appName")}
      >
        <h1
          style={{
            fontSize: "inherit",
            margin: 0,
            fontFamily: "inherit",
            color: "inherit",
            fontWeight: 700,
          }}
        >
          {t("common.appName")}
        </h1>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "flex-end" }}>
        <LanguageSelector />
      </div>
    </header>
  );
}
