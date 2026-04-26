"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TableState } from "@loppemarked/shared";
import {
  ELIGIBLE_STREET,
  formatTableLabel,
  formatTableSize,
  getTableById,
  isFloorDoorRequired,
  validateRegistrationInput,
} from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  colors,
  fonts,
  buttonPrimary,
  buttonSecondary,
  buttonDanger,
  buttonTerracotta,
  dialogStyle,
  tableHeaderStyle,
  tableRowStyle,
  tableCellStyle,
} from "@/styles/theme";
import { useTableControls } from "@/hooks/useTableControls";
import { TableControls } from "./TableControls";
import { SortableHeader } from "./SortableHeader";
import { TABLE_STATE_COLORS } from "./tableStateColors";
import { NotificationComposer, type NotificationValue } from "./NotificationComposer";

interface TableRegistration {
  id: string;
  name: string;
  email: string;
  language: string;
}

interface AdminTable {
  id: number;
  state: TableState;
  registration: TableRegistration | null;
}

interface AdminTableRow extends AdminTable {
  tableNumber: number;
  sizeLabel: string;
  /** Sortable size proxy: total area in cm² (lengthCm × widthCm). */
  sizeArea: number;
  tableLabel: string;
  _searchText: string;
}

type ActiveDialog =
  | { type: "reserve"; table: AdminTableRow }
  | { type: "release"; table: AdminTableRow }
  | { type: "removeRegistration"; table: AdminTableRow }
  | { type: "addRegistration"; table: AdminTableRow }
  | null;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.4rem",
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 4,
  fontSize: "0.85rem",
  fontFamily: fonts.body,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  marginBottom: "0.25rem",
  color: colors.warmBrown,
  fontFamily: fonts.body,
};

function enrichTable(t: AdminTable): AdminTableRow {
  const catalogEntry = getTableById(t.id);
  const tableNumber = catalogEntry?.number ?? t.id;
  const sizeLabel = catalogEntry ? formatTableSize(catalogEntry) : "—";
  const sizeArea = catalogEntry ? catalogEntry.widthCm * catalogEntry.lengthCm : 0;
  const tableLabel = formatTableLabel(t.id);
  return {
    ...t,
    tableNumber,
    sizeLabel,
    sizeArea,
    tableLabel,
    _searchText: [
      tableLabel,
      String(tableNumber),
      sizeLabel,
      t.registration?.name,
      t.registration?.email,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function AdminTables() {
  const { t } = useLanguage();
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);

  const [removeMakePublic, setRemoveMakePublic] = useState(true);
  const [removeNotification, setRemoveNotification] = useState<NotificationValue>({ sendEmail: true, subject: "", bodyHtml: "", valid: true });

  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addHouseNumber, setAddHouseNumber] = useState("");
  const [addFloor, setAddFloor] = useState("");
  const [addDoor, setAddDoor] = useState("");
  const [addLanguage, setAddLanguage] = useState<"da" | "en">("en");
  const [addNotification, setAddNotification] = useState<NotificationValue>({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
  const [addErrors, setAddErrors] = useState<string[]>([]);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeDialog && dialogRef.current) {
      dialogRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeDialog]);

  const enrichedTables = useMemo<AdminTableRow[]>(() => tables.map(enrichTable), [tables]);

  const stateOptions = useMemo(() => {
    const states = [...new Set(enrichedTables.map((row) => row.state))];
    return [
      { label: t("admin.table.allStates"), value: "__all__" },
      ...states.map((s) => ({ label: t(`map.state.${s}`), value: s })),
    ];
  }, [enrichedTables, t]);

  const {
    sort,
    toggleSort,
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearAll,
    hasActiveControls,
    processedData: filteredTables,
  } = useTableControls({
    data: enrichedTables,
    defaultSort: { key: "tableNumber", direction: "asc" },
    searchableFields: ["tableLabel", "_searchText"],
    filterConfigs: [{ key: "state", allValue: "__all__" }],
  });

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch("/admin/tables", { credentials: "include" });
      if (res.ok) {
        setTables(await res.json());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  function closeDialog() {
    setActiveDialog(null);
  }

  function openReserveDialog(table: AdminTableRow) {
    setMessage(null);
    setActiveDialog({ type: "reserve", table });
  }

  function openReleaseDialog(table: AdminTableRow) {
    setMessage(null);
    setActiveDialog({ type: "release", table });
  }

  function openRemoveRegistrationDialog(table: AdminTableRow) {
    setRemoveMakePublic(true);
    setRemoveNotification({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
    setMessage(null);
    setActiveDialog({ type: "removeRegistration", table });
  }

  function openAddRegistrationDialog(table: AdminTableRow) {
    setAddName("");
    setAddEmail("");
    setAddHouseNumber("");
    setAddFloor("");
    setAddDoor("");
    setAddLanguage("en");
    setAddNotification({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
    setAddErrors([]);
    setMessage(null);
    setActiveDialog({ type: "addRegistration", table });
  }

  async function handleReserve() {
    if (!activeDialog || activeDialog.type !== "reserve") return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/admin/tables/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tableId: activeDialog.table.id }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: t("admin.tables.reserved") });
        setActiveDialog(null);
        await fetchTables();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? t("common.error") });
      }
    } catch {
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRelease() {
    if (!activeDialog || activeDialog.type !== "release") return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/admin/tables/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tableId: activeDialog.table.id }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: t("admin.tables.released") });
        setActiveDialog(null);
        await fetchTables();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? t("common.error") });
      }
    } catch {
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveRegistration() {
    if (!activeDialog || activeDialog.type !== "removeRegistration") return;
    const reg = activeDialog.table.registration;
    if (!reg) return;

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/admin/registrations/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          registrationId: reg.id,
          makeTablePublic: removeMakePublic,
          notification: {
            sendEmail: removeNotification.sendEmail,
            subject: removeNotification.subject || undefined,
            bodyHtml: removeNotification.bodyHtml || undefined,
          },
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: t("admin.tables.registrationRemoved") });
        setActiveDialog(null);
        await fetchTables();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? t("common.error") });
      }
    } catch {
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setSubmitting(false);
    }
  }

  const parsedAddHouseNumber = parseInt(addHouseNumber, 10);
  const addNeedsUnitFields = !isNaN(parsedAddHouseNumber) && isFloorDoorRequired(parsedAddHouseNumber);

  async function handleAddRegistration() {
    if (!activeDialog || activeDialog.type !== "addRegistration") return;
    setAddErrors([]);

    const input = {
      name: addName.trim(),
      email: addEmail.trim(),
      street: ELIGIBLE_STREET,
      houseNumber: parsedAddHouseNumber,
      floor: addFloor.trim() || null,
      door: addDoor.trim() || null,
      language: addLanguage,
      tableId: activeDialog.table.id,
    };

    const validation = validateRegistrationInput(input);
    if (!validation.valid) {
      const fieldErrors: string[] = [];
      if (validation.errors["name"]) fieldErrors.push(t("validation.nameRequired"));
      if (validation.errors["email"]) {
        const isRequired = !addEmail.trim();
        fieldErrors.push(t(isRequired ? "validation.emailRequired" : "validation.emailInvalid"));
      }
      if (validation.errors["houseNumber"]) fieldErrors.push(t("validation.houseNumberInvalid"));
      if (validation.errors["floorDoor"]) fieldErrors.push(t("validation.floorDoorRequired"));
      setAddErrors(fieldErrors.length > 0 ? fieldErrors : [t("common.error")]);
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/admin/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tableId: input.tableId,
          name: input.name,
          email: input.email,
          street: input.street,
          houseNumber: input.houseNumber,
          floor: input.floor,
          door: input.door,
          language: input.language,
          notification: {
            sendEmail: addNotification.sendEmail,
            subject: addNotification.subject || undefined,
            bodyHtml: addNotification.bodyHtml || undefined,
          },
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: t("admin.tables.registrationAdded") });
        setActiveDialog(null);
        await fetchTables();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? t("common.error") });
      }
    } catch {
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p>{t("common.loading")}</p>;
  }

  if (error) {
    return <p style={{ color: colors.dustyRose }}>{t("common.error")}</p>;
  }

  const available = enrichedTables.filter((row) => row.state === "available").length;
  const occupied = enrichedTables.filter((row) => row.state === "occupied").length;
  const reserved = enrichedTables.filter((row) => row.state === "reserved").length;

  function renderActions(table: AdminTableRow) {
    const disabled = activeDialog !== null;
    const disabledCursor = disabled ? "not-allowed" : undefined;

    if (table.state === "available") {
      return (
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            onClick={() => openReserveDialog(table)}
            disabled={disabled}
            style={{ ...buttonSecondary, padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: disabledCursor }}
          >
            {t("admin.tables.reserve")}
          </button>
          <button
            type="button"
            onClick={() => openAddRegistrationDialog(table)}
            disabled={disabled}
            style={{ ...buttonPrimary, padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: disabledCursor }}
          >
            {t("admin.tables.addRegistration")}
          </button>
        </div>
      );
    }

    if (table.state === "reserved") {
      const reservedColors = TABLE_STATE_COLORS.reserved;
      return (
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            onClick={() => openReleaseDialog(table)}
            disabled={disabled}
            style={{
              ...buttonSecondary,
              padding: "0.25rem 0.75rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              background: reservedColors.background,
              color: reservedColors.text,
              border: `1px solid ${reservedColors.border}`,
              cursor: disabledCursor,
            }}
          >
            {t("admin.tables.release")}
          </button>
          <button
            type="button"
            onClick={() => openAddRegistrationDialog(table)}
            disabled={disabled}
            style={{ ...buttonPrimary, padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: disabledCursor }}
          >
            {t("admin.tables.addRegistration")}
          </button>
        </div>
      );
    }

    if (table.state === "occupied") {
      return (
        <button
          type="button"
          onClick={() => openRemoveRegistrationDialog(table)}
          disabled={disabled}
          style={{ ...buttonDanger, padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: disabledCursor }}
        >
          {t("admin.tables.removeRegistration")}
        </button>
      );
    }

    return null;
  }

  return (
    <section>
      <h2 style={{ marginBottom: "1rem", fontFamily: fonts.heading, color: colors.warmBrown, maxWidth: "80%", marginLeft: "auto", marginRight: "auto" }}>
        {t("admin.tables.title")}
      </h2>

      <p
        style={{
          maxWidth: "80%",
          margin: "0 auto 1rem",
          fontSize: "0.85rem",
          color: colors.warmBrown,
          fontFamily: fonts.body,
        }}
      >
        <strong>{enrichedTables.length}</strong> {t("admin.tables.number")}s ·{" "}
        <span style={{ color: colors.sageDark }}>{available} {t("admin.tables.availableCount")}</span> ·{" "}
        <span style={{ color: colors.warmBrown }}>{occupied} {t("admin.tables.occupiedCount")}</span> ·{" "}
        <span style={{ color: colors.warmBrown }}>{reserved} {t("admin.tables.reservedCount")}</span>
      </p>

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          style={{
            color: message.type === "error" ? colors.dustyRose : colors.sage,
            fontSize: "0.85rem",
            marginBottom: "1rem",
            maxWidth: "80%",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {message.text}
        </p>
      )}

      {/* Reserve Dialog */}
      {activeDialog?.type === "reserve" && (
        <div role="dialog" aria-labelledby="reserve-dialog-title" style={{ ...dialogStyle, marginBottom: "1.5rem", maxWidth: "80%", marginLeft: "auto", marginRight: "auto" }}>
          <h3 id="reserve-dialog-title" style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.tables.confirmReserve")} – {activeDialog.table.tableLabel}
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={handleReserve} disabled={submitting} style={{ ...buttonTerracotta, cursor: submitting ? "progress" : "pointer" }}>
              {t("common.confirm")}
            </button>
            <button type="button" onClick={closeDialog} disabled={submitting} style={{ ...buttonSecondary, cursor: submitting ? "progress" : "pointer" }}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Release Dialog */}
      {activeDialog?.type === "release" && (
        <div role="dialog" aria-labelledby="release-dialog-title" style={{ ...dialogStyle, marginBottom: "1.5rem", maxWidth: "80%", marginLeft: "auto", marginRight: "auto" }}>
          <h3 id="release-dialog-title" style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.tables.confirmRelease")} – {activeDialog.table.tableLabel}
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={handleRelease} disabled={submitting} style={{ ...buttonPrimary, cursor: submitting ? "progress" : "pointer" }}>
              {t("common.confirm")}
            </button>
            <button type="button" onClick={closeDialog} disabled={submitting} style={{ ...buttonSecondary, cursor: submitting ? "progress" : "pointer" }}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Remove Registration Dialog */}
      {activeDialog?.type === "removeRegistration" && activeDialog.table.registration && (
        <div ref={dialogRef} role="dialog" aria-labelledby="remove-reg-dialog-title" style={{ ...dialogStyle, marginBottom: "1.5rem", maxWidth: "80%", marginLeft: "auto", marginRight: "auto" }}>
          <h3 id="remove-reg-dialog-title" style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.tables.confirmRemoveRegistration")} – {activeDialog.table.tableLabel}
          </h3>
          <p style={{ fontSize: "0.85rem", color: colors.inkBrown, margin: "0 0 0.75rem" }}>
            {t("admin.tables.occupiedBy")}: {activeDialog.table.registration.name} ({activeDialog.table.registration.email})
          </p>

          <fieldset style={{ border: "none", padding: 0, margin: "0 0 0.75rem 0" }}>
            <legend style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: colors.warmBrown }}>
              {t("admin.tables.releaseType")}
            </legend>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", cursor: "pointer" }}>
              <input type="radio" name="table-release-type" checked={removeMakePublic} onChange={() => setRemoveMakePublic(true)} />
              <span style={{ fontSize: "0.85rem" }}>{t("admin.tables.releasePublic")}</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="radio" name="table-release-type" checked={!removeMakePublic} onChange={() => setRemoveMakePublic(false)} />
              <span style={{ fontSize: "0.85rem" }}>{t("admin.tables.releaseReserved")}</span>
            </label>
          </fieldset>

          <NotificationComposer
            action="remove"
            recipientName={activeDialog.table.registration.name}
            recipientEmail={activeDialog.table.registration.email}
            recipientLanguage={activeDialog.table.registration.language}
            tableId={activeDialog.table.id}
            value={removeNotification}
            onChange={setRemoveNotification}
          />

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={handleRemoveRegistration}
              disabled={submitting || (removeNotification.sendEmail && !removeNotification.valid)}
              style={{
                ...buttonDanger,
                background: colors.dustyRose,
                color: colors.white,
                border: "none",
                cursor: submitting ? "progress" : removeNotification.sendEmail && !removeNotification.valid ? "not-allowed" : "pointer",
              }}
            >
              {t("common.confirm")}
            </button>
            <button type="button" onClick={closeDialog} disabled={submitting} style={{ ...buttonSecondary, cursor: submitting ? "progress" : "pointer" }}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Add Registration Dialog */}
      {activeDialog?.type === "addRegistration" && (
        <div ref={dialogRef} role="dialog" aria-labelledby="add-reg-dialog-title" style={{ ...dialogStyle, marginBottom: "1.5rem", maxWidth: "80%", marginLeft: "auto", marginRight: "auto" }}>
          <h3 id="add-reg-dialog-title" style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.tables.addRegistration")} – {activeDialog.table.tableLabel}
          </h3>
          <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: colors.warmBrown }}>
            <strong>{t("admin.tables.size")}:</strong> {activeDialog.table.sizeLabel}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label htmlFor="table-add-name" style={labelStyle}>{t("admin.registrations.addName")} *</label>
              <input id="table-add-name" type="text" value={addName} onChange={(e) => setAddName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="table-add-email" style={labelStyle}>{t("admin.registrations.addEmail")} *</label>
              <input id="table-add-email" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="table-add-street" style={labelStyle}>{t("admin.registrations.addStreet")}</label>
              <input id="table-add-street" type="text" value={ELIGIBLE_STREET} disabled style={{ ...inputStyle, background: colors.parchment, color: colors.warmBrown }} />
            </div>
            <div>
              <label htmlFor="table-add-house-number" style={labelStyle}>{t("admin.registrations.addHouseNumber")} *</label>
              <input
                id="table-add-house-number"
                type="text"
                inputMode="numeric"
                pattern="\d{3}"
                maxLength={3}
                value={addHouseNumber}
                onChange={(e) => { setAddHouseNumber(e.target.value.replace(/\D/g, "")); setAddFloor(""); setAddDoor(""); }}
                style={inputStyle}
              />
            </div>
            {addNeedsUnitFields && (
              <>
                <div>
                  <label htmlFor="table-add-floor" style={labelStyle}>{t("admin.registrations.addFloor")} *</label>
                  <input id="table-add-floor" type="text" value={addFloor} onChange={(e) => setAddFloor(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="table-add-door" style={labelStyle}>{t("admin.registrations.addDoor")}</label>
                  <input id="table-add-door" type="text" value={addDoor} onChange={(e) => setAddDoor(e.target.value)} style={inputStyle} />
                </div>
              </>
            )}
            <div>
              <label htmlFor="table-add-language" style={labelStyle}>{t("admin.registrations.addLanguage")} *</label>
              <select id="table-add-language" value={addLanguage} onChange={(e) => setAddLanguage(e.target.value as "da" | "en")} style={inputStyle}>
                <option value="da">Dansk</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {addErrors.length > 0 && (
            <div
              role="alert"
              style={{
                background: colors.errorBg,
                border: `1px solid ${colors.dustyRose}`,
                borderRadius: 6,
                padding: "0.75rem",
                marginTop: "0.75rem",
                fontSize: "0.85rem",
                color: colors.errorText,
              }}
            >
              {addErrors.map((err) => (
                <p key={err} style={{ margin: "0.25rem 0" }}>{err}</p>
              ))}
            </div>
          )}

          {addName && addEmail && (
            <NotificationComposer
              action="add"
              recipientName={addName}
              recipientEmail={addEmail}
              recipientLanguage={addLanguage}
              tableId={activeDialog.table.id}
              value={addNotification}
              onChange={setAddNotification}
            />
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={handleAddRegistration}
              disabled={submitting || (addNotification.sendEmail && !addNotification.valid)}
              style={{
                ...buttonPrimary,
                cursor: submitting ? "progress" : addNotification.sendEmail && !addNotification.valid ? "not-allowed" : "pointer",
              }}
            >
              {t("common.confirm")}
            </button>
            <button type="button" onClick={closeDialog} disabled={submitting} style={{ ...buttonSecondary, cursor: submitting ? "progress" : "pointer" }}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: "80%", marginLeft: "auto", marginRight: "auto" }}>
        <TableControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              key: "state",
              label: t("admin.tables.state"),
              options: stateOptions,
              value: filters["state"],
              onChange: (v) => setFilter("state", v),
            },
          ]}
          hasActiveControls={hasActiveControls}
          onClearAll={clearAll}
          resultCount={filteredTables.length}
          totalCount={enrichedTables.length}
        />
      </div>

      <div style={{ maxWidth: "80%", marginLeft: "auto", marginRight: "auto", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: "0.5rem", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "38%" }} />
          </colgroup>
          <thead>
            <tr>
              <SortableHeader label={t("admin.tables.number")} sortKey="tableNumber" sort={sort} onToggle={toggleSort} style={{ padding: "0.5rem 0.75rem" }} />
              <SortableHeader label={t("admin.tables.size")} sortKey="sizeArea" sort={sort} onToggle={toggleSort} style={{ padding: "0.5rem 0.75rem" }} />
              <SortableHeader label={t("admin.tables.state")} sortKey="state" sort={sort} onToggle={toggleSort} style={{ padding: "0.5rem 0.75rem" }} />
              <th style={tableHeaderStyle}>{t("admin.tables.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTables.map((row) => {
              const stateColors = TABLE_STATE_COLORS[row.state];
              return (
                <tr key={row.id} style={tableRowStyle}>
                  <td style={tableCellStyle}>
                    <strong>#{row.tableNumber}</strong>
                    {row.registration && (
                      <span style={{ fontSize: "0.75rem", color: colors.warmBrown, marginLeft: "0.5rem" }}>
                        ({row.registration.name})
                      </span>
                    )}
                  </td>
                  <td style={tableCellStyle}>
                    {row.sizeLabel}
                  </td>
                  <td style={tableCellStyle}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.15rem 0.6rem",
                        borderRadius: 12,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        background: stateColors.background,
                        color: stateColors.text,
                        border: `1px solid ${stateColors.border}`,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: stateColors.border,
                        }}
                      />
                      {t(`map.state.${row.state}`)}
                    </span>
                  </td>
                  <td style={tableCellStyle}>
                    {renderActions(row)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
