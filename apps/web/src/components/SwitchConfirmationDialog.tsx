"use client";

import { formatTableSize, getTableById, type TableCatalogEntry } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts, alertWarning } from "@/styles/theme";

export interface SwitchDetails {
  existingTableId: number;
  existingTableLabel: string;
  newTableId: number;
  newTableLabel: string;
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
  const existingTable = getTableById(switchDetails.existingTableId);
  const newTable = getTableById(switchDetails.newTableId);
  const formatTable = (tableId: number, table?: TableCatalogEntry) => {
    const title = t("table.detailsTitle").replace("{number}", String(tableId));
    if (!table) return title;
    return `${title} (${formatTableSize(table)})`;
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
          data-testid="current-table"
          style={{
            flex: 1,
            minWidth: 200,
            border: `1px solid ${colors.dustyRose}`,
            borderRadius: 8,
            padding: "0.75rem",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: colors.warmBrown, marginBottom: "0.25rem" }}>
            {t("registration.switchCurrentTable")}
          </div>
          <div style={{ fontWeight: 600 }}>
            {formatTable(switchDetails.existingTableId, existingTable)}
          </div>
        </div>

        <div
          data-testid="new-table"
          style={{
            flex: 1,
            minWidth: 200,
            border: `1px solid ${colors.sage}`,
            borderRadius: 8,
            padding: "0.75rem",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: colors.warmBrown, marginBottom: "0.25rem" }}>
            {t("registration.switchNewTable")}
          </div>
          <div style={{ fontWeight: 600 }}>
            {formatTable(switchDetails.newTableId, newTable)}
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
