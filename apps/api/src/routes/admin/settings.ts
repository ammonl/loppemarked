import { OPENING_TIMEZONE } from "@loppemarked/shared";
import type { Transaction } from "kysely";
import { badRequest, unauthorized } from "../../lib/errors.js";
import { logAuditEvent } from "../../lib/audit.js";
import type { Database } from "../../db/types.js";
import type { RequestContext, RouteResponse } from "../../router.js";

export async function handleGetOpeningTime(ctx: RequestContext): Promise<RouteResponse> {
  const settings = await ctx.db
    .selectFrom("system_settings")
    .select(["opening_datetime", "updated_at"])
    .executeTakeFirst();

  return {
    statusCode: 200,
    body: {
      openingDatetime: settings?.opening_datetime
        ? new Date(settings.opening_datetime).toISOString()
        : null,
      timezone: OPENING_TIMEZONE,
      updatedAt: settings?.updated_at
        ? new Date(settings.updated_at).toISOString()
        : null,
    },
  };
}

interface UpdateOpeningTimeBody {
  openingDatetime?: string;
}

export async function handleUpdateOpeningTime(ctx: RequestContext): Promise<RouteResponse> {
  const { openingDatetime } = (ctx.body ?? {}) as UpdateOpeningTimeBody;

  if (!openingDatetime) {
    throw badRequest("openingDatetime is required");
  }

  const parsed = new Date(openingDatetime);
  if (isNaN(parsed.getTime())) {
    throw badRequest("openingDatetime must be a valid ISO 8601 datetime");
  }

  const current = await ctx.db
    .selectFrom("system_settings")
    .select(["id", "opening_datetime"])
    .executeTakeFirst();

  if (!current) {
    throw badRequest("System settings not initialized");
  }

  const beforeDatetime = new Date(current.opening_datetime).toISOString();
  const afterDatetime = parsed.toISOString();
  const now = new Date().toISOString();
  const adminId = ctx.adminId!;

  await ctx.db.transaction().execute(async (trx: Transaction<Database>) => {
    await trx
      .updateTable("system_settings")
      .set({
        opening_datetime: afterDatetime,
        updated_at: now,
      })
      .where("id", "=", current.id)
      .execute();

    await trx
      .insertInto("audit_events")
      .values({
        timestamp: now,
        actor_type: "admin",
        actor_id: adminId,
        action: "opening_datetime_change",
        entity_type: "system_settings",
        entity_id: current.id,
        before: JSON.stringify({ opening_datetime: beforeDatetime }),
        after: JSON.stringify({ opening_datetime: afterDatetime }),
        reason: null,
      })
      .execute();
  });

  return {
    statusCode: 200,
    body: {
      openingDatetime: afterDatetime,
      timezone: OPENING_TIMEZONE,
      updatedAt: now,
    },
  };
}

export async function handleGetNotificationPreferences(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const prefs = await ctx.db
    .selectFrom("admin_notification_preferences")
    .select(["notify_user_registration", "notify_admin_table_action", "updated_at"])
    .where("admin_id", "=", adminId)
    .executeTakeFirst();

  return {
    statusCode: 200,
    body: {
      notifyUserRegistration: prefs?.notify_user_registration ?? true,
      notifyAdminTableAction: prefs?.notify_admin_table_action ?? true,
      updatedAt: prefs?.updated_at ? new Date(prefs.updated_at).toISOString() : null,
    },
  };
}

interface UpdateNotificationPreferencesBody {
  notifyUserRegistration?: boolean;
  notifyAdminTableAction?: boolean;
}

export async function handleUpdateNotificationPreferences(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as UpdateNotificationPreferencesBody;
  const { notifyUserRegistration, notifyAdminTableAction } = body;

  if (notifyUserRegistration === undefined && notifyAdminTableAction === undefined) {
    throw badRequest("At least one preference must be provided");
  }

  const now = new Date().toISOString();

  const existing = await ctx.db
    .selectFrom("admin_notification_preferences")
    .select(["admin_id", "notify_user_registration", "notify_admin_table_action"])
    .where("admin_id", "=", adminId)
    .executeTakeFirst();

  const beforeValues = {
    notify_user_registration: existing?.notify_user_registration ?? true,
    notify_admin_table_action: existing?.notify_admin_table_action ?? true,
  };

  const newUserReg = notifyUserRegistration ?? beforeValues.notify_user_registration;
  const newTableAction = notifyAdminTableAction ?? beforeValues.notify_admin_table_action;

  if (existing) {
    await ctx.db
      .updateTable("admin_notification_preferences")
      .set({
        notify_user_registration: newUserReg,
        notify_admin_table_action: newTableAction,
        updated_at: now,
      })
      .where("admin_id", "=", adminId)
      .execute();
  } else {
    await ctx.db
      .insertInto("admin_notification_preferences")
      .values({
        admin_id: adminId,
        notify_user_registration: newUserReg,
        notify_admin_table_action: newTableAction,
        updated_at: now,
      })
      .execute();
  }

  await logAuditEvent(ctx.db, {
    actor_type: "admin",
    actor_id: adminId,
    action: "notification_preferences_update",
    entity_type: "admin_notification_preferences",
    entity_id: adminId,
    before: beforeValues,
    after: { notify_user_registration: newUserReg, notify_admin_table_action: newTableAction },
  });

  return {
    statusCode: 200,
    body: {
      notifyUserRegistration: newUserReg,
      notifyAdminTableAction: newTableAction,
      updatedAt: now,
    },
  };
}
