"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts } from "@/styles/theme";
import { AdminRegistrations } from "./AdminRegistrations";
import { AdminWaitlist } from "./AdminWaitlist";
import { AdminTables } from "./AdminTables";
import { AdminSettings } from "./AdminSettings";
import { AdminAuditLog } from "./AdminAuditLog";
import { AdminAccount } from "./AdminAccount";
import { AdminMessaging } from "./AdminMessaging";
import { AdminStagingTools } from "./AdminStagingTools";

const isStaging = process.env.NEXT_PUBLIC_ENV === "staging";

type Tab = "registrations" | "waitlist" | "tables" | "messaging" | "settings" | "audit" | "account" | "stagingTools";

const BASE_TABS: Tab[] = ["tables", "waitlist", "registrations", "messaging", "settings", "audit", "account"];
const TABS: Tab[] = isStaging ? [...BASE_TABS, "stagingTools"] : BASE_TABS;

const TAB_KEYS: Record<Tab, "admin.tab.registrations" | "admin.tab.waitlist" | "admin.tab.tables" | "admin.tab.messaging" | "admin.tab.settings" | "admin.tab.audit" | "admin.tab.account" | "admin.tab.stagingTools"> = {
  registrations: "admin.tab.registrations",
  waitlist: "admin.tab.waitlist",
  tables: "admin.tab.tables",
  messaging: "admin.tab.messaging",
  settings: "admin.tab.settings",
  audit: "admin.tab.audit",
  account: "admin.tab.account",
  stagingTools: "admin.tab.stagingTools",
};

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("tables");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (!window.confirm(t("admin.logoutConfirm"))) return;

    setLoggingOut(true);
    try {
      await fetch("/admin/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* proceed with logout even on network error */
    } finally {
      setLoggingOut(false);
      onLogout();
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.25rem 1rem 2rem", fontFamily: fonts.sans }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <nav
          role="tablist"
          style={{
            display: "flex",
            gap: "0.25rem",
            borderBottom: `1px solid ${colors.fleaSand}`,
            overflowX: "auto",
            flex: 1,
            justifyContent: "center",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.6rem 1.25rem 0.75rem",
                border: "none",
                borderBottom:
                  activeTab === tab
                    ? `3px solid ${colors.fleaTerracottaDark}`
                    : "3px solid transparent",
                background: "none",
                cursor: "pointer",
                fontFamily: fonts.sans,
                fontSize: "0.85rem",
                fontWeight: activeTab === tab ? 600 : 500,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: activeTab === tab ? colors.fleaInk : colors.fleaPenInk,
                whiteSpace: "nowrap",
                marginBottom: "-1px",
              }}
            >
              {t(TAB_KEYS[tab])}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            padding: "0.5rem 1rem",
            background: "none",
            border: `1px solid ${colors.fleaTerracottaDark}`,
            color: colors.fleaTerracottaDark,
            borderRadius: 6,
            cursor: loggingOut ? "progress" : "pointer",
            fontSize: "0.8rem",
            fontFamily: fonts.sans,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            marginLeft: "1rem",
          }}
        >
          {loggingOut ? t("common.loading") : t("admin.logout")}
        </button>
      </div>

      <div role="tabpanel" style={{ margin: "0 auto" }}>
        {activeTab === "registrations" && <AdminRegistrations />}
        {activeTab === "waitlist" && <AdminWaitlist />}
        {activeTab === "tables" && <AdminTables />}
        {activeTab === "messaging" && <AdminMessaging />}
        {activeTab === "settings" && <AdminSettings />}
        {activeTab === "audit" && <AdminAuditLog />}
        {activeTab === "account" && <AdminAccount />}
        {activeTab === "stagingTools" && <AdminStagingTools />}
      </div>
    </div>
  );
}
