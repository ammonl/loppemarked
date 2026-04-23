import { logAuditEvent } from "../../lib/audit.js";
import { notifyAdmins } from "../../lib/admin-ops-notifications.js";
import { badRequest, unauthorized } from "../../lib/errors.js";
import type { RequestContext, RouteResponse } from "../../router.js";

export async function handleAdminBoxes(ctx: RequestContext): Promise<RouteResponse> {
  const boxes = await ctx.db
    .selectFrom("planter_boxes")
    .select(["id", "name", "greenhouse_name", "state", "reserved_label"])
    .orderBy("id", "asc")
    .execute();

  const registrations = await ctx.db
    .selectFrom("registrations")
    .select(["id", "box_id", "name", "email", "language", "status"])
    .where("status", "=", "active")
    .execute();

  const regByBox = new Map(registrations.map((r) => [r.box_id, r]));

  const result = boxes.map((b) => {
    const reg = regByBox.get(b.id);
    return {
      id: b.id,
      name: b.name,
      greenhouse: b.greenhouse_name,
      state: b.state,
      reservedLabel: b.reserved_label,
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

interface ReserveBoxBody {
  boxId?: number;
}

export async function handleReserveBox(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as ReserveBoxBody;
  const { boxId } = body;

  if (typeof boxId !== "number") {
    throw badRequest("boxId is required");
  }

  await ctx.db.transaction().execute(async (trx) => {
    const box = await trx
      .selectFrom("planter_boxes")
      .select(["id", "state"])
      .where("id", "=", boxId)
      .forUpdate()
      .executeTakeFirst();

    if (!box) {
      throw badRequest("Box not found");
    }
    if (box.state !== "available") {
      throw badRequest("Only available boxes can be reserved");
    }

    await trx
      .updateTable("planter_boxes")
      .set({ state: "reserved", reserved_label: "Admin Hold", updated_at: new Date().toISOString() })
      .where("id", "=", boxId)
      .execute();

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "box_state_change",
      entity_type: "planter_box",
      entity_id: String(boxId),
      before: { state: "available" },
      after: { state: "reserved", reserved_label: "Admin Hold" },
    });
  });

  await notifyAdmins(ctx.db, {
    type: "admin_box_reserve",
    actingAdminId: adminId,
    boxId,
  });

  return {
    statusCode: 200,
    body: { boxId, state: "reserved" },
  };
}

interface ReleaseBoxBody {
  boxId?: number;
}

export async function handleReleaseBox(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as ReleaseBoxBody;
  const { boxId } = body;

  if (typeof boxId !== "number") {
    throw badRequest("boxId is required");
  }

  await ctx.db.transaction().execute(async (trx) => {
    const box = await trx
      .selectFrom("planter_boxes")
      .select(["id", "state"])
      .where("id", "=", boxId)
      .forUpdate()
      .executeTakeFirst();

    if (!box) {
      throw badRequest("Box not found");
    }
    if (box.state !== "reserved") {
      throw badRequest("Only reserved boxes can be released");
    }

    await trx
      .updateTable("planter_boxes")
      .set({ state: "available", reserved_label: null, updated_at: new Date().toISOString() })
      .where("id", "=", boxId)
      .execute();

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "box_state_change",
      entity_type: "planter_box",
      entity_id: String(boxId),
      before: { state: "reserved" },
      after: { state: "available" },
    });
  });

  await notifyAdmins(ctx.db, {
    type: "admin_box_release",
    actingAdminId: adminId,
    boxId,
  });

  return {
    statusCode: 200,
    body: { boxId, state: "available" },
  };
}
