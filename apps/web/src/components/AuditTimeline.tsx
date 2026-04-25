"use client";

import { AUDIT_ACTIONS } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { translations, type TranslationKey } from "@/i18n/translations";
import { colors, fonts } from "@/styles/theme";

interface AuditEvent {
  id: string;
  timestamp: string;
  actorType: "public" | "admin" | "system";
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
}

interface AuditTimelineProps {
  events: AuditEvent[];
  tableLabels: Record<string, string>;
  hasMore?: boolean;
  onLoadMore?: () => void;
  actionFilter?: string;
  actorTypeFilter?: string;
  onActionFilterChange?: (action: string) => void;
  onActorTypeFilterChange?: (actorType: string) => void;
}

const LOCALE_MAP: Record<string, string> = { da: "da-DK", en: "en-GB" };

function formatTimestamp(iso: string, lang: string): string {
  const d = new Date(iso);
  return d.toLocaleString(LOCALE_MAP[lang] ?? "da-DK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function truncateId(id: string, len = 8): string {
  return id.length > len ? `${id.slice(0, len)}...` : id;
}

function actionLabel(action: string, t: (key: TranslationKey) => string): string {
  const key = `audit.action.${action}`;
  if (key in translations.en) {
    return t(key as TranslationKey);
  }
  return action;
}

function formatSnapshot(data: Record<string, unknown> | null): string {
  if (!data) return "\u2014";
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");
}

export function resolveTableLabel(tableId: unknown, tableLabels: Record<string, string>): string | null {
  if (typeof tableId === "number" || typeof tableId === "string") {
    return tableLabels[String(tableId)] ?? null;
  }
  return null;
}

export function formatAddressFromSnapshot(data: Record<string, unknown>): string | null {
  const street = data.street ?? data.address_street;
  const houseNumber = data.house_number ?? data.address_house_number;
  if (typeof street !== "string" || (typeof houseNumber !== "number" && typeof houseNumber !== "string")) {
    return null;
  }
  let result = `${street} ${houseNumber}`;
  const floor = data.floor ?? data.address_floor;
  const door = data.door ?? data.address_door;
  const floorStr = typeof floor === "string" ? floor.trim() : null;
  const doorStr = typeof door === "string" ? door.trim() : null;
  if (floorStr) {
    result += ` ${floorStr}.`;
    if (doorStr) {
      result += ` ${doorStr}`;
    }
  }
  return result;
}

export function formatApartmentKeyAsAddress(key: unknown): string | null {
  if (typeof key !== "string") return null;
  const parts = key.split("/");
  const streetAndHouse = parts[0];
  if (!streetAndHouse) return null;
  let result = streetAndHouse
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  if (parts[1]) {
    const floorDoor = parts[1].split("-");
    result += ` ${floorDoor[0]}.`;
    if (floorDoor[1]) {
      result += ` ${floorDoor[1]}`;
    }
  }
  return result;
}

function getStr(data: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!data) return null;
  for (const key of keys) {
    const val = data[key];
    if (typeof val === "string" && val.trim()) return val;
  }
  return null;
}

export interface DetailLine {
  label: string;
  value: string;
}

export function formatEventDetails(
  evt: AuditEvent,
  tableLabels: Record<string, string>,
  t: (key: TranslationKey) => string,
): DetailLine[] {
  const lines: DetailLine[] = [];
  const after = evt.after;
  const before = evt.before;

  switch (evt.action) {
    case "waitlist_add": {
      const name = getStr(after, "name");
      if (name) lines.push({ label: t("audit.detail.name"), value: name });
      const email = getStr(after, "email");
      if (email) lines.push({ label: t("audit.detail.email"), value: email });
      const addr = (after && formatAddressFromSnapshot(after))
        ?? formatApartmentKeyAsAddress(after?.apartmentKey ?? after?.apartment_key);
      if (addr) lines.push({ label: t("audit.detail.address"), value: addr });
      break;
    }

    case "email_sent": {
      const recipient = getStr(after, "recipient", "recipient_email");
      if (recipient) lines.push({ label: t("audit.detail.recipient"), value: recipient });
      const subject = getStr(after, "subject");
      if (subject) lines.push({ label: t("audit.detail.subject"), value: subject });
      break;
    }

    case "notification_sent": {
      const recipient = getStr(after, "recipient_email", "recipient");
      const displayName = getStr(after, "recipient_name");
      if (displayName) {
        lines.push({ label: t("audit.detail.recipient"), value: displayName });
      } else if (recipient) {
        lines.push({ label: t("audit.detail.recipient"), value: recipient });
      }
      const subject = getStr(after, "subject");
      if (subject) lines.push({ label: t("audit.detail.subject"), value: subject });
      break;
    }

    case "table_state_change": {
      const tableLabel = resolveTableLabel(evt.entityId, tableLabels);
      if (tableLabel) lines.push({ label: t("audit.detail.table"), value: tableLabel });
      const stateBefore = getStr(before, "state");
      const stateAfter = getStr(after, "state");
      if (stateBefore && stateAfter) {
        lines.push({ label: t("audit.detail.stateChange"), value: `${stateBefore} \u2192 ${stateAfter}` });
      }
      break;
    }

    case "registration_create": {
      const tableId = after?.table_id;
      const tableLabel = resolveTableLabel(tableId, tableLabels);
      if (tableLabel) lines.push({ label: t("audit.detail.table"), value: tableLabel });
      const name = getStr(after, "name");
      if (name) lines.push({ label: t("audit.detail.name"), value: name });
      const addr = (after && formatAddressFromSnapshot(after))
        ?? formatApartmentKeyAsAddress(after?.apartmentKey ?? after?.apartment_key);
      if (addr) lines.push({ label: t("audit.detail.address"), value: addr });
      break;
    }

    case "registration_remove": {
      const tableId = before?.table_id;
      const tableLabel = resolveTableLabel(tableId, tableLabels);
      if (tableLabel) lines.push({ label: t("audit.detail.table"), value: tableLabel });
      const name = getStr(before, "name");
      if (name) lines.push({ label: t("audit.detail.name"), value: name });
      const addr = (before && formatAddressFromSnapshot(before))
        ?? formatApartmentKeyAsAddress(before?.apartmentKey ?? before?.apartment_key);
      if (addr) lines.push({ label: t("audit.detail.address"), value: addr });
      break;
    }

    case "registration_switch":
    case "registration_move": {
      const beforeBoxId = before?.table_id;
      const afterBoxId = after?.table_id;
      const fromLabel = resolveTableLabel(beforeBoxId, tableLabels);
      const toLabel = resolveTableLabel(afterBoxId, tableLabels);
      if (fromLabel && toLabel) {
        lines.push({ label: t("audit.detail.table"), value: `${fromLabel} \u2192 ${toLabel}` });
      } else if (toLabel) {
        lines.push({ label: t("audit.detail.table"), value: toLabel });
      }
      const name = getStr(before, "name") ?? getStr(after, "name");
      if (name) lines.push({ label: t("audit.detail.name"), value: name });
      break;
    }

    case "notification_skipped": {
      const recipient = getStr(after, "recipient_email", "recipient");
      const displayName = getStr(after, "recipient_name");
      if (displayName) {
        lines.push({ label: t("audit.detail.name"), value: displayName });
      } else if (recipient) {
        lines.push({ label: t("audit.detail.recipient"), value: recipient });
      }
      const action = getStr(after, "notification_action");
      if (action) {
        const actionKey = `audit.action.${action}`;
        const actionText = actionKey in translations.en
          ? t(actionKey as TranslationKey)
          : action;
        lines.push({ label: t("audit.detail.action"), value: actionText });
      }
      break;
    }

    default: {
      if (before) lines.push({ label: t("audit.detail.before"), value: formatSnapshot(before) });
      if (after) lines.push({ label: t("audit.detail.after"), value: formatSnapshot(after) });
      if (evt.reason) lines.push({ label: t("audit.detail.reason"), value: evt.reason });
      break;
    }
  }

  if (lines.length === 0 && evt.reason) {
    lines.push({ label: t("audit.detail.reason"), value: evt.reason });
  }

  return lines;
}

export function AuditTimeline({
  events,
  tableLabels,
  hasMore,
  onLoadMore,
  actionFilter,
  actorTypeFilter,
  onActionFilterChange,
  onActorTypeFilterChange,
}: AuditTimelineProps) {
  const { t, language } = useLanguage();

  return (
    <section style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1rem" }}>
      <h2 style={{ marginBottom: "1rem", fontFamily: fonts.heading, color: colors.warmBrown }}>{t("audit.title")}</h2>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem", fontFamily: fonts.body, color: colors.warmBrown }}>
          {t("audit.filterByAction")}
          <select
            value={actionFilter ?? ""}
            onChange={(e) => onActionFilterChange?.(e.target.value)}
            style={{ padding: "0.4rem", marginTop: "0.25rem", fontFamily: fonts.body, border: `1px solid ${colors.borderTan}`, borderRadius: 4 }}
          >
            <option value="">{t("audit.allActions")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`audit.action.${a}` as TranslationKey)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem", fontFamily: fonts.body, color: colors.warmBrown }}>
          {t("audit.filterByActor")}
          <select
            value={actorTypeFilter ?? ""}
            onChange={(e) => onActorTypeFilterChange?.(e.target.value)}
            style={{ padding: "0.4rem", marginTop: "0.25rem", fontFamily: fonts.body, border: `1px solid ${colors.borderTan}`, borderRadius: 4 }}
          >
            <option value="">{t("audit.allActors")}</option>
            <option value="admin">admin</option>
            <option value="public">public</option>
            <option value="system">system</option>
          </select>
        </label>
      </div>

      {events.length === 0 ? (
        <p style={{ color: colors.warmBrown, fontStyle: "italic" }}>{t("audit.noEvents")}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: `2px solid ${colors.borderTan}`, textAlign: "left" }}>
                <th style={{ padding: "0.5rem", color: colors.warmBrown, fontFamily: fonts.body }}>{t("audit.timestamp")}</th>
                <th style={{ padding: "0.5rem", color: colors.warmBrown, fontFamily: fonts.body }}>{t("audit.action")}</th>
                <th style={{ padding: "0.5rem", color: colors.warmBrown, fontFamily: fonts.body }}>{t("audit.actor")}</th>
                <th style={{ padding: "0.5rem", color: colors.warmBrown, fontFamily: fonts.body }}>{t("audit.details")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => {
                const details = formatEventDetails(evt, tableLabels, t);
                return (
                  <tr key={evt.id} style={{ borderBottom: `1px solid ${colors.parchment}` }}>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      {formatTimestamp(evt.timestamp, language)}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <code style={{ fontSize: "0.8rem", background: colors.parchment, color: colors.inkBrown, padding: "0.1rem 0.3rem", borderRadius: 3 }}>
                        {actionLabel(evt.action, t)}
                      </code>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {evt.actorType}
                      {evt.actorName
                        ? ` (${evt.actorName})`
                        : evt.actorId
                          ? ` (${truncateId(evt.actorId)})`
                          : ""}
                    </td>
                    <td style={{ padding: "0.5rem", fontSize: "0.8rem", color: colors.warmBrown }}>
                      {details.length > 0
                        ? details.map((d, i) => (
                            <div key={i}>
                              <strong>{d.label}:</strong> {d.value}
                            </div>
                          ))
                        : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && onLoadMore && (
        <button
          type="button"
          onClick={onLoadMore}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1.5rem",
            border: `1px solid ${colors.borderTan}`,
            borderRadius: 4,
            background: colors.white,
            cursor: "pointer",
            fontFamily: fonts.body,
          }}
        >
          {t("audit.loadMore")}
        </button>
      )}
    </section>
  );
}
