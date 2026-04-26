"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TableState } from "@loppemarked/shared";
import { TABLE_CATALOG, formatAddress, formatTableLabel } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { formatDateTime } from "@/utils/formatDate";
import { colors, fonts, shadows, alertWarning } from "@/styles/theme";
import { useTableControls } from "@/hooks/useTableControls";
import { TableControls } from "./TableControls";
import { SortableHeader } from "./SortableHeader";
import { NotificationComposer, type NotificationValue } from "./NotificationComposer";

interface WaitlistEntry {
  id: string;
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

interface DuplicateExisting {
  id: string;
  tableId: number;
  name: string;
  email: string;
}

function formatTableOption(table: { id: number; number: number; sizeMeters: number }): string {
  return formatTableLabel(table.id, { includeDetails: true });
}

export function AdminWaitlist() {
  const { t, language } = useLanguage();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [assigningEntry, setAssigningEntry] = useState<WaitlistEntry | null>(null);
  const [assignTableId, setAssignTableId] = useState("");
  const [assignNotification, setAssignNotification] = useState<NotificationValue>({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
  const [assignDuplicateWarning, setAssignDuplicateWarning] = useState<DuplicateExisting[] | null>(null);
  const [assignNotifyDownstream, setAssignNotifyDownstream] = useState(false);
  const [removingEntry, setRemovingEntry] = useState<WaitlistEntry | null>(null);
  const [removeNotifyDownstream, setRemoveNotifyDownstream] = useState(false);

  const [tableStates, setTableStates] = useState<Map<number, TableState>>(new Map());

  const statusOptions = useMemo(() => {
    const statuses = [...new Set(entries.map((e) => e.status))];
    return [
      { label: t("admin.table.allStatuses"), value: "__all__" },
      ...statuses.map((s) => ({ label: s, value: s })),
    ];
  }, [entries, t]);

  // Mirrors the server's queue ordering rule: created_at asc, id asc as tiebreaker.
  const positionByEntryId = useMemo(() => {
    const map = new Map<string, number>();
    const waiting = entries
      .filter((e) => e.status === "waiting")
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        if (aTime !== bTime) return aTime - bTime;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    waiting.forEach((entry, index) => {
      map.set(entry.id, index + 1);
    });
    return map;
  }, [entries]);

  const {
    sort,
    toggleSort,
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearAll,
    hasActiveControls,
    processedData: filteredEntries,
  } = useTableControls({
    data: entries,
    defaultSort: { key: "created_at", direction: "asc" },
    searchableFields: ["name", "email", "apartment_key"],
    filterConfigs: [{ key: "status", allValue: "__all__", defaultValue: "waiting" }],
  });

  const fetchWaitlist = useCallback(async () => {
    try {
      const res = await fetch("/admin/waitlist", { credentials: "include" });
      if (res.ok) {
        setEntries(await res.json());
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
    fetchWaitlist();
  }, [fetchWaitlist]);

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

  function openAssignDialog(entry: WaitlistEntry) {
    setAssignTableId("");
    setAssignNotification({ sendEmail: true, subject: "", bodyHtml: "", valid: true });
    setAssignDuplicateWarning(null);
    setAssignNotifyDownstream(false);
    setMessage(null);
    setAssigningEntry(entry);
  }

  function closeAssignDialog() {
    setAssigningEntry(null);
  }

  function openRemoveDialog(entry: WaitlistEntry) {
    setRemoveNotifyDownstream(false);
    setMessage(null);
    setRemovingEntry(entry);
  }

  function closeRemoveDialog() {
    setRemovingEntry(null);
  }

  async function handleRemove() {
    if (!removingEntry) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/admin/waitlist/${encodeURIComponent(removingEntry.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notifyDownstream: removeNotifyDownstream }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("admin.waitlist.removed") });
        setRemovingEntry(null);
        await fetchWaitlist();
      } else {
        let errorText = t("common.error");
        try {
          const body = await res.json();
          if (body && typeof body.error === "string") {
            errorText = body.error;
          }
        } catch {
          // ignore JSON parse failure; fall back to default error text
        }
        setMessage({ type: "error", text: errorText });
      }
    } catch {
      setMessage({ type: "error", text: t("common.error") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(confirmDuplicate = false) {
    if (!assigningEntry) return;

    const tableId = Number(assignTableId);
    if (isNaN(tableId) || tableId < 1) {
      setMessage({ type: "error", text: t("common.error") });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/admin/waitlist/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          waitlistEntryId: assigningEntry.id,
          tableId,
          confirmDuplicate,
          notification: {
            sendEmail: assignNotification.sendEmail,
            subject: assignNotification.subject || undefined,
            bodyHtml: assignNotification.bodyHtml || undefined,
          },
          notifyDownstream: assignNotifyDownstream,
        }),
      });

      if (res.ok) {
        setAssignDuplicateWarning(null);
        setMessage({ type: "success", text: t("admin.waitlist.assigned") });
        setAssigningEntry(null);
        await Promise.all([fetchWaitlist(), fetchTableStates()]);
      } else {
        const body = await res.json();
        if (body.code === "DUPLICATE_ADDRESS_WARNING" || body.code === "APARTMENT_HAS_REGISTRATION") {
          setAssignDuplicateWarning(body.existingRegistrations ?? []);
        } else {
          setMessage({ type: "error", text: body.error ?? t("common.error") });
        }
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
      <h2 style={{ marginBottom: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>{t("admin.waitlist.title")}</h2>

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          style={{
            color: message.type === "error" ? colors.dustyRose : colors.sageDark,
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {message.text}
        </p>
      )}

      {/* Assign Dialog */}
      {assigningEntry && (
        <div
          role="dialog"
          aria-labelledby="assign-dialog-title"
          style={{
            border: `1px solid ${colors.borderTan}`,
            borderRadius: 8,
            padding: "1.25rem",
            marginBottom: "1.5rem",
            background: colors.white,
            boxShadow: shadows.card,
          }}
        >
          <h3 id="assign-dialog-title" style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.waitlist.confirmAssign")} – {assigningEntry.name}
          </h3>
          <p style={{ fontSize: "0.85rem", color: colors.warmBrown, margin: "0 0 0.75rem 0" }}>
            {assigningEntry.email} · {formatAddress(assigningEntry.street, assigningEntry.house_number, assigningEntry.floor, assigningEntry.door)}
          </p>

          <div style={{ marginBottom: "0.75rem" }}>
            <label
              htmlFor="assign-table-id"
              style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", color: colors.warmBrown, fontFamily: fonts.body }}
            >
              {t("admin.waitlist.assignTableId")}
            </label>
            <select
              id="assign-table-id"
              value={assignTableId}
              onChange={(e) => setAssignTableId(e.target.value)}
              style={{
                width: "100%",
                maxWidth: 300,
                padding: "0.4rem",
                border: `1px solid ${colors.borderTan}`,
                borderRadius: 4,
                fontSize: "0.85rem",
                fontFamily: fonts.body,
                color: colors.inkBrown,
                boxSizing: "border-box",
              }}
            >
              <option value="">{t("admin.waitlist.selectTable")}</option>
              {sortedTableOptions.map((table) => (
                <option key={table.id} value={String(table.id)} disabled={table.occupied}>
                  {formatTableOption(table)}{table.occupied ? " (occupied)" : ""}
                </option>
              ))}
            </select>
          </div>

          {assignTableId && Number(assignTableId) > 0 && (
            <NotificationComposer
              action="waitlist_assign"
              recipientName={assigningEntry.name}
              recipientEmail={assigningEntry.email}
              recipientLanguage={assigningEntry.language}
              tableId={Number(assignTableId)}
              value={assignNotification}
              onChange={setAssignNotification}
            />
          )}

          <label
            htmlFor="assign-notify-downstream"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              marginTop: "0.75rem",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: colors.warmBrown,
              fontFamily: fonts.body,
            }}
          >
            <input
              id="assign-notify-downstream"
              type="checkbox"
              checked={assignNotifyDownstream}
              onChange={(e) => setAssignNotifyDownstream(e.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            <span>
              <strong>{t("admin.waitlist.notifyDownstream")}</strong>
              <span style={{ display: "block", fontSize: "0.8rem", color: colors.inkBrown, marginTop: "0.15rem" }}>
                {t("admin.waitlist.notifyDownstreamHint")}
              </span>
            </span>
          </label>

          {assignDuplicateWarning !== null && (
            <div
              role="alert"
              style={{
                ...alertWarning,
                marginTop: "0.75rem",
              }}
            >
              <p style={{ margin: "0 0 0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
                {t("admin.waitlist.duplicateWarning")}
              </p>
              {assignDuplicateWarning.length > 0 && (
                <ul style={{ margin: "0 0 0.5rem", paddingLeft: "1.25rem", fontSize: "0.8rem" }}>
                  {assignDuplicateWarning.map((r) => (
                    <li key={r.id}>
                      {r.name} ({r.email}) — {formatTableLabel(r.tableId)}
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ margin: 0, fontSize: "0.8rem" }}>
                {t("admin.waitlist.duplicateConfirmHint")}
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            {assignDuplicateWarning !== null ? (
              <button
                type="button"
                onClick={() => handleAssign(true)}
                disabled={submitting || (assignNotification.sendEmail && !assignNotification.valid)}
                style={{
                  padding: "0.4rem 1rem",
                  border: "none",
                  borderRadius: 4,
                  background: colors.terracotta,
                  color: colors.white,
                  cursor: submitting ? "progress" : assignNotification.sendEmail && !assignNotification.valid ? "not-allowed" : "pointer",
                  fontSize: "0.85rem",
                  fontFamily: fonts.body,
                  fontWeight: 600,
                }}
              >
                {t("admin.waitlist.confirmDuplicate")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleAssign()}
                disabled={submitting || (assignNotification.sendEmail && !assignNotification.valid)}
                style={{
                  padding: "0.4rem 1rem",
                  border: "none",
                  borderRadius: 4,
                  background: colors.sage,
                  color: colors.white,
                  cursor: submitting ? "progress" : assignNotification.sendEmail && !assignNotification.valid ? "not-allowed" : "pointer",
                  fontSize: "0.85rem",
                  fontFamily: fonts.body,
                }}
              >
                {t("common.confirm")}
              </button>
            )}
            <button
              type="button"
              onClick={closeAssignDialog}
              disabled={submitting}
              style={{
                padding: "0.4rem 1rem",
                border: `1px solid ${colors.borderTan}`,
                borderRadius: 4,
                background: colors.white,
                color: colors.warmBrown,
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
      {removingEntry && (
        <div
          role="dialog"
          aria-labelledby="remove-dialog-title"
          style={{
            border: `1px solid ${colors.borderTan}`,
            borderRadius: 8,
            padding: "1.25rem",
            marginBottom: "1.5rem",
            background: colors.white,
            boxShadow: shadows.card,
          }}
        >
          <h3 id="remove-dialog-title" style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
            {t("admin.waitlist.confirmRemove")} – {removingEntry.name}
          </h3>
          <p style={{ fontSize: "0.85rem", color: colors.warmBrown, margin: "0 0 0.75rem 0" }}>
            {removingEntry.email} · {formatAddress(removingEntry.street, removingEntry.house_number, removingEntry.floor, removingEntry.door)}
          </p>
          <p style={{ fontSize: "0.85rem", color: colors.warmBrown, margin: "0 0 1rem 0" }}>
            {t("admin.waitlist.removeConfirmHint")}
          </p>
          <label
            htmlFor="remove-notify-downstream"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              marginBottom: "1rem",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: colors.warmBrown,
              fontFamily: fonts.body,
            }}
          >
            <input
              id="remove-notify-downstream"
              type="checkbox"
              checked={removeNotifyDownstream}
              onChange={(e) => setRemoveNotifyDownstream(e.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            <span>
              <strong>{t("admin.waitlist.notifyDownstream")}</strong>
              <span style={{ display: "block", fontSize: "0.8rem", color: colors.inkBrown, marginTop: "0.15rem" }}>
                {t("admin.waitlist.notifyDownstreamHint")}
              </span>
            </span>
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => handleRemove()}
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
                fontWeight: 600,
              }}
            >
              {t("admin.waitlist.remove")}
            </button>
            <button
              type="button"
              onClick={closeRemoveDialog}
              disabled={submitting}
              style={{
                padding: "0.4rem 1rem",
                border: `1px solid ${colors.borderTan}`,
                borderRadius: 4,
                background: colors.white,
                color: colors.warmBrown,
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

      {entries.length === 0 ? (
        <p style={{ color: colors.warmBrown, fontStyle: "italic" }}>
          {t("admin.waitlist.noEntries")}
        </p>
      ) : (
        <>
          <TableControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={[
              {
                key: "status",
                label: t("admin.waitlist.status"),
                options: statusOptions,
                value: filters["status"],
                onChange: (v) => setFilter("status", v),
              },
            ]}
            hasActiveControls={hasActiveControls}
            onClearAll={clearAll}
            resultCount={filteredEntries.length}
            totalCount={entries.length}
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
                <th
                  aria-label={t("admin.waitlist.queuePositionAria")}
                  style={{
                    padding: "0.5rem",
                    borderBottom: `2px solid ${colors.borderTan}`,
                    color: colors.warmBrown,
                    fontFamily: fonts.body,
                    width: "3rem",
                  }}
                >
                  {t("admin.waitlist.queuePosition")}
                </th>
                <SortableHeader label={t("admin.waitlist.name")} sortKey="name" sort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("admin.waitlist.email")} sortKey="email" sort={sort} onToggle={toggleSort} />
                <th style={{ padding: "0.5rem", borderBottom: `2px solid ${colors.borderTan}`, color: colors.warmBrown, fontFamily: fonts.body }}>{t("admin.waitlist.apartment")}</th>
                <SortableHeader label={t("admin.waitlist.status")} sortKey="status" sort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("admin.waitlist.date")} sortKey="created_at" sort={sort} onToggle={toggleSort} />
                <th style={{ padding: "0.5rem", borderBottom: `2px solid ${colors.borderTan}`, color: colors.warmBrown, fontFamily: fonts.body }}>{t("admin.waitlist.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const position = positionByEntryId.get(entry.id);
                return (
                  <tr key={entry.id} style={{ borderBottom: `1px solid ${colors.parchment}` }}>
                    <td
                      style={{
                        padding: "0.5rem",
                        fontVariantNumeric: "tabular-nums",
                        color: position !== undefined ? colors.warmBrown : colors.inkBrown,
                      }}
                      aria-label={position === undefined ? t("admin.waitlist.notInQueue") : undefined}
                    >
                      {position ?? "—"}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{entry.name}</td>
                    <td style={{ padding: "0.5rem" }}>{entry.email}</td>
                    <td style={{ padding: "0.5rem", fontSize: "0.8rem" }}>
                      {formatAddress(entry.street, entry.house_number, entry.floor, entry.door)}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.15rem 0.5rem",
                          borderRadius: 12,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: entry.status === "waiting" ? colors.warningBg : colors.parchment,
                          color: entry.status === "waiting" ? colors.mutedGold : colors.warmBrown,
                        }}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      {formatDateTime(entry.created_at, language)}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {entry.status === "waiting" && (
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => openAssignDialog(entry)}
                            disabled={assigningEntry !== null || removingEntry !== null}
                            style={{
                              padding: "0.25rem 0.75rem",
                              border: `1px solid ${colors.sage}`,
                              borderRadius: 4,
                              background: colors.white,
                              color: colors.sage,
                              cursor: assigningEntry !== null || removingEntry !== null ? "not-allowed" : "pointer",
                              fontSize: "0.8rem",
                              fontFamily: fonts.body,
                            }}
                          >
                            {t("admin.waitlist.assign")}
                          </button>
                          <button
                            type="button"
                            onClick={() => openRemoveDialog(entry)}
                            disabled={assigningEntry !== null || removingEntry !== null}
                            style={{
                              padding: "0.25rem 0.75rem",
                              border: `1px solid ${colors.dustyRose}`,
                              borderRadius: 4,
                              background: colors.white,
                              color: colors.dustyRose,
                              cursor: assigningEntry !== null || removingEntry !== null ? "not-allowed" : "pointer",
                              fontSize: "0.8rem",
                              fontFamily: fonts.body,
                            }}
                          >
                            {t("admin.waitlist.remove")}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
}
