import { AUDIT_ACTIONS } from "@loppemarked/shared";
import type { AuditAction } from "@loppemarked/shared";
import { badRequest, unauthorized } from "../../lib/errors.js";
import type { RequestContext, RouteResponse } from "../../router.js";

interface AuditQueryParams {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorType?: string;
  before?: string;
  after?: string;
  limit?: string;
  cursor?: string;
}

interface DecodedCursor {
  timestamp: string;
  id: string;
}

function encodeCursor(timestamp: string, id: string): string {
  return Buffer.from(JSON.stringify({ timestamp, id })).toString("base64");
}

function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.timestamp === "string" &&
      typeof parsed.id === "string"
    ) {
      return parsed as DecodedCursor;
    }
    return null;
  } catch {
    return null;
  }
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

function parseQueryParams(body: unknown): AuditQueryParams {
  if (!body || typeof body !== "object") return {};
  return body as AuditQueryParams;
}

export async function handleListAuditEvents(ctx: RequestContext): Promise<RouteResponse> {
  if (!ctx.adminId) {
    throw unauthorized();
  }

  const params = parseQueryParams(ctx.body);

  if (params.action && !(AUDIT_ACTIONS as readonly string[]).includes(params.action)) {
    throw badRequest(`Invalid action filter. Must be one of: ${AUDIT_ACTIONS.join(", ")}`);
  }

  if (params.actorType && !["public", "admin", "system"].includes(params.actorType)) {
    throw badRequest("Invalid actorType filter. Must be one of: public, admin, system");
  }

  if (params.before && isNaN(new Date(params.before).getTime())) {
    throw badRequest("Invalid 'before' date format");
  }

  if (params.after && isNaN(new Date(params.after).getTime())) {
    throw badRequest("Invalid 'after' date format");
  }

  const limit = Math.min(
    Math.max(1, Number(params.limit) || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  let query = ctx.db
    .selectFrom("audit_events")
    .select([
      "id",
      "timestamp",
      "actor_type",
      "actor_id",
      "action",
      "entity_type",
      "entity_id",
      "before",
      "after",
      "reason",
    ])
    .orderBy("timestamp", "desc")
    .orderBy("id", "desc")
    .limit(limit + 1);

  if (params.action) {
    query = query.where("action", "=", params.action as AuditAction);
  }

  if (params.entityType) {
    query = query.where("entity_type", "=", params.entityType);
  }

  if (params.entityId) {
    query = query.where("entity_id", "=", params.entityId);
  }

  if (params.actorType) {
    query = query.where("actor_type", "=", params.actorType as "public" | "admin" | "system");
  }

  if (params.before) {
    query = query.where("timestamp", "<", new Date(params.before));
  }

  if (params.after) {
    query = query.where("timestamp", ">", new Date(params.after));
  }

  if (params.cursor) {
    if (typeof params.cursor !== "string") {
      throw badRequest("Invalid cursor format");
    }
    const decoded = decodeCursor(params.cursor);
    if (!decoded) {
      throw badRequest("Invalid cursor format");
    }
    const cursorDate = new Date(decoded.timestamp);
    if (isNaN(cursorDate.getTime())) {
      throw badRequest("Invalid cursor format");
    }
    query = query.where((eb) =>
      eb.or([
        eb("timestamp", "<", cursorDate),
        eb.and([eb("timestamp", "=", cursorDate), eb("id", "<", decoded.id)]),
      ]),
    );
  }

  const rows = await query.execute();

  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  const lastEvent = events[events.length - 1];
  const nextCursor = hasMore && lastEvent
    ? encodeCursor(new Date(lastEvent.timestamp).toISOString(), lastEvent.id)
    : null;

  const adminActorIds = [
    ...new Set(
      events
        .filter((e) => e.actor_type === "admin" && e.actor_id)
        .map((e) => e.actor_id as string),
    ),
  ];

  let adminMap = new Map<string, string>();
  if (adminActorIds.length > 0) {
    const admins = await ctx.db
      .selectFrom("admins")
      .select(["id", "email"])
      .where("id", "in", adminActorIds)
      .execute();
    adminMap = new Map(admins.map((a) => [a.id, a.email]));
  }

  const tableIds = new Set<number>();
  for (const e of events) {
    if (e.entity_type === "table") {
      const parsed = Number(e.entity_id);
      if (!isNaN(parsed)) tableIds.add(parsed);
    }
    const beforeTableId = (e.before as Record<string, unknown> | null)?.table_id;
    const afterTableId = (e.after as Record<string, unknown> | null)?.table_id;
    for (const rawId of [beforeTableId, afterTableId]) {
      if (typeof rawId === "number") {
        tableIds.add(rawId);
      } else if (typeof rawId === "string") {
        const parsed = Number(rawId);
        if (!isNaN(parsed)) tableIds.add(parsed);
      }
    }
  }

  const tableLabels: Record<string, string> = {};
  for (const id of tableIds) {
    tableLabels[String(id)] = `Table #${id}`;
  }

  return {
    statusCode: 200,
    body: {
      events: events.map((e) => ({
        id: e.id,
        timestamp: new Date(e.timestamp).toISOString(),
        actorType: e.actor_type,
        actorId: e.actor_id,
        actorName: e.actor_type === "admin" && e.actor_id
          ? adminMap.get(e.actor_id) ?? null
          : null,
        action: e.action,
        entityType: e.entity_type,
        entityId: e.entity_id,
        before: e.before,
        after: e.after,
        reason: e.reason,
      })),
      tableLabels,
      nextCursor,
      hasMore,
    },
  };
}
