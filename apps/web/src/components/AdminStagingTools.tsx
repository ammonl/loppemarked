"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts } from "@/styles/theme";

export function AdminStagingTools() {
  const { t } = useLanguage();
  const [filling, setFilling] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleFillTables() {
    if (!window.confirm(t("admin.staging.fillTablesConfirm"))) return;

    setMessage(null);
    setFilling(true);
    try {
      const res = await fetch("/admin/staging/fill-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: true }),
      });

      if (!res.ok) {
        let errorText: string;
        try {
          const body = await res.json();
          errorText = body.error ?? t("common.error");
        } catch {
          errorText = `${t("common.error")} (HTTP ${res.status})`;
        }
        setMessage({ type: "error", text: errorText });
        return;
      }

      const body: { filledCount: number } = await res.json();
      setMessage({
        type: "success",
        text: `${body.filledCount} ${t("admin.staging.fillTablesSuccess")}`,
      });
    } catch (err) {
      console.error("Failed to fill tables:", err);
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setFilling(false);
    }
  }

  async function handleClearRegistrations() {
    if (!window.confirm(t("admin.staging.clearRegistrationsConfirm"))) return;

    setMessage(null);
    setClearing(true);
    try {
      const res = await fetch("/admin/staging/clear-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: true }),
      });

      if (!res.ok) {
        let errorText: string;
        try {
          const body = await res.json();
          errorText = body.error ?? t("common.error");
        } catch {
          errorText = `${t("common.error")} (HTTP ${res.status})`;
        }
        setMessage({ type: "error", text: errorText });
        return;
      }

      const body: { clearedCount: number } = await res.json();
      setMessage({
        type: "success",
        text: `${body.clearedCount} ${t("admin.staging.clearRegistrationsSuccess")}`,
      });
    } catch (err) {
      console.error("Failed to clear registrations:", err);
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setClearing(false);
    }
  }

  return (
    <section style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
      <h2 style={{ fontFamily: fonts.heading, color: colors.warmBrown }}>
        {t("admin.staging.title")}
      </h2>

      <p
        style={{
          padding: "0.75rem",
          background: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: 4,
          color: "#856404",
          fontSize: "0.85rem",
          marginBottom: "1.5rem",
        }}
      >
        {t("admin.staging.warning")}
      </p>

      {message && (
        <p
          role="alert"
          style={{
            color: message.type === "error" ? colors.dustyRose : colors.sageDark,
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {message.text}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div
          style={{
            border: `1px solid ${colors.borderTan}`,
            borderRadius: 4,
            padding: "1rem",
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem", fontFamily: fonts.body, color: colors.warmBrown, fontSize: "1rem" }}>
            {t("admin.staging.fillTables")}
          </h3>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: colors.warmBrown }}>
            {t("admin.staging.fillTablesDescription")}
          </p>
          <button
            type="button"
            onClick={handleFillTables}
            disabled={filling || clearing}
            style={{
              padding: "0.5rem 1rem",
              background: colors.sage,
              color: colors.white,
              border: "none",
              borderRadius: 4,
              cursor: filling || clearing ? "progress" : "pointer",
              fontSize: "0.9rem",
              fontFamily: fonts.body,
            }}
          >
            {filling ? t("common.loading") : t("admin.staging.fillTables")}
          </button>
        </div>

        <div
          style={{
            border: `1px solid ${colors.dustyRose}`,
            borderRadius: 4,
            padding: "1rem",
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem", fontFamily: fonts.body, color: colors.warmBrown, fontSize: "1rem" }}>
            {t("admin.staging.clearRegistrations")}
          </h3>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: colors.warmBrown }}>
            {t("admin.staging.clearRegistrationsDescription")}
          </p>
          <button
            type="button"
            onClick={handleClearRegistrations}
            disabled={filling || clearing}
            style={{
              padding: "0.5rem 1rem",
              background: colors.dustyRose,
              color: colors.white,
              border: "none",
              borderRadius: 4,
              cursor: filling || clearing ? "progress" : "pointer",
              fontSize: "0.9rem",
              fontFamily: fonts.body,
            }}
          >
            {clearing ? t("common.loading") : t("admin.staging.clearRegistrations")}
          </button>
        </div>
      </div>
    </section>
  );
}
