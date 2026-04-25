import { logAuditEvent } from "../../lib/audit.js";
import { badRequest, notFound, unauthorized } from "../../lib/errors.js";
import { notifyDownstreamWaitlist } from "../../lib/waitlist-emails.js";
import type { RequestContext, RouteResponse } from "../../router.js";

interface RemoveWaitlistBody {
  notifyDownstream?: boolean;
}

export async function handleListWaitlist(ctx: RequestContext): Promise<RouteResponse> {
  if (!ctx.adminId) {
    throw unauthorized();
  }

  const entries = await ctx.db
    .selectFrom("waitlist_entries")
    .select([
      "id",
      "name",
      "email",
      "street",
      "house_number",
      "floor",
      "door",
      "apartment_key",
      "language",
      "status",
      "created_at",
      "updated_at",
    ])
    .orderBy("created_at", "asc")
    .execute();

  return {
    statusCode: 200,
    body: entries,
  };
}

export async function handleRemoveWaitlist(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const entryId = ctx.params["id"];
  if (!entryId) {
    throw badRequest("Waitlist entry ID is required");
  }

  const body = (ctx.body ?? {}) as RemoveWaitlistBody;
  const notifyDownstream = body.notifyDownstream ?? false;

  const removed = await ctx.db.transaction().execute(async (trx) => {
    const entry = await trx
      .selectFrom("waitlist_entries")
      .select([
        "id",
        "name",
        "email",
        "apartment_key",
        "status",
        "created_at",
      ])
      .where("id", "=", entryId)
      .forUpdate()
      .executeTakeFirst();

    if (!entry) {
      throw notFound("Waitlist entry not found");
    }
    if (entry.status !== "waiting") {
      throw badRequest("Waitlist entry is not in waiting status");
    }

    await trx.deleteFrom("waitlist_entries").where("id", "=", entryId).execute();

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "waitlist_remove",
      entity_type: "waitlist_entry",
      entity_id: entry.id,
      before: {
        name: entry.name,
        email: entry.email,
        apartment_key: entry.apartment_key,
        status: entry.status,
      },
      after: {
        notify_downstream: notifyDownstream,
      },
    });

    return { id: entry.id, createdAt: entry.created_at };
  });

  if (notifyDownstream) {
    await notifyDownstreamWaitlist(ctx.db, adminId, removed.createdAt, {
      triggerAction: "waitlist_remove",
      entityId: removed.id,
    });
  }

  return {
    statusCode: 204,
    body: null,
  };
}
