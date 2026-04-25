"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageProvider";
import { renderWithContact } from "@/i18n/contactLink";
import { LanguageSelector } from "@/components/LanguageSelector";
import { LoadingSplash } from "@/components/LoadingSplash";
import { colors, fonts, shadows } from "@/styles/theme";

interface CancellationInfo {
  alreadyCancelled: boolean;
  boxId: number;
  tableLabel: string;
  recipientNameHint?: string;
}

type PageState =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "review"; info: CancellationInfo }
  | { kind: "already-cancelled"; info: CancellationInfo }
  | { kind: "confirming"; info: CancellationInfo }
  | { kind: "done" }
  | { kind: "error" };

function CancelPageContent() {
  const { t, ready } = useLanguage();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/public/cancel/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "invalid" });
          return;
        }
        const info = (await res.json()) as CancellationInfo;
        if (info.alreadyCancelled) {
          setState({ kind: "already-cancelled", info });
        } else {
          setState({ kind: "review", info });
        }
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleConfirm = useCallback(async () => {
    if (state.kind !== "review") return;
    setState({ kind: "confirming", info: state.info });
    try {
      const res = await fetch(`/public/cancel/${encodeURIComponent(token)}`, {
        method: "POST",
      });
      if (!res.ok) {
        setState({ kind: res.status === 404 ? "invalid" : "error" });
        return;
      }
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error" });
    }
  }, [state, token]);

  if (!ready || state.kind === "loading") {
    return <LoadingSplash />;
  }

  return (
    <main
      style={{
        fontFamily: fonts.sans,
        color: colors.fleaPenInk,
        background: colors.fleaCream,
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem 1.5rem",
          borderBottom: `1px solid ${colors.fleaSand}`,
          background: colors.fleaCream,
        }}
      >
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: "1.1rem",
            color: colors.fleaPenInk,
            margin: 0,
            fontWeight: 600,
          }}
        >
          {t("common.appName")}
        </h1>
        <LanguageSelector />
      </header>

      <section
        style={{
          maxWidth: 640,
          margin: "2.5rem auto",
          padding: "0 1.25rem",
        }}
      >
        {renderBody(state, t, handleConfirm, () => {
          if (typeof window !== "undefined") window.location.href = "/";
        })}
      </section>
    </main>
  );
}

function renderBody(
  state: PageState,
  t: ReturnType<typeof useLanguage>["t"],
  onConfirm: () => void,
  onHome: () => void,
) {
  const panel: React.CSSProperties = {
    background: colors.white,
    border: `1px solid ${colors.fleaSand}`,
    borderRadius: 12,
    boxShadow: shadows.card,
    padding: "2rem",
  };

  const heading: React.CSSProperties = {
    fontFamily: fonts.heading,
    fontSize: "1.5rem",
    color: colors.fleaPenInk,
    margin: "0 0 0.75rem",
    fontWeight: 700,
  };

  const linkStyle: React.CSSProperties = {
    color: colors.fleaTerracottaDark,
    fontWeight: 600,
    textDecoration: "none",
  };

  const homeLink = (
    <p style={{ marginTop: "1.5rem" }}>
      <button
        type="button"
        onClick={onHome}
        style={{
          background: "none",
          border: "none",
          color: colors.fleaTerracottaDark,
          fontWeight: 600,
          cursor: "pointer",
          padding: 0,
          fontFamily: fonts.body,
          fontSize: "0.95rem",
        }}
      >
        {t("cancel.backToHome")}
      </button>
    </p>
  );

  if (state.kind === "invalid") {
    return (
      <div style={panel}>
        <h2 style={heading}>{t("cancel.linkInvalidTitle")}</h2>
        <p style={{ lineHeight: 1.6 }}>
          {renderWithContact(t("cancel.linkInvalidBody"), linkStyle)}
        </p>
        {homeLink}
      </div>
    );
  }

  if (state.kind === "already-cancelled") {
    return (
      <div style={panel}>
        <h2 style={heading}>{t("cancel.alreadyCancelledTitle")}</h2>
        <p style={{ lineHeight: 1.6 }}>
          {renderWithContact(t("cancel.alreadyCancelledBody"), linkStyle)}
        </p>
        <DetailsBlock info={state.info} t={t} />
        {homeLink}
      </div>
    );
  }

  if (state.kind === "done") {
    return (
      <div style={panel}>
        <h2 style={heading}>{t("cancel.successTitle")}</h2>
        <p style={{ lineHeight: 1.6 }}>
          {renderWithContact(t("cancel.successBody"), linkStyle)}
        </p>
        {homeLink}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div style={panel}>
        <h2 style={heading}>{t("cancel.errorTitle")}</h2>
        <p style={{ lineHeight: 1.6 }}>
          {renderWithContact(t("cancel.errorBody"), linkStyle)}
        </p>
        {homeLink}
      </div>
    );
  }

  if (state.kind !== "review" && state.kind !== "confirming") {
    return null;
  }

  const { info } = state;
  const confirming = state.kind === "confirming";

  return (
    <div style={panel}>
      <h2 style={heading}>{t("cancel.reviewTitle")}</h2>
      <p style={{ lineHeight: 1.6 }}>{t("cancel.reviewIntro")}</p>

      <DetailsBlock info={info} t={t} />

      <h3
        style={{
          fontFamily: fonts.heading,
          fontSize: "1.05rem",
          marginTop: "1.75rem",
          marginBottom: "0.5rem",
          color: colors.fleaGreenDark,
        }}
      >
        {t("cancel.effectsTitle")}
      </h3>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.6 }}>
        <li>{t("cancel.effectEmail")}</li>
        <li>{t("cancel.effectHold")}</li>
        <li>{t("cancel.effectAdmins")}</li>
        <li>{t("cancel.effectIrreversible")}</li>
      </ul>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginTop: "1.75rem",
        }}
      >
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          style={{
            background: colors.fleaTerracotta,
            color: colors.white,
            border: "none",
            padding: "0.65rem 1.4rem",
            borderRadius: 6,
            fontSize: "0.95rem",
            fontWeight: 600,
            fontFamily: fonts.body,
            cursor: confirming ? "progress" : "pointer",
            opacity: confirming ? 0.75 : 1,
          }}
        >
          {confirming ? t("cancel.confirmingCta") : t("cancel.confirmCta")}
        </button>
        <button
          type="button"
          onClick={onHome}
          disabled={confirming}
          style={{
            background: colors.white,
            color: colors.fleaPenInk,
            border: `1px solid ${colors.fleaSand}`,
            padding: "0.65rem 1.4rem",
            borderRadius: 6,
            fontSize: "0.95rem",
            fontWeight: 500,
            fontFamily: fonts.body,
            cursor: confirming ? "progress" : "pointer",
          }}
        >
          {t("cancel.keepCta")}
        </button>
      </div>
    </div>
  );
}

interface DetailsProps {
  info: CancellationInfo;
  t: ReturnType<typeof useLanguage>["t"];
}

function DetailsBlock({ info, t }: DetailsProps) {
  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.6rem 0",
    borderBottom: `1px solid ${colors.fleaSand}`,
    gap: "1rem",
  };
  const label: React.CSSProperties = { color: colors.fleaPenInk, opacity: 0.75 };
  const value: React.CSSProperties = { fontWeight: 600, color: colors.fleaPenInk };

  return (
    <dl
      style={{
        marginTop: "1.25rem",
        marginBottom: 0,
        background: colors.fleaCream,
        border: `1px solid ${colors.fleaSand}`,
        borderRadius: 8,
        padding: "0.75rem 1rem",
      }}
    >
      {info.recipientNameHint ? (
        <div style={row}>
          <dt style={label}>{t("cancel.bookingHolder")}</dt>
          <dd style={value}>{info.recipientNameHint}</dd>
        </div>
      ) : null}
      <div style={{ ...row, borderBottom: "none" }}>
        <dt style={label}>{t("cancel.bookingTable")}</dt>
        <dd style={value}>{info.tableLabel}</dd>
      </div>
    </dl>
  );
}

export default function CancelPage() {
  return (
    <Suspense fallback={<LoadingSplash />}>
      <CancelPageContent />
    </Suspense>
  );
}
