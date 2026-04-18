"use client";

import { getTableById } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts, alertWarning } from "@/styles/theme";

export interface SwitchDetails {
  existingBoxId: number;
  existingBoxName: string;
  existingGreenhouse: string;
  newBoxId: number;
  newBoxName: string;
  newGreenhouse: string;
}

interface SwitchConfirmationDialogProps {
  switchDetails: SwitchDetails;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

export function SwitchConfirmationDialog({
  switchDetails,
  onConfirm,
  onCancel,
  confirming = false,
}: SwitchConfirmationDialogProps) {
  const { t } = useLanguage();
  const existingTable = getTableById(switchDetails.existingBoxId);
  const newTable = getTableById(switchDetails.newBoxId);
  const formatTable = (boxId: number, sizeMeters?: number, priceDkk?: number) => {
    const title = t("table.detailsTitle").replace("{number}", String(boxId));
    if (sizeMeters === undefined || priceDkk === undefined) return title;
    return `${title} (${sizeMeters} ${t("table.meters")}, ${priceDkk} ${t("table.priceSuffix")})`;
  };

  return (
    <div
      role="alertdialog"
      aria-labelledby="switch-title"
      aria-describedby="switch-explainer"
      style={{
        background: colors.white,
        border: `2px solid ${colors.terracotta}`,
        borderRadius: 10,
        padding: "1.5rem",
        maxWidth: 520,
        margin: "2rem auto",
        fontFamily: fonts.body,
        color: colors.inkBrown,
      }}
    >
      <h3
        id="switch-title"
        style={{ margin: "0 0 1rem", color: colors.terracottaDark, fontSize: "1.1rem", fontFamily: fonts.heading }}
      >
        {t("registration.switchTitle")}
      </h3>

      <p
        id="switch-explainer"
        style={{
          ...alertWarning,
          margin: "0 0 1.25rem",
          lineHeight: 1.5,
        }}
      >
        {t("registration.switchExplainer")}
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div
          data-testid="current-box"
          style={{
            flex: 1,
            minWidth: 200,
            border: `1px solid ${colors.dustyRose}`,
            borderRadius: 8,
            padding: "0.75rem",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: colors.warmBrown, marginBottom: "0.25rem" }}>
            {t("registration.switchCurrentBox")}
          </div>
          <div style={{ fontWeight: 600 }}>
            {formatTable(
              switchDetails.existingBoxId,
              existingTable?.sizeMeters,
              existingTable?.priceDkk,
            )}
          </div>
        </div>

        <div
          data-testid="new-box"
          style={{
            flex: 1,
            minWidth: 200,
            border: `1px solid ${colors.sage}`,
            borderRadius: 8,
            padding: "0.75rem",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: colors.warmBrown, marginBottom: "0.25rem" }}>
            {t("registration.switchNewBox")}
          </div>
          <div style={{ fontWeight: 600 }}>
            {formatTable(
              switchDetails.newBoxId,
              newTable?.sizeMeters,
              newTable?.priceDkk,
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          style={{
            padding: "0.5rem 1rem",
            background: colors.parchment,
            border: `1px solid ${colors.borderTan}`,
            borderRadius: 6,
            cursor: confirming ? "default" : "pointer",
            fontFamily: fonts.body,
            fontSize: "0.9rem",
            color: colors.warmBrown,
          }}
        >
          {t("registration.switchKeep")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          style={{
            padding: "0.5rem 1rem",
            background: confirming ? colors.borderTan : colors.terracotta,
            color: colors.white,
            border: "none",
            borderRadius: 6,
            cursor: confirming ? "default" : "pointer",
            fontFamily: fonts.body,
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          {confirming ? t("common.loading") : t("registration.switchConfirm")}
        </button>
      </div>
    </div>
  );
}
