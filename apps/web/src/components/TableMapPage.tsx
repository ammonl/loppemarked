"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlanterBoxPublic, TableCatalogEntry } from "@loppemarked/shared";
import { getTableById } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { renderWithContact } from "@/i18n/contactLink";
import { useHistoryState } from "@/hooks/useHistoryState";
import { LoadingSplash } from "./LoadingSplash";
import { RegistrationForm } from "./RegistrationForm";
import { WaitlistForm } from "./WaitlistForm";
import { TableMap, TableStateLegend } from "./TableMap";
import { colors, fonts } from "@/styles/theme";

interface TableMapPageProps {
  onBack: () => void;
}

type PageView = "map" | "waitlist";

export function TableMapPage({ onBack }: TableMapPageProps) {
  const { t } = useLanguage();
  const [boxes, setBoxes] = useState<PlanterBoxPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageView, setPageView] = useHistoryState<PageView>("tableMap.pageView", "map");
  const [selectedBoxId, setSelectedBoxId] = useHistoryState<number | null>("tableMap.selectedBoxId", null);
  const [panelMode, setPanelMode] = useState<"closed" | "detail" | "form">("closed");

  const fetchBoxes = useCallback(async () => {
    try {
      const res = await fetch("/public/boxes");
      if (res.ok) {
        const data: PlanterBoxPublic[] = await res.json();
        setBoxes(data);
      }
    } catch {
      /* API unreachable — map shows empty; user will see all tables as occupied. */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes]);

  const boxesById = useMemo(() => {
    const map = new Map<number, PlanterBoxPublic>();
    for (const b of boxes) map.set(b.id, b);
    return map;
  }, [boxes]);

  const total = boxes.length;
  const available = boxes.filter((b) => b.state === "available").length;
  const reserved = total - available;
  const hasAvailable = available > 0;

  function handleSelectTable(table: TableCatalogEntry) {
    setSelectedBoxId(table.id);
    setPanelMode("detail");
  }

  function closePanel() {
    setSelectedBoxId(null);
    setPanelMode("closed");
  }

  if (loading) {
    return <LoadingSplash />;
  }

  if (pageView === "waitlist") {
    return (
      <WaitlistForm
        onCancel={() => setPageView("map")}
      />
    );
  }

  return (
    <section
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "1.5rem 1rem 3rem",
        color: colors.inkBrown,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "0.9rem",
          color: colors.warmBrown,
          padding: "0.25rem 0",
          marginBottom: "1rem",
          fontFamily: fonts.body,
        }}
      >
        &larr; {t("map.back")}
      </button>

      <header style={{ textAlign: "center", marginBottom: "1.25rem" }}>
        <h2
          style={{
            margin: 0,
            fontFamily: fonts.display,
            fontSize: "2.25rem",
            color: colors.fleaTerracottaDark,
            letterSpacing: "0.02em",
          }}
        >
          {t("table.pageTitle")}
        </h2>
        <p
          style={{
            margin: "0.5rem auto 0",
            maxWidth: 640,
            fontSize: "0.95rem",
            color: colors.warmBrown,
            fontFamily: fonts.body,
          }}
        >
          {t("table.pageIntro")}
        </p>
      </header>

      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
          justifyContent: "center",
          fontSize: "0.9rem",
          color: colors.warmBrown,
          fontFamily: fonts.body,
          marginBottom: "0.75rem",
        }}
      >
        <span>
          {t("table.totalLabel")}: <strong>{total}</strong>
        </span>
        <span>
          {t("table.availableLabel")}: <strong style={{ color: colors.fleaSageDark }}>{available}</strong>
        </span>
        <span>
          {t("table.reservedLabel")}: <strong style={{ color: colors.fleaTerracottaDark }}>{reserved}</strong>
        </span>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <TableStateLegend />
      </div>

      {!hasAvailable ? (
        <FullCapacityNotice onJoinWaitlist={() => setPageView("waitlist")} />
      ) : (
        <p style={{ textAlign: "center", fontSize: "0.85rem", color: colors.warmBrown, margin: "0 0 0.5rem" }}>
          {t("table.selectHint")}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)",
          gap: "1.5rem",
          alignItems: "start",
        }}
        className="flea-table-layout"
      >
        <TableMap
          boxesById={boxesById}
          selectedId={selectedBoxId}
          onSelect={handleSelectTable}
        />

        <DetailPanel
          selectedBoxId={selectedBoxId}
          boxesById={boxesById}
          panelMode={panelMode}
          onOpenForm={() => setPanelMode("form")}
          onClose={closePanel}
          onBookingSuccess={() => {
            fetchBoxes();
            closePanel();
          }}
          onBoxUnavailable={() => {
            closePanel();
            setPageView("waitlist");
          }}
        />
      </div>

      <p
        style={{
          marginTop: "2rem",
          textAlign: "center",
          fontSize: "0.85rem",
          color: colors.warmBrown,
          fontFamily: fonts.body,
        }}
      >
        {renderWithContact(t("table.supportContact"), { color: colors.warmBrown, fontWeight: 600 })}
      </p>

      <style>{mobilePanelStyles}</style>
    </section>
  );
}

interface DetailPanelProps {
  selectedBoxId: number | null;
  boxesById: Map<number, PlanterBoxPublic>;
  panelMode: "closed" | "detail" | "form";
  onOpenForm: () => void;
  onClose: () => void;
  onBookingSuccess: () => void;
  onBoxUnavailable: () => void;
}

function DetailPanel({
  selectedBoxId,
  boxesById,
  panelMode,
  onOpenForm,
  onClose,
  onBookingSuccess,
  onBoxUnavailable,
}: DetailPanelProps) {
  const { t } = useLanguage();
  const open = panelMode !== "closed" && selectedBoxId !== null;
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Move focus into the dialog when it opens, and close on Escape.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, panelMode, onClose]);

  if (!open || selectedBoxId === null) {
    return (
      <aside
        aria-hidden
        className="flea-table-detail flea-table-detail--empty"
        style={emptyPanelStyle}
      >
        <p style={{ margin: 0, color: colors.warmBrown, fontSize: "0.9rem", fontFamily: fonts.body }}>
          {t("table.selectHint")}
        </p>
      </aside>
    );
  }

  const box = boxesById.get(selectedBoxId);
  const table = getTableById(selectedBoxId);
  const isAvailable = box?.state === "available";
  const headerNumber = table ? table.number : selectedBoxId;

  return (
    <>
      <div
        className="flea-table-detail__backdrop"
        role="presentation"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className="flea-table-detail flea-table-detail--open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-detail-title"
        tabIndex={-1}
        style={openPanelStyle}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          }}
        >
          <h3
            id="table-detail-title"
            style={{
              margin: 0,
              fontFamily: fonts.display,
              fontSize: "1.6rem",
              color: colors.fleaTerracottaDark,
            }}
          >
            {t("table.detailsTitle").replace("{number}", String(headerNumber))}
          </h3>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("table.closePanel")}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.4rem",
              lineHeight: 1,
              color: colors.warmBrown,
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
            }}
          >
            ×
          </button>
        </header>

        {panelMode === "detail" && (
          <TableSummary boxId={selectedBoxId} />
        )}

        {panelMode === "detail" && isAvailable && (
          <button
            type="button"
            onClick={onOpenForm}
            style={bookNowStyle}
          >
            {t("table.bookNow")}
          </button>
        )}

        {panelMode === "form" && (
          <RegistrationForm
            boxId={selectedBoxId}
            embedded
            onCancel={onClose}
            onBoxUnavailable={onBoxUnavailable}
            onSuccess={onBookingSuccess}
          />
        )}
      </aside>
    </>
  );
}

function TableSummary({ boxId }: { boxId: number }) {
  const { t } = useLanguage();
  const table = getTableById(boxId);
  if (!table) return null;
  return (
    <div
      style={{
        background: colors.fleaNotePaper,
        border: `1px solid ${colors.fleaCork}`,
        borderRadius: 10,
        padding: "0.85rem 1rem",
        marginBottom: "1rem",
        color: colors.warmBrown,
        fontFamily: fonts.body,
        fontSize: "0.95rem",
      }}
    >
      <p style={{ margin: 0 }}>
        <strong>{t("table.detailsSize")}:</strong> {table.sizeMeters} {t("table.meters")}
      </p>
    </div>
  );
}

function FullCapacityNotice({ onJoinWaitlist }: { onJoinWaitlist: () => void }) {
  const { t } = useLanguage();
  return (
    <section
      style={{
        background: colors.fleaNotePaperWarm,
        border: `1px solid ${colors.fleaCork}`,
        borderRadius: 12,
        padding: "1.25rem 1.25rem",
        textAlign: "center",
        marginBottom: "1.25rem",
        color: colors.warmBrown,
        fontFamily: fonts.body,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontFamily: fonts.display,
          fontSize: "1.4rem",
          color: colors.fleaTerracottaDark,
        }}
      >
        {t("table.allBookedTitle")}
      </h3>
      <p style={{ margin: "0.5rem 0 1rem" }}>{t("table.allBookedBody")}</p>
      <button
        type="button"
        onClick={onJoinWaitlist}
        style={{
          padding: "0.6rem 1.5rem",
          background: colors.fleaSage,
          color: colors.fleaCream,
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: fonts.body,
          fontSize: "1rem",
          fontWeight: 600,
          boxShadow: "0 1px 4px rgba(74, 55, 40, 0.12)",
        }}
      >
        {t("table.joinWaitlistCta")}
      </button>
    </section>
  );
}

const bookNowStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  background: colors.fleaSage,
  color: colors.fleaCream,
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: fonts.body,
  fontSize: "1rem",
  fontWeight: 600,
  boxShadow: "0 1px 4px rgba(74, 55, 40, 0.12)",
};

const basePanelStyle: React.CSSProperties = {
  background: colors.fleaCream,
  border: `1px solid ${colors.fleaCork}`,
  borderRadius: 12,
  padding: "1rem",
  boxShadow: "0 2px 10px rgba(74, 55, 40, 0.08)",
  fontFamily: fonts.body,
};

const emptyPanelStyle: React.CSSProperties = {
  ...basePanelStyle,
  position: "sticky",
  top: "1rem",
};

const openPanelStyle: React.CSSProperties = {
  ...basePanelStyle,
  position: "sticky",
  top: "1rem",
};

const mobilePanelStyles = `
.flea-table-detail__backdrop { display: none; }
@media (max-width: 860px) {
  .flea-table-layout { grid-template-columns: 1fr !important; }
  .flea-table-detail--empty { display: none; }
  .flea-table-detail--open {
    position: fixed !important;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto !important;
    border-radius: 16px 16px 0 0 !important;
    max-height: 85vh;
    overflow-y: auto;
    z-index: 40;
  }
  .flea-table-detail__backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(26, 20, 14, 0.35);
    z-index: 39;
  }
}
`;
