"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts, inputStyle as themeInputStyle, shadows } from "@/styles/theme";

interface AdminLoginProps {
  onLogin: () => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, rememberMe }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? t("admin.loginFailed"));
        return;
      }

      onLogin();
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  const labelTextStyle: React.CSSProperties = {
    fontSize: "0.78rem",
    fontWeight: 600,
    fontFamily: fonts.sans,
    color: colors.fleaPenInk,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };

  return (
    <section
      style={{
        maxWidth: 420,
        margin: "3rem auto",
        padding: "1.75rem",
        background: colors.fleaCream,
        border: `1px solid ${colors.fleaSand}`,
        borderRadius: 12,
        boxShadow: shadows.card,
      }}
    >
      <h2
        style={{
          margin: "0 0 1.25rem",
          fontFamily: fonts.sans,
          fontSize: "1.05rem",
          fontWeight: 700,
          color: colors.fleaInk,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {t("admin.login")}
      </h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <span style={labelTextStyle}>{t("admin.email")}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={{ ...themeInputStyle, fontSize: "1rem" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <span style={labelTextStyle}>{t("admin.password")}</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ ...themeInputStyle, fontSize: "1rem" }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span style={{ fontSize: "0.85rem", fontFamily: fonts.sans, color: colors.fleaPenInk }}>{t("admin.rememberMe")}</span>
        </label>
        {error && (
          <p role="alert" style={{ color: colors.fleaAccentInk, margin: 0, fontSize: "0.85rem", fontFamily: fonts.sans }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.65rem 1rem",
            background: colors.fleaTerracottaDark,
            color: colors.fleaCream,
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
            fontFamily: fonts.sans,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginTop: "0.25rem",
          }}
        >
          {loading ? t("common.loading") : t("admin.login")}
        </button>
      </form>
    </section>
  );
}
