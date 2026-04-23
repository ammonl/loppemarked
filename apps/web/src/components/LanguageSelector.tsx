"use client";

import { LANGUAGES, LANGUAGE_LABELS, type Language } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts } from "@/styles/theme";

interface LanguageSelectorProps {
  variant?: "light" | "dark";
}

export function LanguageSelector({ variant = "light" }: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage();
  const isDark = variant === "dark";
  const labelColor = isDark ? colors.fleaCream : colors.inkBrown;
  const dividerColor = isDark ? colors.fleaGreenDivider : colors.borderTan;

  return (
    <div className="language-selector" style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {LANGUAGES.map((lang: Language, i: number) => (
        <span key={lang} style={{ display: "flex", alignItems: "center" }}>
          {i > 0 && (
            <span style={{ color: dividerColor, fontSize: "0.875rem", margin: "0 2px" }}>|</span>
          )}
          <button
            onClick={() => setLanguage(lang)}
            aria-current={lang === language ? "true" : undefined}
            style={{
              fontWeight: lang === language ? 700 : 400,
              textDecoration: lang === language ? "underline" : "none",
              textUnderlineOffset: "3px",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
              fontSize: "0.875rem",
              fontFamily: fonts.body,
              color: labelColor,
            }}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        </span>
      ))}
    </div>
  );
}
