"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts } from "@/styles/theme";

interface WaitlistBannerProps {
  position?: number | null;
  alreadyOnWaitlist?: boolean;
  onJoinWaitlist?: () => void;
}

export function WaitlistBanner({ position, alreadyOnWaitlist, onJoinWaitlist }: WaitlistBannerProps) {
  const { t } = useLanguage();

  return (
    <section
      style={{
        border: `1px solid ${colors.mutedGold}`,
        borderRadius: 10,
        backgroundColor: colors.warningBg,
        padding: "1.25rem",
        marginTop: "1.5rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
        {t("waitlist.title")}
      </h3>
      {alreadyOnWaitlist && (
        <p style={{ margin: "0 0 0.75rem", color: colors.warmBrown, fontSize: "0.95rem", fontFamily: fonts.body }}>
          {t("waitlist.alreadyOnWaitlist")}
        </p>
      )}
      {position != null && position > 0 && (
        <p
          style={{
            margin: "0 0 0.75rem",
            fontWeight: 600,
            fontSize: "1rem",
            fontFamily: fonts.body,
            color: colors.mutedGold,
          }}
        >
          {t("waitlist.positionLabel")}: #{position}
        </p>
      )}
      <p style={{ margin: 0, color: colors.warmBrown, fontSize: "0.95rem", fontFamily: fonts.body }}>
        {t("waitlist.emailFollowUp")}
      </p>
      {onJoinWaitlist && (
        <button
          type="button"
          onClick={onJoinWaitlist}
          style={{
            marginTop: "0.75rem",
            padding: "0.5rem 1rem",
            background: colors.mutedGold,
            color: colors.white,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: fonts.body,
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          {t("waitlist.joinButton")}
        </button>
      )}
    </section>
  );
}
