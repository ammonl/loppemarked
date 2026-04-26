"use client";

import { useCallback, useEffect, useState } from "react";
import { OPENING_TIMEZONE } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts } from "@/styles/theme";
import { AdminNotificationPreferences } from "./AdminNotificationPreferences";

interface OpeningTimeData {
  openingDatetime: string;
  timezone: string;
  updatedAt: string | null;
}

const LOCALE_MAP: Record<string, string> = {
  da: "da-DK",
  en: "en-GB",
};

export function AdminSettings() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<OpeningTimeData | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/admin/settings/opening-time", {
        credentials: "include",
      });
      if (res.ok) {
        const body: OpeningTimeData = await res.json();
        setData(body);
        if (body.openingDatetime) {
          setInputValue(toLocalInput(body.openingDatetime));
        }
      }
    } catch {
      /* fetch error handled silently; data stays null */
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const isoValue = new Date(inputValue).toISOString();
      const res = await fetch("/admin/settings/opening-time", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ openingDatetime: isoValue }),
      });

      if (!res.ok) {
        const body = await res.json();
        setMessage({ type: "error", text: body.error ?? t("common.error") });
        return;
      }

      const updated: OpeningTimeData = await res.json();
      setData(updated);
      setInputValue(toLocalInput(updated.openingDatetime));
      setMessage({ type: "success", text: t("admin.settingsSaved") });
    } catch {
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <AdminNotificationPreferences />
    <section style={{ maxWidth: 500, margin: "2rem auto", padding: "0 1rem" }}>
      <h2 style={{ fontFamily: fonts.heading, color: colors.warmBrown }}>{t("admin.openingTimeTitle")}</h2>
      <p style={{ color: colors.warmBrown, fontSize: "0.9rem" }}>
        {t("admin.openingTimeDescription")} ({OPENING_TIMEZONE})
      </p>

      {data && (
        <div style={{ marginBottom: "1rem", fontSize: "0.9rem", color: colors.warmBrown }}>
          <p style={{ margin: "0.25rem 0" }}>
            <strong>{t("admin.currentValue")}:</strong>{" "}
            {formatDisplay(data.openingDatetime, language)}
          </p>
          {data.updatedAt && (
            <p style={{ margin: "0.25rem 0" }}>
              <strong>{t("admin.lastUpdated")}:</strong>{" "}
              {formatDisplay(data.updatedAt, language)}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, fontFamily: fonts.body, color: colors.warmBrown }}>
            {t("admin.newOpeningTime")}
          </span>
          <input
            type="datetime-local"
            required
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{ padding: "0.5rem", border: `1px solid ${colors.borderTan}`, borderRadius: 4, fontSize: "1rem", fontFamily: fonts.body }}
          />
        </label>

        {message && (
          <p
            role="alert"
            style={{
              color: message.type === "error" ? colors.dustyRose : colors.sageDark,
              margin: 0,
              fontSize: "0.85rem",
            }}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "0.5rem 1rem",
            background: colors.sage,
            color: colors.white,
            border: "none",
            borderRadius: 4,
            cursor: saving ? "progress" : "pointer",
            fontSize: "1rem",
            fontFamily: fonts.body,
            alignSelf: "flex-start",
          }}
        >
          {saving ? t("common.loading") : t("admin.save")}
        </button>
      </form>
    </section>
    </>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(iso: string, language: string): string {
  return new Date(iso).toLocaleString(LOCALE_MAP[language] ?? language, {
    timeZone: OPENING_TIMEZONE,
    dateStyle: "long",
    timeStyle: "short",
  });
}
