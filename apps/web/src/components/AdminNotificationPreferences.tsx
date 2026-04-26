"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts } from "@/styles/theme";

interface NotificationPrefsData {
  notifyUserRegistration: boolean;
  notifyAdminTableAction: boolean;
  updatedAt: string | null;
}

export function AdminNotificationPreferences() {
  const { t } = useLanguage();
  const [data, setData] = useState<NotificationPrefsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch("/admin/settings/notification-preferences", {
        credentials: "include",
      });
      if (res.ok) {
        const body: NotificationPrefsData = await res.json();
        setData(body);
      }
    } catch {
      /* fetch error handled silently */
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  async function handleToggle(field: "notifyUserRegistration" | "notifyAdminTableAction") {
    if (!data) return;
    setMessage(null);
    setSaving(true);

    const newValue = !data[field];

    try {
      const res = await fetch("/admin/settings/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [field]: newValue }),
      });

      if (!res.ok) {
        const body = await res.json();
        setMessage({ type: "error", text: body.error ?? t("common.error") });
        return;
      }

      const updated: NotificationPrefsData = await res.json();
      setData(updated);
      setMessage({ type: "success", text: t("admin.settingsSaved") });
    } catch {
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setSaving(false);
    }
  }

  if (!data) return null;

  return (
    <section style={{ maxWidth: 500, margin: "2rem auto", padding: "0 1rem" }}>
      <h2 style={{ fontFamily: fonts.heading, color: colors.warmBrown }}>
        {t("admin.notifications.title")}
      </h2>
      <p style={{ color: colors.warmBrown, fontSize: "0.9rem", marginBottom: "1.5rem" }}>
        {t("admin.notifications.description")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            cursor: saving ? "progress" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={data.notifyUserRegistration}
            onChange={() => handleToggle("notifyUserRegistration")}
            disabled={saving}
            style={{ width: 18, height: 18, accentColor: colors.sage }}
          />
          <span style={{ fontSize: "0.95rem", color: colors.warmBrown, fontFamily: fonts.body }}>
            {t("admin.notifications.userRegistration")}
          </span>
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            cursor: saving ? "progress" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={data.notifyAdminTableAction}
            onChange={() => handleToggle("notifyAdminTableAction")}
            disabled={saving}
            style={{ width: 18, height: 18, accentColor: colors.sage }}
          />
          <span style={{ fontSize: "0.95rem", color: colors.warmBrown, fontFamily: fonts.body }}>
            {t("admin.notifications.adminTableAction")}
          </span>
        </label>
      </div>

      {message && (
        <p
          role="alert"
          style={{
            color: message.type === "error" ? colors.dustyRose : colors.sageDark,
            marginTop: "1rem",
            fontSize: "0.85rem",
          }}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
