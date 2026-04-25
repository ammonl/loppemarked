"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors } from "@/styles/theme";
import { AuditTimeline } from "./AuditTimeline";

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

interface AuditResponse {
  events: AuditEvent[];
  tableLabels: Record<string, string>;
  nextCursor: string | null;
  hasMore: boolean;
}

export function AdminAuditLog() {
  const { t } = useLanguage();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [tableLabels, setBoxLabels] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState("");

  const fetchEvents = useCallback(
    async (append: boolean, nextCursor?: string | null) => {
      try {
        const body: Record<string, unknown> = { limit: 50 };
        if (actionFilter) body.action = actionFilter;
        if (actorTypeFilter) body.actorType = actorTypeFilter;
        if (append && nextCursor) body.cursor = nextCursor;

        const res = await fetch("/admin/audit-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data: AuditResponse = await res.json();
          if (append) {
            setEvents((prev) => [...prev, ...data.events]);
            setBoxLabels((prev) => ({ ...prev, ...data.tableLabels }));
          } else {
            setEvents(data.events);
            setBoxLabels(data.tableLabels);
          }
          setCursor(data.nextCursor);
          setHasMore(data.hasMore);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [actionFilter, actorTypeFilter],
  );

  useEffect(() => {
    setLoading(true);
    fetchEvents(false);
  }, [fetchEvents]);

  function handleLoadMore() {
    fetchEvents(true, cursor);
  }

  if (loading && events.length === 0) {
    return <p>{t("common.loading")}</p>;
  }

  if (error && events.length === 0) {
    return <p style={{ color: colors.dustyRose }}>{t("common.error")}</p>;
  }

  return (
    <AuditTimeline
      events={events}
      tableLabels={tableLabels}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
      actionFilter={actionFilter}
      actorTypeFilter={actorTypeFilter}
      onActionFilterChange={setActionFilter}
      onActorTypeFilterChange={setActorTypeFilter}
    />
  );
}
