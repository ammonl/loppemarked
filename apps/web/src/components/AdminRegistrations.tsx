"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TableState } from "@loppemarked/shared";
import {
  ELIGIBLE_STREET,
  TABLE_CATALOG,
  formatTableLabel,
  getTableById,
  isFloorDoorRequired,
  validateRegistrationInput,
  formatAddress,
} from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { formatDate } from "@/utils/formatDate";
import { colors, fonts, shadows, alertError } from "@/styles/theme";
import { useTableControls } from "@/hooks/useTableControls";
import { TableControls } from "./TableControls";
import { SortableHeader } from "./SortableHeader";
import { NotificationComposer } from "./NotificationComposer";

interface Registration {
  id: string;
  table_id: number;
  name: string;
  email: string;
  street: string;
  house_number: number;
  floor: string | null;
  door: string | null;
  apartment_key: string;
  language: string;
  status: string;
  created_at: string;
}

type ActiveDialog =
  | { type: "add" }
  | { type: "move"; registration: Registration }
  | { type: "remove"; registration: Registration }
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

const requiredLabelStyle: React.CSSProperties = {
  ...labelStyle,
  color: colors.warmBrown,
};

function formatTableOption(table: { id: number; number: number; sizeMeters: number }): string {
  return `${formatTableLabel(table.id, { includeDetails: true })}`;
}

const dialogStyle: React.CSSProperties = {
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 8,
  padding: "1.25rem",
  marginBottom: "1.5rem",
  background: colors.white,
  boxShadow: shadows.card,
};

export function AdminRegistrations() {
  const { t, language } = useLanguage();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);

  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addHouseNumber, setAddHouseNumber] = useState("");
  const [addFloor, setAddFloor] = useState("");
  const [addDoor, setAddDoor] = useState("");
  const [addTableId, setAddTableId] = useState("");
  const [addLanguage, setAddLanguage] = useState<"da" | "en">("en");
  const [addNotification, setAddNotification] = useState({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
  const [addErrors, setAddErrors] = useState<string[]>([]);
  const [moveNewTableId, setMoveNewTableId] = useState("");
  const [moveNotification, setMoveNotification] = useState({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
  const [removeMakePublic, setRemoveMakePublic] = useState(true);
  const [removeNotification, setRemoveNotification] = useState({ sendEmail: true, subject: "", bodyHtml: "", valid: true });

  const [tableStates, setTableStates] = useState<Map<number, TableState>>(new Map());

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeDialog && dialogRef.current) {
      dialogRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeDialog]);

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await fetch("/admin/registrations", { credentials: "include" });
      if (res.ok) {
        setRegistrations(await res.json());
      } else {
        setMessage({ type: "error", text: t("common.error") });
      }
    } catch {
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const fetchTableStates = useCallback(async () => {
    try {
      const res = await fetch("/admin/tables", { credentials: "include" });
      if (res.ok) {
        const rows: { id: number; state: TableState }[] = await res.json();
        setTableStates(new Map(rows.map((r) => [r.id, r.state])));
      }
    } catch {
      // Table states are a UI enhancement; failures are non-critical.
    }
  }, []);

  useEffect(() => {
    fetchTableStates();
  }, [fetchTableStates]);

  const sortedTableOptions = useMemo(() => {
    return [...TABLE_CATALOG]
      .map((table) => ({
        ...table,
        occupied: tableStates.get(table.id) === "occupied",
      }))
      .sort((a, b) => {
        if (a.occupied !== b.occupied) return a.occupied ? 1 : -1;
        return a.number - b.number;
      });
  }, [tableStates]);

  function openAddDialog() {
    setAddName("");
    setAddEmail("");
    setAddHouseNumber("");
    setAddFloor("");
    setAddDoor("");
    setAddTableId("");
    setAddLanguage("en");
    setAddNotification({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
    setAddErrors([]);
    setMessage(null);
    setActiveDialog({ type: "add" });
  }

  function openMoveDialog(reg: Registration) {
    setMoveNewTableId("");
    setMoveNotification({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
    setMessage(null);
    setActiveDialog({ type: "move", registration: reg });
  }

  function openRemoveDialog(reg: Registration) {
    setRemoveMakePublic(true);
    setRemoveNotification({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
    setMessage(null);
    setActiveDialog({ type: "remove", registration: reg });
  }

  function closeDialog() {
    setActiveDialog(null);
  }

  const enrichedRegistrations = useMemo(
    () =>
      registrations.map((r) => {
        const table = getTableById(r.table_id);
        return {
          ...r,
          table_number: table?.number ?? r.table_id,
          table_size: table?.sizeMeters ?? 0,
        };
      }),
    [registrations],
  );

  const statusOptions = useMemo(() => {
    const statuses = [...new Set(registrations.map((r) => r.status))];
    return [
      { label: t("admin.table.allStatuses"), value: "__all__" },
      ...statuses.map((s) => ({ label: s, value: s })),
    ];
  }, [registrations, t]);

  const {
    sort,
    toggleSort,
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearAll,
    hasActiveControls,
    processedData: filteredRegistrations,
  } = useTableControls({
    data: enrichedRegistrations,
    defaultSort: { key: "created_at", direction: "desc" },
    searchableFields: ["name", "email", "apartment_key"],
    filterConfigs: [{ key: "status", allValue: "__all__", defaultValue: "active" }],
  });

  const parsedAddHouseNumber = parseInt(addHouseNumber, 10);
  const addNeedsUnitFields = !isNaN(parsedAddHouseNumber) && isFloorDoorRequired(parsedAddHouseNumber);

  async function handleAdd() {
    setAddErrors([]);

    const input = {
      name: addName.trim(),
      email: addEmail.trim(),
      street: ELIGIBLE_STREET,
      houseNumber: parsedAddHouseNumber,
      floor: addFloor.trim() || null,
      door: addDoor.trim() || null,
      language: addLanguage,
      tableId: Number(addTableId),
    };

    const validation = validateRegistrationInput(input);
    if (!validation.valid) {
      const fieldErrors: string[] = [];
      if (validation.errors["name"]) fieldErrors.push(t("validation.nameRequired"));
      if (validation.errors["email"]) {
        const isRequired = validation.errors["email"].toLowerCase().includes("required");
        fieldErrors.push(t(isRequired ? "validation.emailRequired" : "validation.emailInvalid"));
      }
      if (validation.errors["houseNumber"]) fieldErrors.push(t("validation.houseNumberInvalid"));
      if (validation.errors["floorDoor"]) fieldErrors.push(t("validation.floorDoorRequired"));
      if (validation.errors["tableId"]) fieldErrors.push(t("validation.tableIdInvalid"));
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
        setMessage({ type: "success", text: t("admin.registrations.added") });
        setActiveDialog(null);
        await Promise.all([fetchRegistrations(), fetchTableStates()]);
      } else {
        const body = await res.json();
        setMessage({ type: "error", text: body.error ?? t("common.error") });
      }
    } catch {
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMove() {
    if (!activeDialog || activeDialog.type !== "move") return;
    const newBoxId = Number(moveNewTableId);
    if (isNaN(newBoxId) || newBoxId < 1) {
      setMessage({ type: "error", text: t("common.error") });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/admin/registrations/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          registrationId: activeDialog.registration.id,
          newBoxId,
          notification: {
            sendEmail: moveNotification.sendEmail,
            subject: moveNotification.subject || undefined,
            bodyHtml: moveNotification.bodyHtml || undefined,
          },
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("admin.registrations.moved") });
        setActiveDialog(null);
        await Promise.all([fetchRegistrations(), fetchTableStates()]);
      } else {
        const body = await res.json();
        setMessage({ type: "error", text: body.error ?? t("common.error") });
      }
    } catch {
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!activeDialog || activeDialog.type !== "remove") return;

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/admin/registrations/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          registrationId: activeDialog.registration.id,
          makeTablePublic: removeMakePublic,
          notification: {
            sendEmail: removeNotification.sendEmail,
            subject: removeNotification.subject || undefined,
            bodyHtml: removeNotification.bodyHtml || undefined,
          },
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("admin.registrations.removed") });
        setActiveDialog(null);
        await Promise.all([fetchRegistrations(), fetchTableStates()]);
      } else {
        const body = await res.json();
        setMessage({ type: "error", text: body.error ?? t("common.error") });
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

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontFamily: fonts.heading, color: colors.warmBrown }}>{t("admin.registrations.title")}</h2>
        <button
          type="button"
          onClick={openAddDialog}
          disabled={activeDialog !== null}
          style={{
            padding: "0.4rem 1rem",
            border: `1px solid ${colors.sage}`,
            borderRadius: 4,
            background: colors.sage,
            color: colors.white,
            cursor: activeDialog !== null ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
            fontFamily: fonts.body,
          }}
        >
          {t("admin.registrations.add")}
        </button>
      </div>

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          style={{
            color: message.type === "error" ? colors.dustyRose : colors.sage,
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {message.text}
        </p>
      )}

      {/* Add Dialog */}
      {activeDialog?.type === "add" && (
        <div role="dialog" aria-labelledby="add-dialog-title" style={dialogStyle}>
          <h3 id="add-dialog-title" style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>{t("admin.registrations.add")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label htmlFor="add-name" style={requiredLabelStyle}>{t("admin.registrations.addName")} *</label>
              <input id="add-name" type="text" value={addName} onChange={(e) => setAddName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="add-email" style={requiredLabelStyle}>{t("admin.registrations.addEmail")} *</label>
              <input id="add-email" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="add-street" style={labelStyle}>{t("admin.registrations.addStreet")}</label>
              <input id="add-street" type="text" value={ELIGIBLE_STREET} disabled style={{ ...inputStyle, background: colors.parchmentDark, color: colors.warmBrown }} />
            </div>
            <div>
              <label htmlFor="add-house-number" style={requiredLabelStyle}>{t("admin.registrations.addHouseNumber")} *</label>
              <input
                id="add-house-number"
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
                  <label htmlFor="add-floor" style={requiredLabelStyle}>{t("admin.registrations.addFloor")} *</label>
                  <input id="add-floor" type="text" value={addFloor} onChange={(e) => setAddFloor(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="add-door" style={labelStyle}>{t("admin.registrations.addDoor")}</label>
                  <input id="add-door" type="text" value={addDoor} onChange={(e) => setAddDoor(e.target.value)} style={inputStyle} />
                </div>
              </>
            )}
            <div>
              <label htmlFor="add-table-id" style={requiredLabelStyle}>{t("admin.registrations.addTableId")} *</label>
              <select id="add-table-id" value={addTableId} onChange={(e) => setAddTableId(e.target.value)} style={inputStyle}>
                <option value="">{t("admin.registrations.selectTable")}</option>
                {sortedTableOptions.map((table) => (
                  <option key={table.id} value={String(table.id)} disabled={table.occupied}>
                    {formatTableOption(table)}{table.occupied ? " (occupied)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="add-language" style={requiredLabelStyle}>{t("admin.registrations.addLanguage")} *</label>
              <select id="add-language" value={addLanguage} onChange={(e) => setAddLanguage(e.target.value as "da" | "en")} style={inputStyle}>
                <option value="da">Dansk</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {addNeedsUnitFields && (
            <p style={{ fontSize: "0.8rem", color: colors.warmBrown, margin: "0.5rem 0 0" }}>
              {t("address.floorDoorHint")}
            </p>
          )}

          {addErrors.length > 0 && (
            <div
              role="alert"
              style={{
                ...alertError,
                marginTop: "0.75rem",
              }}
            >
              {addErrors.map((err) => (
                <p key={err} style={{ margin: "0.25rem 0" }}>{err}</p>
              ))}
            </div>
          )}

          {addName && addEmail && addTableId && Number(addTableId) > 0 && (
            <NotificationComposer
              action="add"
              recipientName={addName}
              recipientEmail={addEmail}
              recipientLanguage={addLanguage}
              tableId={Number(addTableId)}
              value={addNotification}
              onChange={setAddNotification}
            />
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={handleAdd}
              disabled={submitting}
              style={{
                padding: "0.4rem 1rem",
                border: "none",
                borderRadius: 4,
                background: colors.sage,
                color: colors.white,
                cursor: submitting ? "progress" : "pointer",
                fontSize: "0.85rem",
                fontFamily: fonts.body,
              }}
            >
              {t("common.confirm")}
            </button>
            <button
              type="button"
              onClick={closeDialog}
              disabled={submitting}
              style={{
                padding: "0.4rem 1rem",
                border: `1px solid ${colors.borderTan}`,
                borderRadius: 4,
                background: colors.white,
                cursor: submitting ? "progress" : "pointer",
                fontSize: "0.85rem",
                fontFamily: fonts.body,
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Move Dialog */}
      {activeDialog?.type === "move" && (
        <div ref={dialogRef} role="dialog" aria-labelledby="move-dialog-title" style={dialogStyle}>
          <h3 id="move-dialog-title" style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.registrations.move")} – {activeDialog.registration.name}
          </h3>
          <div style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="move-new-table-id" style={labelStyle}>{t("admin.registrations.newTableId")}</label>
            <select
              id="move-new-table-id"
              value={moveNewTableId}
              onChange={(e) => setMoveNewTableId(e.target.value)}
              style={{ ...inputStyle, maxWidth: 300 }}
            >
              <option value="">{t("admin.registrations.selectTable")}</option>
              {sortedTableOptions.map((table) => {
                const isCurrentTable = activeDialog.type === "move" && table.id === activeDialog.registration.table_id;
                const isOccupied = table.occupied && !isCurrentTable;
                return (
                  <option key={table.id} value={String(table.id)} disabled={isOccupied}>
                    {formatTableOption(table)}{isOccupied ? " (occupied)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {moveNewTableId && Number(moveNewTableId) > 0 && (
            <NotificationComposer
              action="move"
              recipientName={activeDialog.registration.name}
              recipientEmail={activeDialog.registration.email}
              recipientLanguage={activeDialog.registration.language}
              tableId={Number(moveNewTableId)}
              oldTableId={activeDialog.registration.table_id}
              value={moveNotification}
              onChange={setMoveNotification}
            />
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={handleMove}
              disabled={submitting}
              style={{
                padding: "0.4rem 1rem",
                border: "none",
                borderRadius: 4,
                background: colors.sage,
                color: colors.white,
                cursor: submitting ? "progress" : "pointer",
                fontSize: "0.85rem",
                fontFamily: fonts.body,
              }}
            >
              {t("common.confirm")}
            </button>
            <button
              type="button"
              onClick={closeDialog}
              disabled={submitting}
              style={{
                padding: "0.4rem 1rem",
                border: `1px solid ${colors.borderTan}`,
                borderRadius: 4,
                background: colors.white,
                cursor: submitting ? "progress" : "pointer",
                fontSize: "0.85rem",
                fontFamily: fonts.body,
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Remove Dialog */}
      {activeDialog?.type === "remove" && (
        <div ref={dialogRef} role="dialog" aria-labelledby="remove-dialog-title" style={dialogStyle}>
          <h3 id="remove-dialog-title" style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.registrations.confirmRemove")} – {activeDialog.registration.name}
          </h3>

          <fieldset style={{ border: "none", padding: 0, margin: "0 0 0.75rem 0" }}>
            <legend style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              {t("admin.registrations.releaseType")}
            </legend>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="release-type"
                checked={removeMakePublic}
                onChange={() => setRemoveMakePublic(true)}
              />
              <span style={{ fontSize: "0.85rem" }}>{t("admin.registrations.releasePublic")}</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="release-type"
                checked={!removeMakePublic}
                onChange={() => setRemoveMakePublic(false)}
              />
              <span style={{ fontSize: "0.85rem" }}>{t("admin.registrations.releaseReserved")}</span>
            </label>
          </fieldset>

          <NotificationComposer
            action="remove"
            recipientName={activeDialog.registration.name}
            recipientEmail={activeDialog.registration.email}
            recipientLanguage={activeDialog.registration.language}
            tableId={activeDialog.registration.table_id}
            value={removeNotification}
            onChange={setRemoveNotification}
          />

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={handleRemove}
              disabled={submitting}
              style={{
                padding: "0.4rem 1rem",
                border: "none",
                borderRadius: 4,
                background: colors.dustyRose,
                color: colors.white,
                cursor: submitting ? "progress" : "pointer",
                fontSize: "0.85rem",
                fontFamily: fonts.body,
              }}
            >
              {t("common.confirm")}
            </button>
            <button
              type="button"
              onClick={closeDialog}
              disabled={submitting}
              style={{
                padding: "0.4rem 1rem",
                border: `1px solid ${colors.borderTan}`,
                borderRadius: 4,
                background: colors.white,
                cursor: submitting ? "progress" : "pointer",
                fontSize: "0.85rem",
                fontFamily: fonts.body,
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {registrations.length === 0 ? (
        <p style={{ color: colors.warmBrown, fontStyle: "italic" }}>
          {t("admin.registrations.noRegistrations")}
        </p>
      ) : (
        <>
          <TableControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={[
              {
                key: "status",
                label: t("admin.registrations.status"),
                options: statusOptions,
                value: filters["status"],
                onChange: (v) => setFilter("status", v),
              },
            ]}
            hasActiveControls={hasActiveControls}
            onClearAll={clearAll}
            resultCount={filteredRegistrations.length}
            totalCount={registrations.length}
          />
          <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ textAlign: "left" }}>
                <SortableHeader label={t("admin.registrations.name")} sortKey="name" sort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("admin.registrations.email")} sortKey="email" sort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("admin.registrations.table")} sortKey="table_number" sort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("admin.registrations.tableSize")} sortKey="table_size" sort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("admin.registrations.apartment")} sortKey="apartment_key" sort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("admin.registrations.status")} sortKey="status" sort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("admin.registrations.date")} sortKey="created_at" sort={sort} onToggle={toggleSort} />
                <th style={{ padding: "0.5rem", borderBottom: `2px solid ${colors.borderTan}` }}>{t("admin.registrations.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegistrations.map((reg) => (
                <tr key={reg.id} style={{ borderBottom: `1px solid ${colors.parchment}` }}>
                  <td style={{ padding: "0.5rem" }}>{reg.name}</td>
                  <td style={{ padding: "0.5rem" }}>{reg.email}</td>
                  <td style={{ padding: "0.5rem" }}>#{reg.table_number}</td>
                  <td style={{ padding: "0.5rem" }}>{reg.table_size} m</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.8rem" }}>{formatAddress(reg.street, reg.house_number, reg.floor, reg.door)}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.15rem 0.5rem",
                        borderRadius: 12,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: reg.status === "active" ? colors.lightSage : colors.parchment,
                        color: reg.status === "active" ? colors.sage : colors.warmBrown,
                      }}
                    >
                      {reg.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                    {formatDate(reg.created_at, language)}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {reg.status === "active" && (
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button
                          type="button"
                          onClick={() => openMoveDialog(reg)}
                          disabled={activeDialog !== null}
                          style={{
                            padding: "0.25rem 0.75rem",
                            border: `1px solid ${colors.sage}`,
                            borderRadius: 4,
                            background: colors.white,
                            color: colors.sage,
                            cursor: activeDialog !== null ? "not-allowed" : "pointer",
                            fontSize: "0.8rem",
                            fontFamily: fonts.body,
                          }}
                        >
                          {t("admin.registrations.move")}
                        </button>
                        <button
                          type="button"
                          onClick={() => openRemoveDialog(reg)}
                          disabled={activeDialog !== null}
                          style={{
                            padding: "0.25rem 0.75rem",
                            border: `1px solid ${colors.dustyRose}`,
                            borderRadius: 4,
                            background: colors.white,
                            color: colors.dustyRose,
                            cursor: activeDialog !== null ? "not-allowed" : "pointer",
                            fontSize: "0.8rem",
                            fontFamily: fonts.body,
                          }}
                        >
                          {t("admin.registrations.remove")}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
}
