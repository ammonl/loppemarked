import {
  RESERVED_LABEL_DEFAULT,
  effectiveFloorDoor,
  normalizeApartmentKey,
  ADMIN_DEFAULT_LANGUAGE,
} from "@loppemarked/shared";
import type { Language } from "@loppemarked/shared";
import type { Kysely, Transaction } from "kysely";
import { logAuditEvent } from "../../lib/audit.js";
import {
  buildAdminNotification,
  type AdminNotificationAction,
  type NotificationPreviewInput,
} from "../../lib/admin-email-templates.js";
import { notifyAdmins } from "../../lib/admin-ops-notifications.js";
import { queueAndSendEmail } from "../../lib/email-service.js";
import { badRequest, conflict, notFound, unauthorized } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { notifyDownstreamWaitlist } from "../../lib/waitlist-emails.js";
import type { Database } from "../../db/types.js";
import type { RequestContext, RouteResponse } from "../../router.js";

interface NotificationInput {
  sendEmail?: boolean;
  subject?: string;
  bodyHtml?: string;
}

/**
 * Send a notification email if requested by the admin.
 * Errors are caught and logged — they never fail the caller.
 */
async function sendNotificationIfRequested(
  db: Kysely<Database> | Transaction<Database>,
  adminId: string,
  notification: NotificationInput | undefined,
  previewInput: NotificationPreviewInput,
  entityType: string,
  entityId: string,
): Promise<void> {
  if (!notification) {
    return;
  }

  try {
    const sendEmail = notification.sendEmail ?? true;

    if (!sendEmail) {
      await logAuditEvent(db, {
        actor_type: "admin",
        actor_id: adminId,
        action: "notification_skipped",
        entity_type: entityType,
        entity_id: entityId,
        after: {
          notification_action: previewInput.action,
          recipient_email: previewInput.recipientEmail,
        },
      });
      return;
    }

    const defaultTemplate = buildAdminNotification(previewInput);
    const subject = notification.subject ?? defaultTemplate.subject;
    const bodyHtml = notification.bodyHtml ?? defaultTemplate.bodyHtml;
    const edited =
      (notification.subject != null && notification.subject !== defaultTemplate.subject) ||
      (notification.bodyHtml != null && notification.bodyHtml !== defaultTemplate.bodyHtml);

    const emailId = await queueAndSendEmail(db, {
      recipientEmail: previewInput.recipientEmail,
      language: previewInput.language,
      subject,
      bodyHtml,
    });

    if (emailId && edited) {
      await db
        .updateTable("emails")
        .set({ edited_before_send: true })
        .where("id", "=", emailId)
        .execute();
    }

    await logAuditEvent(db, {
      actor_type: "admin",
      actor_id: adminId,
      action: "notification_sent",
      entity_type: entityType,
      entity_id: entityId,
      after: {
        notification_action: previewInput.action,
        recipient_email: previewInput.recipientEmail,
        email_id: emailId,
        edited_before_send: edited,
        subject,
      },
    });
  } catch (err) {
    logger.error("Failed to process notification", err);
  }
}

export async function handleListRegistrations(ctx: RequestContext): Promise<RouteResponse> {
  if (!ctx.adminId) {
    throw unauthorized();
  }

  const registrations = await ctx.db
    .selectFrom("registrations")
    .select([
      "registrations.id",
      "registrations.table_id",
      "registrations.name",
      "registrations.email",
      "registrations.street",
      "registrations.house_number",
      "registrations.floor",
      "registrations.door",
      "registrations.apartment_key",
      "registrations.language",
      "registrations.status",
      "registrations.created_at",
      "registrations.updated_at",
    ])
    .orderBy("registrations.created_at", "desc")
    .execute();

  return {
    statusCode: 200,
    body: registrations,
  };
}

interface CreateRegistrationBody {
  tableId?: number;
  name?: string;
  email?: string;
  street?: string;
  houseNumber?: number;
  floor?: string | null;
  door?: string | null;
  language?: string;
  notification?: NotificationInput;
  confirmDuplicate?: boolean;
}

export async function handleCreateRegistration(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as CreateRegistrationBody;
  const { tableId, name, email, street, houseNumber } = body;
  const language = body.language || ADMIN_DEFAULT_LANGUAGE;

  if (!tableId || !name || !email || !street || houseNumber == null) {
    throw badRequest("tableId, name, email, street, and houseNumber are required");
  }

  if (language !== "da" && language !== "en") {
    throw badRequest("language must be 'da' or 'en'");
  }

  const { floor, door } = effectiveFloorDoor(houseNumber, body.floor, body.door);

  const apartmentKey = normalizeApartmentKey(street, houseNumber, floor, door);

  let result: { type: "duplicate_warning"; existingRegistrations: { id: string; tableId: number; name: string; email: string }[] } | { type: "created"; id: string };

  try {
    result = await ctx.db.transaction().execute(async (trx) => {
      const table = await trx
        .selectFrom("tables")
        .select(["id", "state"])
        .where("id", "=", tableId)
        .forUpdate()
        .executeTakeFirst();

      if (!table) {
        throw badRequest("Table not found");
      }
      if (table.state === "occupied") {
        throw conflict("Table is already occupied", "TABLE_OCCUPIED");
      }

      const existingRegs = await trx
        .selectFrom("registrations")
        .select(["id", "table_id", "name", "email"])
        .where("apartment_key", "=", apartmentKey)
        .where("status", "=", "active")
        .forUpdate()
        .execute();

      if (existingRegs.length > 0 && !body.confirmDuplicate) {
        await logAuditEvent(trx, {
          actor_type: "admin",
          actor_id: adminId,
          action: "duplicate_address_warning_shown",
          entity_type: "registration",
          entity_id: apartmentKey,
          after: {
            apartment_key: apartmentKey,
            existing_count: existingRegs.length,
            existing_registrations: existingRegs.map((r) => ({
              id: r.id,
              table_id: r.table_id,
            })),
          },
        });

        return {
          type: "duplicate_warning" as const,
          existingRegistrations: existingRegs.map((r) => ({
            id: r.id,
            tableId: r.table_id,
            name: r.name,
            email: r.email,
          })),
        };
      }

      if (existingRegs.length > 0 && body.confirmDuplicate) {
        await logAuditEvent(trx, {
          actor_type: "admin",
          actor_id: adminId,
          action: "duplicate_address_confirmed",
          entity_type: "registration",
          entity_id: apartmentKey,
          after: {
            apartment_key: apartmentKey,
            existing_count: existingRegs.length,
            existing_registrations: existingRegs.map((r) => ({
              id: r.id,
              table_id: r.table_id,
            })),
          },
        });
      }

      const [newReg] = await trx
        .insertInto("registrations")
        .values({
          table_id: tableId,
          name,
          email,
          street,
          house_number: houseNumber,
          floor,
          door,
          apartment_key: apartmentKey,
          language: language as "da" | "en",
          status: "active",
        })
        .returning(["id"])
        .execute();

      await trx
        .updateTable("tables")
        .set({ state: "occupied", reserved_label: null, updated_at: new Date().toISOString() })
        .where("id", "=", tableId)
        .execute();

      await logAuditEvent(trx, {
        actor_type: "admin",
        actor_id: adminId,
        action: "registration_create",
        entity_type: "registration",
        entity_id: newReg.id,
        after: { table_id: tableId, apartment_key: apartmentKey, name, email },
      });

      await logAuditEvent(trx, {
        actor_type: "admin",
        actor_id: adminId,
        action: "table_state_change",
        entity_type: "table",
        entity_id: String(tableId),
        before: { state: table.state },
        after: { state: "occupied" },
      });

      return { type: "created" as const, id: newReg.id };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict(
        "This apartment already has an active registration",
        "APARTMENT_HAS_REGISTRATION",
      );
    }
    throw err;
  }

  if (result.type === "duplicate_warning") {
    return {
      statusCode: 409,
      body: {
        error: "This apartment already has active registrations",
        code: "DUPLICATE_ADDRESS_WARNING",
        existingRegistrations: result.existingRegistrations,
      },
    };
  }

  await sendNotificationIfRequested(
    ctx.db,
    adminId,
    body.notification,
    {
      action: "add",
      recipientName: name,
      recipientEmail: email,
      language: language as Language,
      tableId,
    },
    "registration",
    result.id,
  );

  await notifyAdmins(ctx.db, {
    type: "admin_registration_create",
    actingAdminId: adminId,
    userName: name,
    tableId,
  });

  return {
    statusCode: 201,
    body: { id: result.id, tableId, apartmentKey },
  };
}

interface MoveRegistrationBody {
  registrationId?: string;
  newTableId?: number;
  notification?: NotificationInput;
}

export async function handleMoveRegistration(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as MoveRegistrationBody;
  const { registrationId, newTableId } = body;

  if (!registrationId || !newTableId) {
    throw badRequest("registrationId and newTableId are required");
  }

  const moveResult = await ctx.db.transaction().execute(async (trx) => {
    const reg = await trx
      .selectFrom("registrations")
      .select(["id", "table_id", "name", "email", "language", "status"])
      .where("id", "=", registrationId)
      .forUpdate()
      .executeTakeFirst();

    if (!reg) {
      throw notFound("Registration not found");
    }
    if (reg.status !== "active") {
      throw badRequest("Only active registrations can be moved");
    }

    const oldTableId = reg.table_id;
    if (oldTableId === newTableId) {
      throw badRequest("New table must be different from current table");
    }

    const oldTable = await trx
      .selectFrom("tables")
      .select(["id", "state"])
      .where("id", "=", oldTableId)
      .forUpdate()
      .executeTakeFirst();

    if (!oldTable) {
      throw badRequest("Current table not found");
    }

    const newTable = await trx
      .selectFrom("tables")
      .select(["id", "state"])
      .where("id", "=", newTableId)
      .forUpdate()
      .executeTakeFirst();

    if (!newTable) {
      throw badRequest("Target table not found");
    }
    if (newTable.state === "occupied") {
      throw conflict("Target table is already occupied", "TABLE_OCCUPIED");
    }

    await trx
      .updateTable("registrations")
      .set({ table_id: newTableId, updated_at: new Date().toISOString() })
      .where("id", "=", registrationId)
      .execute();

    await trx
      .updateTable("tables")
      .set({ state: "available", reserved_label: null, updated_at: new Date().toISOString() })
      .where("id", "=", oldTableId)
      .execute();

    await trx
      .updateTable("tables")
      .set({ state: "occupied", reserved_label: null, updated_at: new Date().toISOString() })
      .where("id", "=", newTableId)
      .execute();

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "registration_move",
      entity_type: "registration",
      entity_id: registrationId,
      before: { table_id: oldTableId },
      after: { table_id: newTableId },
    });

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "table_state_change",
      entity_type: "table",
      entity_id: String(oldTableId),
      before: { state: "occupied" },
      after: { state: "available" },
    });

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "table_state_change",
      entity_type: "table",
      entity_id: String(newTableId),
      before: { state: newTable.state },
      after: { state: "occupied" },
    });

    return {
      oldTableId,
      recipientName: reg.name,
      recipientEmail: reg.email,
      language: reg.language as Language,
    };
  });

  await sendNotificationIfRequested(
    ctx.db,
    adminId,
    body.notification,
    {
      action: "move",
      recipientName: moveResult.recipientName,
      recipientEmail: moveResult.recipientEmail,
      language: moveResult.language,
      tableId: newTableId,
      oldTableId: moveResult.oldTableId,
    },
    "registration",
    registrationId,
  );

  await notifyAdmins(ctx.db, {
    type: "admin_registration_move",
    actingAdminId: adminId,
    userName: moveResult.recipientName,
    oldTableId: moveResult.oldTableId,
    newTableId,
  });

  return {
    statusCode: 200,
    body: { registrationId, newTableId },
  };
}

interface RemoveRegistrationBody {
  registrationId?: string;
  makeTablePublic?: boolean;
  notification?: NotificationInput;
}

export async function handleRemoveRegistration(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as RemoveRegistrationBody;
  const { registrationId } = body;
  const makeTablePublic = body.makeTablePublic ?? true;

  if (!registrationId) {
    throw badRequest("registrationId is required");
  }

  const removeResult = await ctx.db.transaction().execute(async (trx) => {
    const reg = await trx
      .selectFrom("registrations")
      .select(["id", "table_id", "status", "name", "email", "language", "apartment_key"])
      .where("id", "=", registrationId)
      .forUpdate()
      .executeTakeFirst();

    if (!reg) {
      throw notFound("Registration not found");
    }
    if (reg.status !== "active") {
      throw badRequest("Only active registrations can be removed");
    }

    await trx
      .updateTable("registrations")
      .set({ status: "removed", updated_at: new Date().toISOString() })
      .where("id", "=", registrationId)
      .execute();

    const newTableState = makeTablePublic ? "available" : "reserved";
    const reservedLabel = makeTablePublic ? null : RESERVED_LABEL_DEFAULT;

    await trx
      .updateTable("tables")
      .set({
        state: newTableState,
        reserved_label: reservedLabel,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", reg.table_id)
      .execute();

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "registration_remove",
      entity_type: "registration",
      entity_id: registrationId,
      before: { table_id: reg.table_id, status: "active", name: reg.name },
      after: { status: "removed" },
    });

    await logAuditEvent(trx, {
      actor_type: "admin",
      actor_id: adminId,
      action: "table_state_change",
      entity_type: "table",
      entity_id: String(reg.table_id),
      before: { state: "occupied" },
      after: { state: newTableState, reserved_label: reservedLabel },
    });

    return {
      tableId: reg.table_id,
      recipientName: reg.name,
      recipientEmail: reg.email,
      language: reg.language as Language,
    };
  });

  await sendNotificationIfRequested(
    ctx.db,
    adminId,
    body.notification,
    {
      action: "remove",
      recipientName: removeResult.recipientName,
      recipientEmail: removeResult.recipientEmail,
      language: removeResult.language,
      tableId: removeResult.tableId,
    },
    "registration",
    registrationId,
  );

  await notifyAdmins(ctx.db, {
    type: "admin_registration_remove",
    actingAdminId: adminId,
    userName: removeResult.recipientName,
    tableId: removeResult.tableId,
  });

  return {
    statusCode: 200,
    body: { registrationId, tableReleased: makeTablePublic },
  };
}

interface AssignWaitlistBody {
  waitlistEntryId?: string;
  tableId?: number;
  notification?: NotificationInput;
  confirmDuplicate?: boolean;
  notifyDownstream?: boolean;
}

export async function handleAssignWaitlist(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as AssignWaitlistBody;
  const { waitlistEntryId, tableId } = body;
  const notifyDownstream = body.notifyDownstream ?? false;

  if (!waitlistEntryId || !tableId) {
    throw badRequest("waitlistEntryId and tableId are required");
  }

  type AssignResult =
    | { type: "duplicate_warning"; existingRegistrations: { id: string; tableId: number; name: string; email: string }[] }
    | {
        type: "created";
        registrationId: string;
        recipientName: string;
        recipientEmail: string;
        language: Language;
        waitlistCreatedAt: Date;
      };

  let result: AssignResult;

  try {
    result = await ctx.db.transaction().execute(async (trx) => {
      const entry = await trx
        .selectFrom("waitlist_entries")
        .select([
          "id", "name", "email", "street", "house_number",
          "floor", "door", "apartment_key", "language", "status", "created_at",
        ])
        .where("id", "=", waitlistEntryId)
        .forUpdate()
        .executeTakeFirst();

      if (!entry) {
        throw notFound("Waitlist entry not found");
      }
      if (entry.status !== "waiting") {
        throw badRequest("Waitlist entry is not in waiting status");
      }

      const table = await trx
        .selectFrom("tables")
        .select(["id", "state"])
        .where("id", "=", tableId)
        .forUpdate()
        .executeTakeFirst();

      if (!table) {
        throw badRequest("Table not found");
      }
      if (table.state === "occupied") {
        throw conflict("Table is already occupied", "TABLE_OCCUPIED");
      }

      const existingRegs = await trx
        .selectFrom("registrations")
        .select(["id", "table_id", "name", "email"])
        .where("apartment_key", "=", entry.apartment_key)
        .where("status", "=", "active")
        .forUpdate()
        .execute();

      if (existingRegs.length > 0 && !body.confirmDuplicate) {
        await logAuditEvent(trx, {
          actor_type: "admin",
          actor_id: adminId,
          action: "duplicate_address_warning_shown",
          entity_type: "waitlist_entry",
          entity_id: waitlistEntryId,
          after: {
            apartment_key: entry.apartment_key,
            existing_count: existingRegs.length,
            existing_registrations: existingRegs.map((r) => ({
              id: r.id,
              table_id: r.table_id,
            })),
          },
        });

        return {
          type: "duplicate_warning" as const,
          existingRegistrations: existingRegs.map((r) => ({
            id: r.id,
            tableId: r.table_id,
            name: r.name,
            email: r.email,
          })),
        };
      }

      if (existingRegs.length > 0 && body.confirmDuplicate) {
        await logAuditEvent(trx, {
          actor_type: "admin",
          actor_id: adminId,
          action: "duplicate_address_confirmed",
          entity_type: "waitlist_entry",
          entity_id: waitlistEntryId,
          after: {
            apartment_key: entry.apartment_key,
            existing_count: existingRegs.length,
            existing_registrations: existingRegs.map((r) => ({
              id: r.id,
              table_id: r.table_id,
            })),
          },
        });
      }

      const [newReg] = await trx
        .insertInto("registrations")
        .values({
          table_id: tableId,
          name: entry.name,
          email: entry.email,
          street: entry.street,
          house_number: entry.house_number,
          floor: entry.floor,
          door: entry.door,
          apartment_key: entry.apartment_key,
          language: entry.language,
          status: "active",
        })
        .returning(["id"])
        .execute();

      await trx
        .updateTable("tables")
        .set({ state: "occupied", reserved_label: null, updated_at: new Date().toISOString() })
        .where("id", "=", tableId)
        .execute();

      await trx
        .updateTable("waitlist_entries")
        .set({ status: "assigned", updated_at: new Date().toISOString() })
        .where("id", "=", waitlistEntryId)
        .execute();

      await logAuditEvent(trx, {
        actor_type: "admin",
        actor_id: adminId,
        action: "waitlist_assign",
        entity_type: "waitlist_entry",
        entity_id: waitlistEntryId,
        before: { status: "waiting" },
        after: { status: "assigned", registration_id: newReg.id, table_id: tableId },
      });

      await logAuditEvent(trx, {
        actor_type: "admin",
        actor_id: adminId,
        action: "registration_create",
        entity_type: "registration",
        entity_id: newReg.id,
        after: {
          table_id: tableId,
          apartment_key: entry.apartment_key,
          from_waitlist: waitlistEntryId,
        },
      });

      await logAuditEvent(trx, {
        actor_type: "admin",
        actor_id: adminId,
        action: "table_state_change",
        entity_type: "table",
        entity_id: String(tableId),
        before: { state: table.state },
        after: { state: "occupied" },
      });

      return {
        type: "created" as const,
        registrationId: newReg.id,
        recipientName: entry.name,
        recipientEmail: entry.email,
        language: entry.language as Language,
        waitlistCreatedAt: entry.created_at,
      };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict(
        "This apartment already has an active registration",
        "APARTMENT_HAS_REGISTRATION",
      );
    }
    throw err;
  }

  if (result.type === "duplicate_warning") {
    return {
      statusCode: 409,
      body: {
        error: "This apartment already has active registrations",
        code: "DUPLICATE_ADDRESS_WARNING",
        existingRegistrations: result.existingRegistrations,
      },
    };
  }

  await sendNotificationIfRequested(
    ctx.db,
    adminId,
    body.notification,
    {
      action: "waitlist_assign",
      recipientName: result.recipientName,
      recipientEmail: result.recipientEmail,
      language: result.language,
      tableId,
    },
    "registration",
    result.registrationId,
  );

  if (notifyDownstream) {
    await notifyDownstreamWaitlist(ctx.db, adminId, result.waitlistCreatedAt, {
      triggerAction: "waitlist_assign",
      entityId: waitlistEntryId,
    });
  }

  await notifyAdmins(ctx.db, {
    type: "admin_waitlist_assign",
    actingAdminId: adminId,
    userName: result.recipientName,
    tableId,
  });

  return {
    statusCode: 201,
    body: {
      registrationId: result.registrationId,
      waitlistEntryId,
      tableId,
    },
  };
}

interface NotificationPreviewBody {
  action?: string;
  recipientName?: string;
  recipientEmail?: string;
  language?: string;
  tableId?: number;
  oldTableId?: number;
}

export async function handleNotificationPreview(ctx: RequestContext): Promise<RouteResponse> {
  if (!ctx.adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as NotificationPreviewBody;

  const { action, recipientName, recipientEmail, language, tableId } = body;

  if (!action || !recipientName || !recipientEmail || !language || !tableId) {
    throw badRequest("action, recipientName, recipientEmail, language, and tableId are required");
  }

  const validActions = new Set<string>(["add", "move", "remove", "waitlist_assign"]);
  if (!validActions.has(action)) {
    throw badRequest("action must be one of: add, move, remove, waitlist_assign");
  }

  if (language !== "da" && language !== "en") {
    throw badRequest("language must be 'da' or 'en'");
  }

  if (action === "move" && !body.oldTableId) {
    throw badRequest("oldTableId is required for move action");
  }

  const preview = buildAdminNotification({
    action: action as AdminNotificationAction,
    recipientName,
    recipientEmail,
    language: language as Language,
    tableId,
    oldTableId: body.oldTableId,
  });

  return {
    statusCode: 200,
    body: preview,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
