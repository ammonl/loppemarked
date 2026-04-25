"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlanterBoxPublic, TableCatalogEntry } from "@loppemarked/shared";
import {
  VISIBLE_TABLE_IDS,
  getTableById,
  STANDARD_TABLE_SIZE_LABEL,
  tableHasClothingRack,
} from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useHistoryState } from "@/hooks/useHistoryState";
import { LoadingSplash } from "./LoadingSplash";
import { RegistrationForm } from "./RegistrationForm";
import { WaitlistForm } from "./WaitlistForm";
import { TableMap, TableStateLegend } from "./TableMap";
import "@/styles/table-map.css";

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

  const visibleBoxes = useMemo(
    () => boxes.filter((b) => VISIBLE_TABLE_IDS.includes(b.id)),
    [boxes],
  );
  const total = visibleBoxes.length;
  const available = visibleBoxes.filter((b) => b.state === "available").length;
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
    <section className="flea-map">
      <button type="button" onClick={onBack} className="flea-map__back">
        &larr; {t("map.back")}
      </button>

      <header className="flea-paper-card flea-map__header">
        <h2 className="flea-map__title">{t("table.pageTitle")}</h2>
        <p className="flea-map__intro">{t("table.pageIntro")}</p>
      </header>

      <SellerNotes />

      <hr className="flea-map__divider" aria-hidden="true" />

      <div className="flea-map__counts">
        <span>
          {t("table.totalLabel")}: <strong>{total}</strong>
        </span>
        <span>
          {t("table.availableLabel")}: <strong className="is-available">{available}</strong>
        </span>
        <span>
          {t("table.reservedLabel")}: <strong className="is-reserved">{reserved}</strong>
        </span>
      </div>

      <div className="flea-map__legend">
        <TableStateLegend />
      </div>

      {!hasAvailable && (
        <FullCapacityNotice onJoinWaitlist={() => setPageView("waitlist")} />
      )}

      <div className="flea-map__layout">
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
        className="flea-paper-card flea-map__detail flea-map__detail--empty"
      >
        <p className="flea-map__detail-empty">{t("table.selectHint")}</p>
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
        className="flea-map__detail-backdrop"
        role="presentation"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className="flea-paper-card flea-map__detail flea-map__detail--open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-detail-title"
        tabIndex={-1}
      >
        <header className="flea-map__detail-header">
          <h3 id="table-detail-title" className="flea-map__detail-title">
            {t("table.detailsTitle").replace("{number}", String(headerNumber))}
          </h3>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("table.closePanel")}
            className="flea-map__detail-close"
          >
            ×
          </button>
        </header>

        {panelMode === "detail" && (
          <TableSummary boxId={selectedBoxId} isAvailable={isAvailable} />
        )}

        {panelMode === "detail" && isAvailable && (
          <button
            type="button"
            onClick={onOpenForm}
            className="flea-scene-cta flea-scene-cta--full"
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

function TableSummary({ boxId, isAvailable }: { boxId: number; isAvailable: boolean }) {
  const { t } = useLanguage();
  const table = getTableById(boxId);
  if (!table) return null;
  return (
    <div className="flea-map__summary">
      <p>
        <strong>{t("table.detailsSize")}:</strong> {STANDARD_TABLE_SIZE_LABEL}
      </p>
      {tableHasClothingRack(boxId) && (
        <p className="flea-map__summary-rack">
          <span aria-hidden>🧥</span> {t("table.detailsRack")}
        </p>
      )}
      {!isAvailable && (
        <p className="flea-map__summary-status" role="status">
          {t("table.detailsBookedStatus")}
        </p>
      )}
    </div>
  );
}

function SellerNotes() {
  const { t } = useLanguage();
  return (
    <aside className="flea-map__notes" aria-labelledby="flea-map-notes-title">
      <h3 id="flea-map-notes-title" className="flea-map__notes-title">
        {t("table.notes.title")}
      </h3>
      <ul className="flea-map__notes-list">
        <li>{t("table.notes.clothingRackOnlyDesignated")}</li>
        <li>{t("table.notes.bringYourOwnRack")}</li>
        <li>{t("table.notes.shareTable")}</li>
      </ul>
    </aside>
  );
}

function FullCapacityNotice({ onJoinWaitlist }: { onJoinWaitlist: () => void }) {
  const { t } = useLanguage();
  return (
    <section className="flea-paper-card flea-map__full-notice">
      <h3 className="flea-map__full-notice-title">{t("table.allBookedTitle")}</h3>
      <p className="flea-map__full-notice-body">{t("table.allBookedBody")}</p>
      <button
        type="button"
        onClick={onJoinWaitlist}
        className="flea-scene-cta"
      >
        {t("table.joinWaitlistCta")}
      </button>
    </section>
  );
}
