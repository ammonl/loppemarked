import { RESERVED_LABEL_DEFAULT } from "@loppemarked/shared";
import { logAuditEvent } from "../../lib/audit.js";
import { notifyAdmins } from "../../lib/admin-ops-notifications.js";
import { badRequest, unauthorized } from "../../lib/errors.js";
import type { RequestContext, RouteResponse } from "../../router.js";

export async function handleAdminTables(ctx: RequestContext): Promise<RouteResponse> {
  const tables = await ctx.db
    .selectFrom("tables")
    .select(["id", "state", "reserved_label"])
    .orderBy("id", "asc")
    .execute();

  const registrations = await ctx.db
    .selectFrom("registrations")
    .select(["id", "table_id", "name", "email", "language", "status"])
    .where("status", "=", "active")
    .execute();

  const regByTable = new Map(registrations.map((r) => [r.table_id, r]));

  const result = tables.map((t) => {
    const reg = regByTable.get(t.id);
    return {
      id: t.id,
      state: t.state,
      reservedLabel: t.reserved_label,
      registration: reg
        ? { id: reg.id, name: reg.name, email: reg.email, language: reg.language }
        : null,
    };
  });

  return {
    statusCode: 200,
    body: result,
  };
}

interface ReserveTableBody {
  tableId?: number;
}

export async function handleReserveTable(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as ReserveTableBody;
  const { tableId } = body;

  if (typeof tableId !== "number") {
    throw badRequest("tableId is required");
  }

  await ctx.db.transaction().execute(async (trx) => {
    const table = await trx
      .selectFrom("tables")
      .select(["id", "state"])
      .where("id", "=", tableId)
      .forUpdate()
      .executeTakeFirst();

    if (!table) {
      throw badRequest("Table not found");
    }
    if (table.state !== "available") {
      throw badRequest("Only available tables can be reserved");
    }

    await trx
      .updateTable("tables")
      .set({ state: "reserved", reserved_label: RESERVED_LABEL_DEFAULT, updated_at: new Date().toISOString() })
      .where("id", "=", tableId)
      .execute();

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "table_state_change",
      entity_type: "table",
      entity_id: String(tableId),
      before: { state: "available" },
      after: { state: "reserved", reserved_label: RESERVED_LABEL_DEFAULT },
    });
  });

  await notifyAdmins(ctx.db, {
    type: "admin_table_reserve",
    actingAdminId: adminId,
    tableId,
  });

  return {
    statusCode: 200,
    body: { tableId, state: "reserved" },
  };
}

interface ReleaseTableBody {
  tableId?: number;
}

export async function handleReleaseTable(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as ReleaseTableBody;
  const { tableId } = body;

  if (typeof tableId !== "number") {
    throw badRequest("tableId is required");
  }

  await ctx.db.transaction().execute(async (trx) => {
    const table = await trx
      .selectFrom("tables")
      .select(["id", "state"])
      .where("id", "=", tableId)
      .forUpdate()
      .executeTakeFirst();

    if (!table) {
      throw badRequest("Table not found");
    }
    if (table.state !== "reserved") {
      throw badRequest("Only reserved tables can be released");
    }

    await trx
      .updateTable("tables")
      .set({ state: "available", reserved_label: null, updated_at: new Date().toISOString() })
      .where("id", "=", tableId)
      .execute();

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "table_state_change",
      entity_type: "table",
      entity_id: String(tableId),
      before: { state: "reserved" },
      after: { state: "available" },
    });
  });

  await notifyAdmins(ctx.db, {
    type: "admin_table_release",
    actingAdminId: adminId,
    tableId,
  });

  return {
    statusCode: 200,
    body: { tableId, state: "available" },
  };
}
