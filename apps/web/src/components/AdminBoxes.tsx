"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoxState } from "@loppemarked/shared";
import {
  ELIGIBLE_STREET,
  HOUSE_NUMBER_MIN,
  HOUSE_NUMBER_MAX,
  formatTableLabel,
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
import { BOX_STATE_COLORS } from "./boxStateColors";
import { NotificationComposer, type NotificationValue } from "./NotificationComposer";

interface BoxRegistration {
  id: string;
  name: string;
  email: string;
  language: string;
}

interface Box {
  id: number;
  state: BoxState;
  registration: BoxRegistration | null;
}

interface BoxRow extends Box {
  tableNumber: number;
  sizeMeters: number;
  tableLabel: string;
  _searchText: string;
}

type ActiveDialog =
  | { type: "reserve"; box: BoxRow }
  | { type: "release"; box: BoxRow }
  | { type: "removeRegistration"; box: BoxRow }
  | { type: "addRegistration"; box: BoxRow }
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

function enrichBox(b: Box): BoxRow {
  const table = getTableById(b.id);
  const tableNumber = table?.number ?? b.id;
  const sizeMeters = table?.sizeMeters ?? 0;
  const tableLabel = formatTableLabel(b.id);
  return {
    ...b,
    tableNumber,
    sizeMeters,
    tableLabel,
    _searchText: [
      tableLabel,
      String(tableNumber),
      b.registration?.name,
      b.registration?.email,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function AdminBoxes() {
  const { t } = useLanguage();
  const [boxes, setBoxes] = useState<Box[]>([]);
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

  const enrichedBoxes = useMemo<BoxRow[]>(() => boxes.map(enrichBox), [boxes]);

  const stateOptions = useMemo(() => {
    const states = [...new Set(enrichedBoxes.map((b) => b.state))];
    return [
      { label: t("admin.table.allStates"), value: "__all__" },
      ...states.map((s) => ({ label: t(`map.state.${s}`), value: s })),
    ];
  }, [enrichedBoxes, t]);

  const {
    sort,
    toggleSort,
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearAll,
    hasActiveControls,
    processedData: filteredBoxes,
  } = useTableControls({
    data: enrichedBoxes,
    defaultSort: { key: "tableNumber", direction: "asc" },
    searchableFields: ["tableLabel", "_searchText"],
    filterConfigs: [{ key: "state", allValue: "__all__" }],
  });

  const fetchBoxes = useCallback(async () => {
    try {
      const res = await fetch("/admin/boxes", { credentials: "include" });
      if (res.ok) {
        setBoxes(await res.json());
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
    fetchBoxes();
  }, [fetchBoxes]);

  function closeDialog() {
    setActiveDialog(null);
  }

  function openReserveDialog(box: BoxRow) {
    setMessage(null);
    setActiveDialog({ type: "reserve", box });
  }

  function openReleaseDialog(box: BoxRow) {
    setMessage(null);
    setActiveDialog({ type: "release", box });
  }

  function openRemoveRegistrationDialog(box: BoxRow) {
    setRemoveMakePublic(true);
    setRemoveNotification({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
    setMessage(null);
    setActiveDialog({ type: "removeRegistration", box });
  }

  function openAddRegistrationDialog(box: BoxRow) {
    setAddName("");
    setAddEmail("");
    setAddHouseNumber("");
    setAddFloor("");
    setAddDoor("");
    setAddLanguage("en");
    setAddNotification({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
    setAddErrors([]);
    setMessage(null);
    setActiveDialog({ type: "addRegistration", box });
  }

  async function handleReserve() {
    if (!activeDialog || activeDialog.type !== "reserve") return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/admin/boxes/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ boxId: activeDialog.box.id }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: t("admin.tables.reserved") });
        setActiveDialog(null);
        await fetchBoxes();
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
      const res = await fetch("/admin/boxes/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ boxId: activeDialog.box.id }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: t("admin.tables.released") });
        setActiveDialog(null);
        await fetchBoxes();
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
    const reg = activeDialog.box.registration;
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
          makeBoxPublic: removeMakePublic,
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
        await fetchBoxes();
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
      boxId: activeDialog.box.id,
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
          boxId: input.boxId,
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
        await fetchBoxes();
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

  const available = enrichedBoxes.filter((b) => b.state === "available").length;
  const occupied = enrichedBoxes.filter((b) => b.state === "occupied").length;
  const reserved = enrichedBoxes.filter((b) => b.state === "reserved").length;

  function renderActions(box: BoxRow) {
    const disabled = activeDialog !== null;
    const disabledCursor = disabled ? "not-allowed" : undefined;

    if (box.state === "available") {
      return (
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            onClick={() => openReserveDialog(box)}
            disabled={disabled}
            style={{ ...buttonSecondary, padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: disabledCursor }}
          >
            {t("admin.tables.reserve")}
          </button>
          <button
            type="button"
            onClick={() => openAddRegistrationDialog(box)}
            disabled={disabled}
            style={{ ...buttonPrimary, padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: disabledCursor }}
          >
            {t("admin.tables.addRegistration")}
          </button>
        </div>
      );
    }

    if (box.state === "reserved") {
      return (
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            onClick={() => openReleaseDialog(box)}
            disabled={disabled}
            style={{ ...buttonSecondary, padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: disabledCursor }}
          >
            {t("admin.tables.release")}
          </button>
          <button
            type="button"
            onClick={() => openAddRegistrationDialog(box)}
            disabled={disabled}
            style={{ ...buttonPrimary, padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: disabledCursor }}
          >
            {t("admin.tables.addRegistration")}
          </button>
        </div>
      );
    }

    if (box.state === "occupied") {
      return (
        <button
          type="button"
          onClick={() => openRemoveRegistrationDialog(box)}
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
        <strong>{enrichedBoxes.length}</strong> {t("admin.tables.number")}s ·{" "}
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
            {t("admin.tables.confirmReserve")} – {activeDialog.box.tableLabel}
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={handleReserve} disabled={submitting} style={{ ...buttonTerracotta, cursor: submitting ? "not-allowed" : "pointer" }}>
              {t("common.confirm")}
            </button>
            <button type="button" onClick={closeDialog} disabled={submitting} style={{ ...buttonSecondary, cursor: submitting ? "not-allowed" : "pointer" }}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Release Dialog */}
      {activeDialog?.type === "release" && (
        <div role="dialog" aria-labelledby="release-dialog-title" style={{ ...dialogStyle, marginBottom: "1.5rem", maxWidth: "80%", marginLeft: "auto", marginRight: "auto" }}>
          <h3 id="release-dialog-title" style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.tables.confirmRelease")} – {activeDialog.box.tableLabel}
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={handleRelease} disabled={submitting} style={{ ...buttonPrimary, cursor: submitting ? "not-allowed" : "pointer" }}>
              {t("common.confirm")}
            </button>
            <button type="button" onClick={closeDialog} disabled={submitting} style={{ ...buttonSecondary, cursor: submitting ? "not-allowed" : "pointer" }}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Remove Registration Dialog */}
      {activeDialog?.type === "removeRegistration" && activeDialog.box.registration && (
        <div ref={dialogRef} role="dialog" aria-labelledby="remove-reg-dialog-title" style={{ ...dialogStyle, marginBottom: "1.5rem", maxWidth: "80%", marginLeft: "auto", marginRight: "auto" }}>
          <h3 id="remove-reg-dialog-title" style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.tables.confirmRemoveRegistration")} – {activeDialog.box.tableLabel}
          </h3>
          <p style={{ fontSize: "0.85rem", color: colors.inkBrown, margin: "0 0 0.75rem" }}>
            {t("admin.tables.occupiedBy")}: {activeDialog.box.registration.name} ({activeDialog.box.registration.email})
          </p>

          <fieldset style={{ border: "none", padding: 0, margin: "0 0 0.75rem 0" }}>
            <legend style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: colors.warmBrown }}>
              {t("admin.tables.releaseType")}
            </legend>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", cursor: "pointer" }}>
              <input type="radio" name="box-release-type" checked={removeMakePublic} onChange={() => setRemoveMakePublic(true)} />
              <span style={{ fontSize: "0.85rem" }}>{t("admin.tables.releasePublic")}</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="radio" name="box-release-type" checked={!removeMakePublic} onChange={() => setRemoveMakePublic(false)} />
              <span style={{ fontSize: "0.85rem" }}>{t("admin.tables.releaseReserved")}</span>
            </label>
          </fieldset>

          <NotificationComposer
            action="remove"
            recipientName={activeDialog.box.registration.name}
            recipientEmail={activeDialog.box.registration.email}
            recipientLanguage={activeDialog.box.registration.language}
            boxId={activeDialog.box.id}
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
                cursor: submitting || (removeNotification.sendEmail && !removeNotification.valid) ? "not-allowed" : "pointer",
              }}
            >
              {t("common.confirm")}
            </button>
            <button type="button" onClick={closeDialog} disabled={submitting} style={{ ...buttonSecondary, cursor: submitting ? "not-allowed" : "pointer" }}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Add Registration Dialog */}
      {activeDialog?.type === "addRegistration" && (
        <div ref={dialogRef} role="dialog" aria-labelledby="add-reg-dialog-title" style={{ ...dialogStyle, marginBottom: "1.5rem", maxWidth: "80%", marginLeft: "auto", marginRight: "auto" }}>
          <h3 id="add-reg-dialog-title" style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.tables.addRegistration")} – {activeDialog.box.tableLabel}
          </h3>
          <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: colors.warmBrown }}>
            <strong>{t("admin.tables.size")}:</strong> {activeDialog.box.sizeMeters} {t("admin.tables.meters")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label htmlFor="box-add-name" style={labelStyle}>{t("admin.registrations.addName")} *</label>
              <input id="box-add-name" type="text" value={addName} onChange={(e) => setAddName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="box-add-email" style={labelStyle}>{t("admin.registrations.addEmail")} *</label>
              <input id="box-add-email" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="box-add-street" style={labelStyle}>{t("admin.registrations.addStreet")}</label>
              <input id="box-add-street" type="text" value={ELIGIBLE_STREET} disabled style={{ ...inputStyle, background: colors.parchment, color: colors.warmBrown }} />
            </div>
            <div>
              <label htmlFor="box-add-house-number" style={labelStyle}>{t("admin.registrations.addHouseNumber")} *</label>
              <input
                id="box-add-house-number"
                type="number"
                min={HOUSE_NUMBER_MIN}
                max={HOUSE_NUMBER_MAX}
                value={addHouseNumber}
                onChange={(e) => { setAddHouseNumber(e.target.value); setAddFloor(""); setAddDoor(""); }}
                style={inputStyle}
              />
            </div>
            {addNeedsUnitFields && (
              <>
                <div>
                  <label htmlFor="box-add-floor" style={labelStyle}>{t("admin.registrations.addFloor")} *</label>
                  <input id="box-add-floor" type="text" value={addFloor} onChange={(e) => setAddFloor(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="box-add-door" style={labelStyle}>{t("admin.registrations.addDoor")}</label>
                  <input id="box-add-door" type="text" value={addDoor} onChange={(e) => setAddDoor(e.target.value)} style={inputStyle} />
                </div>
              </>
            )}
            <div>
              <label htmlFor="box-add-language" style={labelStyle}>{t("admin.registrations.addLanguage")} *</label>
              <select id="box-add-language" value={addLanguage} onChange={(e) => setAddLanguage(e.target.value as "da" | "en")} style={inputStyle}>
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
              boxId={activeDialog.box.id}
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
                cursor: submitting || (addNotification.sendEmail && !addNotification.valid) ? "not-allowed" : "pointer",
              }}
            >
              {t("common.confirm")}
            </button>
            <button type="button" onClick={closeDialog} disabled={submitting} style={{ ...buttonSecondary, cursor: submitting ? "not-allowed" : "pointer" }}>
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
          resultCount={filteredBoxes.length}
          totalCount={enrichedBoxes.length}
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
              <SortableHeader label={t("admin.tables.size")} sortKey="sizeMeters" sort={sort} onToggle={toggleSort} style={{ padding: "0.5rem 0.75rem" }} />
              <SortableHeader label={t("admin.tables.state")} sortKey="state" sort={sort} onToggle={toggleSort} style={{ padding: "0.5rem 0.75rem" }} />
              <th style={tableHeaderStyle}>{t("admin.tables.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredBoxes.map((box) => {
              const boxColors = BOX_STATE_COLORS[box.state];
              return (
                <tr key={box.id} style={tableRowStyle}>
                  <td style={tableCellStyle}>
                    <strong>#{box.tableNumber}</strong>
                    {box.registration && (
                      <span style={{ fontSize: "0.75rem", color: colors.warmBrown, marginLeft: "0.5rem" }}>
                        ({box.registration.name})
                      </span>
                    )}
                  </td>
                  <td style={tableCellStyle}>
                    {box.sizeMeters} {t("admin.tables.meters")}
                  </td>
                  <td style={tableCellStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.15rem 0.5rem",
                        borderRadius: 12,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: boxColors.background,
                        color: boxColors.text,
                        border: `1px solid ${boxColors.border}`,
                      }}
                    >
                      {t(`map.state.${box.state}`)}
                    </span>
                  </td>
                  <td style={tableCellStyle}>
                    {renderActions(box)}
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
