"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts } from "@/styles/theme";
import { AdminLogin } from "./AdminLogin";
import { AdminDashboard } from "./AdminDashboard";

type AuthState = "checking" | "authenticated" | "unauthenticated";

export function AdminPage() {
  const { t } = useLanguage();
  const [authState, setAuthState] = useState<AuthState>("checking");

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/admin/auth/me", { credentials: "include" });
      setAuthState(res.ok ? "authenticated" : "unauthenticated");
    } catch {
      setAuthState("unauthenticated");
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  function handleLogin() {
    setAuthState("authenticated");
  }

  function handleLogout() {
    setAuthState("unauthenticated");
  }

  return (
    <div>
      {authState === "checking" && (
        <p style={{ textAlign: "center", color: colors.fleaPenInk, padding: "2rem", fontFamily: fonts.sans }}>
          {t("common.loading")}
        </p>
      )}

      {authState === "authenticated" && (
        <AdminDashboard onLogout={handleLogout} />
      )}

      {authState === "unauthenticated" && (
        <AdminLogin onLogin={handleLogin} />
      )}
    </div>
  );
}
