import { ELIGIBLE_STREET, VISIBLE_TABLE_IDS, normalizeApartmentKey } from "@loppemarked/shared";
import { logAuditEvent } from "../../lib/audit.js";
import { badRequest, unauthorized } from "../../lib/errors.js";
import type { RequestContext, RouteResponse } from "../../router.js";

function isStagingEnvironment(): boolean {
  return process.env["ENVIRONMENT"] === "staging";
}

export async function handleFillTables(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  if (!isStagingEnvironment()) {
    throw badRequest("This action is only available in the staging environment");
  }

  const body = (ctx.body ?? {}) as { confirm?: boolean };
  if (!body.confirm) {
    throw badRequest("Confirmation is required to fill all tables with fake registrations");
  }

  let filledCount = 0;

  await ctx.db.transaction().execute(async (trx) => {
    const tables = await trx
      .selectFrom("tables")
      .select(["id", "state"])
      .where("state", "!=", "occupied")
      .orderBy("id", "asc")
      .execute();

    for (const table of tables) {
      if (!VISIBLE_TABLE_IDS.includes(table.id)) continue;

      const houseNumber = 122 + ((table.id - 1) * 2) % 80;
      const floor = houseNumber >= 161 ? String(((table.id - 1) % 4) + 1) : null;
      const door = houseNumber >= 161 ? (table.id % 2 === 0 ? "th" : "tv") : null;
      const apartmentKey = normalizeApartmentKey(ELIGIBLE_STREET, houseNumber, floor, door);

      await trx
        .insertInto("registrations")
        .values({
          table_id: table.id,
          name: `Test User ${table.id}`,
          email: `testuser${table.id}@staging.example.com`,
          street: ELIGIBLE_STREET,
          house_number: houseNumber,
          floor,
          door,
          apartment_key: apartmentKey,
          language: table.id % 2 === 0 ? "en" : "da",
          status: "active",
        })
        .execute();

      await trx
        .updateTable("tables")
        .set({ state: "occupied", reserved_label: null, updated_at: new Date().toISOString() })
        .where("id", "=", table.id)
        .execute();

      filledCount++;
    }

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "staging_fill_tables",
      entity_type: "system",
      entity_id: "staging",
      after: { filled_count: filledCount, total_tables: VISIBLE_TABLE_IDS.length },
    });
  });

  return {
    statusCode: 200,
    body: { filledCount, totalTables: VISIBLE_TABLE_IDS.length },
  };
}

export async function handleClearRegistrations(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  if (!isStagingEnvironment()) {
    throw badRequest("This action is only available in the staging environment");
  }

  const body = (ctx.body ?? {}) as { confirm?: boolean };
  if (!body.confirm) {
    throw badRequest("Confirmation is required to clear all registrations");
  }

  let clearedCount = 0;

  await ctx.db.transaction().execute(async (trx) => {
    const activeRegs = await trx
      .selectFrom("registrations")
      .select(["id", "table_id"])
      .where("status", "=", "active")
      .execute();

    clearedCount = activeRegs.length;

    if (activeRegs.length > 0) {
      await trx
        .updateTable("registrations")
        .set({ status: "removed", updated_at: new Date().toISOString() })
        .where("status", "=", "active")
        .execute();

      const occupiedTableIds = activeRegs.map((r) => r.table_id);
      await trx
        .updateTable("tables")
        .set({ state: "available", reserved_label: null, updated_at: new Date().toISOString() })
        .where("id", "in", occupiedTableIds)
        .execute();
    }

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "staging_clear_registrations",
      entity_type: "system",
      entity_id: "staging",
      after: { cleared_count: clearedCount },
    });
  });

  return {
    statusCode: 200,
    body: { clearedCount },
  };
}
