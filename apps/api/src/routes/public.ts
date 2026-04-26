import {
  RESERVED_LABEL_AWAITING_REVIEW,
  effectiveFloorDoor,
  formatTableLabel,
  isFloorDoorRequired,
  normalizeApartmentKey,
  validateAddress,
  validateRegistrationInput,
  validateWaitlistInput,
} from "@loppemarked/shared";
import type { Language, RegistrationInput, WaitlistInput } from "@loppemarked/shared";
import { logAuditEvent } from "../lib/audit.js";
import { notifyAdmins } from "../lib/admin-ops-notifications.js";
import {
  buildCancellationUrl,
  consumeCancellationToken,
  createCancellationToken,
  getPublicWebBaseUrl,
  resolveCancellationToken,
} from "../lib/cancellation-tokens.js";
import {
  buildCancellationConfirmationEmail,
  buildConfirmationEmail,
} from "../lib/email-templates.js";
import { queueAndSendEmail } from "../lib/email-service.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { buildWaitlistJoinConfirmationEmail } from "../lib/waitlist-emails.js";
import type { RequestContext, RouteResponse } from "../router.js";

export async function handlePublicStatus(ctx: RequestContext): Promise<RouteResponse> {
  const settings = await ctx.db
    .selectFrom("system_settings")
    .select(["opening_datetime"])
    .executeTakeFirst();

  const openingDate = settings?.opening_datetime
    ? new Date(settings.opening_datetime)
    : null;
  const isOpen = openingDate ? openingDate.getTime() <= Date.now() : false;
  const openingDatetime = openingDate ? openingDate.toISOString() : null;

  const availableCount = await ctx.db
    .selectFrom("tables")
    .select(ctx.db.fn.countAll<number>().as("count"))
    .where("state", "=", "available")
    .executeTakeFirstOrThrow();

  return {
    statusCode: 200,
    body: {
      isOpen,
      openingDatetime,
      hasAvailableTables: Number(availableCount.count) > 0,
      serverTime: new Date().toISOString(),
    },
  };
}

export async function handlePublicHallSummary(ctx: RequestContext): Promise<RouteResponse> {
  const tables = await ctx.db
    .selectFrom("tables")
    .select(["state"])
    .execute();

  const summary = {
    totalTables: tables.length,
    availableTables: tables.filter((t) => t.state === "available").length,
    occupiedTables: tables.filter(
      (t) => t.state === "occupied" || t.state === "reserved",
    ).length,
  };

  return {
    statusCode: 200,
    body: summary,
  };
}

export async function handlePublicTables(ctx: RequestContext): Promise<RouteResponse> {
  const tables = await ctx.db
    .selectFrom("tables")
    .select(["id", "state"])
    .orderBy("id", "asc")
    .execute();

  const publicTables = tables.map((t) => ({
    id: t.id,
    state: t.state === "reserved" ? "occupied" as const : t.state,
  }));

  return {
    statusCode: 200,
    body: publicTables,
  };
}

interface ValidateAddressBody {
  street?: string;
  houseNumber?: number;
  floor?: string | null;
  door?: string | null;
}

export async function handleValidateAddress(ctx: RequestContext): Promise<RouteResponse> {
  const body = ctx.body as ValidateAddressBody | undefined;
  if (!body) {
    throw badRequest("Request body is required");
  }

  const street = body.street ?? "";
  const houseNumber = body.houseNumber ?? NaN;
  const rawFloor = body.floor ?? null;
  const rawDoor = body.door ?? null;

  const result = validateAddress(street, houseNumber, rawFloor, rawDoor);

  if (!result.valid) {
    return {
      statusCode: 200,
      body: {
        eligible: false,
        error: result.error,
        floorDoorRequired: false,
        apartmentKey: null,
      },
    };
  }

  const { floor, door } = effectiveFloorDoor(houseNumber, rawFloor, rawDoor);

  return {
    statusCode: 200,
    body: {
      eligible: true,
      error: null,
      floorDoorRequired: isFloorDoorRequired(houseNumber),
      apartmentKey: normalizeApartmentKey(street, houseNumber, floor, door),
    },
  };
}

export async function handleValidateRegistration(ctx: RequestContext): Promise<RouteResponse> {
  const body = ctx.body as Partial<RegistrationInput> | undefined;
  if (!body) {
    throw badRequest("Request body is required");
  }

  const result = validateRegistrationInput(body);

  if (!result.valid) {
    return {
      statusCode: 422,
      body: { valid: false, errors: result.errors },
    };
  }

  const { floor, door } = effectiveFloorDoor(
    body.houseNumber!,
    body.floor,
    body.door,
  );

  return {
    statusCode: 200,
    body: {
      valid: true,
      errors: {},
      apartmentKey: normalizeApartmentKey(
        body.street!,
        body.houseNumber!,
        floor,
        door,
      ),
      floorDoorRequired: isFloorDoorRequired(body.houseNumber!),
    },
  };
}

interface RegisterBody extends RegistrationInput {
  confirmSwitch?: boolean;
}

export async function handlePublicRegister(ctx: RequestContext): Promise<RouteResponse> {
  const body = ctx.body as RegisterBody | undefined;
  if (!body) {
    throw badRequest("Request body is required");
  }

  const validation = validateRegistrationInput(body);
  if (!validation.valid) {
    return { statusCode: 422, body: { valid: false, errors: validation.errors } };
  }

  const settings = await ctx.db
    .selectFrom("system_settings")
    .select(["opening_datetime"])
    .executeTakeFirst();

  const openingDate = settings?.opening_datetime
    ? new Date(settings.opening_datetime)
    : null;
  const isOpen = openingDate ? openingDate.getTime() <= Date.now() : false;

  if (!isOpen) {
    throw badRequest("Registration is not yet open");
  }

  const { floor, door } = effectiveFloorDoor(
    body.houseNumber,
    body.floor,
    body.door,
  );

  const apartmentKey = normalizeApartmentKey(
    body.street,
    body.houseNumber,
    floor,
    door,
  );

  const result = await ctx.db.transaction().execute(async (trx) => {
    const table = await trx
      .selectFrom("tables")
      .select(["id", "state"])
      .where("id", "=", body.tableId)
      .forUpdate()
      .executeTakeFirst();

    if (!table) {
      throw badRequest("Table not found");
    }
    if (table.state !== "available") {
      throw conflict("Table is not available", "TABLE_UNAVAILABLE");
    }

    const existingRegs = await trx
      .selectFrom("registrations")
      .select(["id", "table_id", "name", "email", "status"])
      .where("apartment_key", "=", apartmentKey)
      .where("status", "=", "active")
      .forUpdate()
      .execute();

    if (existingRegs.length > 0 && !body.confirmSwitch) {
      // Show the oldest registration (first created) to the user
      const oldest = existingRegs.reduce((a, b) =>
        (a.id < b.id ? a : b),
      );
      return {
        type: "switch_required" as const,
        existingTableId: oldest.table_id,
        existingTableLabel: formatTableLabel(oldest.table_id),
        newTableId: body.tableId,
        newTableLabel: formatTableLabel(body.tableId),
        totalExistingRegistrations: existingRegs.length,
      };
    }

    let switchedReg: typeof existingRegs[number] | undefined;
    if (existingRegs.length > 0) {
      // Replace the oldest registration (deterministic, by earliest id)
      switchedReg = existingRegs.reduce((a, b) =>
        (a.id < b.id ? a : b),
      );

      await trx
        .updateTable("registrations")
        .set({ status: "switched", updated_at: new Date().toISOString() })
        .where("id", "=", switchedReg.id)
        .execute();

      await trx
        .updateTable("tables")
        .set({ state: "available", updated_at: new Date().toISOString() })
        .where("id", "=", switchedReg.table_id)
        .execute();

      await logAuditEvent(trx, {
        actor_type: "public",
        actor_id: null,
        action: "registration_switch",
        entity_type: "registration",
        entity_id: switchedReg.id,
        before: { table_id: switchedReg.table_id, status: "active" },
        after: { table_id: switchedReg.table_id, status: "switched" },
        reason: existingRegs.length > 1
          ? `Replaced oldest of ${existingRegs.length} active registrations for this address`
          : undefined,
      });

      await logAuditEvent(trx, {
        actor_type: "public",
        actor_id: null,
        action: "table_state_change",
        entity_type: "table",
        entity_id: String(switchedReg.table_id),
        before: { state: "occupied" },
        after: { state: "available" },
      });
    }

    const [newReg] = await trx
      .insertInto("registrations")
      .values({
        table_id: body.tableId,
        name: body.name,
        email: body.email,
        street: body.street,
        house_number: body.houseNumber,
        floor,
        door,
        apartment_key: apartmentKey,
        language: body.language,
        status: "active",
      })
      .returning(["id"])
      .execute();

    await trx
      .updateTable("tables")
      .set({ state: "occupied", updated_at: new Date().toISOString() })
      .where("id", "=", body.tableId)
      .execute();

    await logAuditEvent(trx, {
      actor_type: "public",
      actor_id: null,
      action: "registration_create",
      entity_type: "registration",
      entity_id: newReg.id,
      after: {
        table_id: body.tableId,
        apartment_key: apartmentKey,
        status: "active",
      },
    });

    await logAuditEvent(trx, {
      actor_type: "public",
      actor_id: null,
      action: "table_state_change",
      entity_type: "table",
      entity_id: String(body.tableId),
      before: { state: "available" },
      after: { state: "occupied" },
    });

    return {
      type: "created" as const,
      registrationId: newReg.id,
      switchedFromTableId: switchedReg?.table_id,
    };
  });

  if (result.type === "switch_required") {
    return {
      statusCode: 409,
      body: {
        error: "Apartment already has an active registration",
        code: "SWITCH_REQUIRED",
        existingTableId: result.existingTableId,
        existingTableLabel: result.existingTableLabel,
        newTableId: result.newTableId,
        newTableLabel: result.newTableLabel,
      },
    };
  }

  let cancellationUrl: string | undefined;
  try {
    const { token } = await createCancellationToken(ctx.db, {
      registrationId: result.registrationId,
    });
    cancellationUrl = buildCancellationUrl(getPublicWebBaseUrl(), token);
  } catch {
    // A failure to mint the cancellation token should not fail the booking —
    // the resident can still contact organizers to cancel manually.
    cancellationUrl = undefined;
  }

  const emailContent = buildConfirmationEmail({
    recipientName: body.name,
    recipientEmail: body.email,
    language: body.language,
    tableId: body.tableId,
    switchedFromTableId: result.switchedFromTableId,
    cancellationUrl,
  });

  await queueAndSendEmail(ctx.db, {
    recipientEmail: body.email,
    language: body.language,
    subject: emailContent.subject,
    bodyHtml: emailContent.bodyHtml,
  });

  if (result.switchedFromTableId != null) {
    await notifyAdmins(ctx.db, {
      type: "user_switch",
      userName: body.name,
      userEmail: body.email,
      oldTableId: result.switchedFromTableId,
      newTableId: body.tableId,
    });
  } else {
    await notifyAdmins(ctx.db, {
      type: "user_registration",
      userName: body.name,
      userEmail: body.email,
      tableId: body.tableId,
    });
  }

  return {
    statusCode: 200,
    body: {
      registrationId: result.registrationId,
      tableId: body.tableId,
      apartmentKey,
    },
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

export async function handleJoinWaitlist(ctx: RequestContext): Promise<RouteResponse> {
  const body = ctx.body as Partial<WaitlistInput> | undefined;
  if (!body) {
    throw badRequest("Request body is required");
  }

  const validation = validateWaitlistInput(body);
  if (!validation.valid) {
    return {
      statusCode: 422,
      body: { valid: false, errors: validation.errors },
    };
  }

  const { floor, door } = effectiveFloorDoor(
    body.houseNumber!,
    body.floor,
    body.door,
  );

  const apartmentKey = normalizeApartmentKey(
    body.street!,
    body.houseNumber!,
    floor,
    door,
  );

  // One-table-per-apartment rule: if this apartment already holds an active
  // booking, block the waitlist signup. Checked before TABLES_AVAILABLE so the
  // user gets the specific reason even when free tables also exist.
  const existingRegistration = await ctx.db
    .selectFrom("registrations")
    .select("id")
    .where("apartment_key", "=", apartmentKey)
    .where("status", "=", "active")
    .executeTakeFirst();

  if (existingRegistration) {
    throw conflict(
      "This apartment already has a table. Only one table per apartment is allowed.",
      "APARTMENT_HAS_REGISTRATION",
    );
  }

  const availableCount = await ctx.db
    .selectFrom("tables")
    .select(ctx.db.fn.countAll<number>().as("count"))
    .where("state", "=", "available")
    .executeTakeFirstOrThrow();

  if (Number(availableCount.count) > 0) {
    throw badRequest(
      "Tables are still available. Please register for a table instead.",
      "TABLES_AVAILABLE",
    );
  }

  const existing = await ctx.db
    .selectFrom("waitlist_entries")
    .select(["id", "created_at"])
    .where("apartment_key", "=", apartmentKey)
    .where("status", "=", "waiting")
    .executeTakeFirst();

  if (existing) {
    await logAuditEvent(ctx.db, {
      actor_type: "public",
      actor_id: null,
      action: "waitlist_reorder_preserve",
      entity_type: "waitlist_entry",
      entity_id: existing.id,
      before: { apartment_key: apartmentKey, created_at: existing.created_at },
      after: { apartment_key: apartmentKey, created_at: existing.created_at },
    });

    const position = await getWaitlistPosition(ctx, apartmentKey);

    // The existence check and position lookup are independent reads, so an
    // admin remove/assign in between can leave `existing` set while the
    // position lookup finds nothing. Surface the post-race state ("not on
    // waitlist anymore") instead of leaking the original entry's stale
    // timestamp alongside a missing position.
    if (position === null) {
      return {
        statusCode: 200,
        body: { alreadyOnWaitlist: false, position: null },
      };
    }

    return {
      statusCode: 200,
      body: {
        alreadyOnWaitlist: true,
        position,
        joinedAt: new Date(existing.created_at).toISOString(),
      },
    };
  }

  let entryId: string;
  try {
    entryId = await ctx.db.transaction().execute(async (trx) => {
      const entry = await trx
        .insertInto("waitlist_entries")
        .values({
          name: body.name!,
          email: body.email!,
          street: body.street!,
          house_number: body.houseNumber!,
          floor,
          door,
          apartment_key: apartmentKey,
          language: body.language!,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await logAuditEvent(trx, {
        actor_type: "public",
        actor_id: null,
        action: "waitlist_add",
        entity_type: "waitlist_entry",
        entity_id: entry.id,
        after: { email: body.email!, apartmentKey },
      });

      return entry.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict(
        "This apartment is already on the waitlist",
        "ALREADY_ON_WAITLIST",
      );
    }
    throw err;
  }

  const position = await getWaitlistPosition(ctx, apartmentKey);

  // Position is read outside the insert transaction, so an admin can
  // remove or assign the just-inserted entry before this read completes.
  // When that happens, skip the confirmation email — its position field
  // would mislead the resident — and surface a null position to the
  // client. The entry was created, so we still return 201.
  if (position !== null) {
    try {
      const email = buildWaitlistJoinConfirmationEmail({
        recipientName: body.name!,
        recipientEmail: body.email!,
        language: body.language!,
        position,
      });

      await queueAndSendEmail(ctx.db, {
        recipientEmail: body.email!,
        language: body.language!,
        subject: email.subject,
        bodyHtml: email.bodyHtml,
      });
    } catch (err) {
      // The signup itself succeeded; the email is best-effort and must not
      // surface a failure to the resident.
      logger.error("Failed to send waitlist signup confirmation email", err);
    }
  }

  return {
    statusCode: 201,
    body: {
      alreadyOnWaitlist: false,
      waitlistEntryId: entryId,
      position,
    },
  };
}

// Returns a 1-based, user-facing FIFO position. The first person in line is
// `#1`, never `#0`. Returns `null` when the apartment is not currently
// waiting (entry missing, or removed/assigned between caller reads), so the
// position-0 sentinel never escapes this function's contract.
async function getWaitlistPosition(
  ctx: RequestContext,
  apartmentKey: string,
): Promise<number | null> {
  const entry = await ctx.db
    .selectFrom("waitlist_entries")
    .select(["created_at"])
    .where("apartment_key", "=", apartmentKey)
    .where("status", "=", "waiting")
    .executeTakeFirst();

  if (!entry) return null;

  const result = await ctx.db
    .selectFrom("waitlist_entries")
    .select(ctx.db.fn.countAll<number>().as("ahead"))
    .where("status", "=", "waiting")
    .where("created_at", "<", entry.created_at)
    .executeTakeFirstOrThrow();

  return Number(result.ahead) + 1;
}

export async function handleWaitlistPosition(ctx: RequestContext): Promise<RouteResponse> {
  const apartmentKey = decodeURIComponent(ctx.params["apartmentKey"] ?? "");
  if (!apartmentKey) {
    throw badRequest("Apartment key is required");
  }

  const entry = await ctx.db
    .selectFrom("waitlist_entries")
    .select(["id", "created_at"])
    .where("apartment_key", "=", apartmentKey)
    .where("status", "=", "waiting")
    .executeTakeFirst();

  if (!entry) {
    return {
      statusCode: 200,
      body: { onWaitlist: false, position: null },
    };
  }

  const position = await getWaitlistPosition(ctx, apartmentKey);

  // The two reads above run outside a transaction, so an admin
  // remove/assign between them can leave `entry` set while the position
  // lookup finds nothing. Collapse that race into the no-entry response
  // shape.
  if (position === null) {
    return {
      statusCode: 200,
      body: { onWaitlist: false, position: null },
    };
  }

  return {
    statusCode: 200,
    body: {
      onWaitlist: true,
      position,
      joinedAt: new Date(entry.created_at).toISOString(),
    },
  };
}

/**
 * Return a minimal summary of the booking tied to a resident cancellation
 * token. Deliberately limited: table label, a masked first-name hint, and
 * language. Does not consume the token. Single generic 404 message is used
 * for unknown/expired/consumed tokens so callers cannot enumerate state.
 */
export async function handleCancellationInfo(ctx: RequestContext): Promise<RouteResponse> {
  const token = safeDecodeToken(ctx.params["token"]);
  if (!token) {
    throw badRequest("Cancellation token is required");
  }

  const resolved = await resolveCancellationToken(ctx.db, token);
  if (!resolved) {
    throw notFound("This cancellation link is no longer valid.");
  }

  const reg = await ctx.db
    .selectFrom("registrations")
    .select(["id", "table_id", "name", "email", "language", "status"])
    .where("id", "=", resolved.registrationId)
    .executeTakeFirst();

  if (!reg) {
    throw notFound("This cancellation link is no longer valid.");
  }

  if (reg.status !== "active") {
    return {
      statusCode: 200,
      body: {
        alreadyCancelled: true,
        tableId: reg.table_id,
        tableLabel: formatTableLabel(reg.table_id),
        language: reg.language,
      },
    };
  }

  return {
    statusCode: 200,
    body: {
      alreadyCancelled: false,
      tableId: reg.table_id,
      tableLabel: formatTableLabel(reg.table_id),
      recipientNameHint: maskName(reg.name),
      language: reg.language,
      expiresAt: resolved.expiresAt.toISOString(),
    },
  };
}

/**
 * Confirm a resident cancellation. Consumes the token, moves the registration
 * to `removed`, and parks the table in `reserved` (awaiting admin review) so
 * admins choose whether to release it publicly.
 */
export async function handleCancellationConfirm(ctx: RequestContext): Promise<RouteResponse> {
  const token = safeDecodeToken(ctx.params["token"]);
  if (!token) {
    throw badRequest("Cancellation token is required");
  }

  const resolved = await resolveCancellationToken(ctx.db, token);
  if (!resolved) {
    throw notFound("This cancellation link is no longer valid.");
  }

  const outcome = await ctx.db.transaction().execute(async (trx) => {
    const consumed = await consumeCancellationToken(trx, resolved.id);
    if (!consumed) {
      return { type: "invalid_token" as const };
    }

    const reg = await trx
      .selectFrom("registrations")
      .select(["id", "table_id", "name", "email", "language", "status"])
      .where("id", "=", resolved.registrationId)
      .forUpdate()
      .executeTakeFirst();

    if (!reg || reg.status !== "active") {
      return { type: "no_active_registration" as const, tableId: reg?.table_id };
    }

    // Lock the table row so concurrent admin moves/reserves can't race with
    // the cancellation and leave the table in an inconsistent state.
    await trx
      .selectFrom("tables")
      .select(["id", "state"])
      .where("id", "=", reg.table_id)
      .forUpdate()
      .executeTakeFirst();

    await trx
      .updateTable("registrations")
      .set({ status: "removed", updated_at: new Date().toISOString() })
      .where("id", "=", reg.id)
      .execute();

    await trx
      .updateTable("tables")
      .set({
        state: "reserved",
        reserved_label: RESERVED_LABEL_AWAITING_REVIEW,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", reg.table_id)
      .execute();

    await logAuditEvent(trx, {
      actor_type: "public",
      actor_id: null,
      action: "registration_self_cancel",
      entity_type: "registration",
      entity_id: reg.id,
      before: { table_id: reg.table_id, status: "active" },
      after: { status: "removed", source: "magic_link" },
      reason: "Resident self-cancelled via email magic link",
    });

    await logAuditEvent(trx, {
      actor_type: "public",
      actor_id: null,
      action: "table_state_change",
      entity_type: "table",
      entity_id: String(reg.table_id),
      before: { state: "occupied" },
      after: { state: "reserved", reserved_label: RESERVED_LABEL_AWAITING_REVIEW },
      reason: "Held for admin review after resident self-cancellation",
    });

    return {
      type: "cancelled" as const,
      tableId: reg.table_id,
      recipientName: reg.name,
      recipientEmail: reg.email,
      language: reg.language as Language,
    };
  });

  if (outcome.type === "invalid_token") {
    throw notFound("This cancellation link is no longer valid.");
  }

  if (outcome.type === "no_active_registration") {
    return {
      statusCode: 200,
      body: {
        alreadyCancelled: true,
        tableId: outcome.tableId ?? null,
      },
    };
  }

  try {
    const email = buildCancellationConfirmationEmail({
      recipientName: outcome.recipientName,
      recipientEmail: outcome.recipientEmail,
      language: outcome.language,
      tableId: outcome.tableId,
    });

    await queueAndSendEmail(ctx.db, {
      recipientEmail: outcome.recipientEmail,
      language: outcome.language,
      subject: email.subject,
      bodyHtml: email.bodyHtml,
    });
  } catch (err) {
    // The cancellation itself succeeded; the confirmation email is best-effort
    // and must not surface a failure to the resident.
    logger.error("Failed to send cancellation confirmation email", err);
  }

  await notifyAdmins(ctx.db, {
    type: "user_cancellation",
    userName: outcome.recipientName,
    userEmail: outcome.recipientEmail,
    tableId: outcome.tableId,
  });

  return {
    statusCode: 200,
    body: {
      cancelled: true,
      tableId: outcome.tableId,
      tableLabel: formatTableLabel(outcome.tableId),
    },
  };
}

/**
 * Safely decode a URL path segment that carries the cancellation token.
 * `decodeURIComponent` throws `URIError` on malformed percent-encoding, so we
 * catch that and return null — callers treat null the same as "no token".
 */
function safeDecodeToken(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

/** Fixed length of the hidden portion in masked names rendered on the
 * cancellation page. A constant length avoids leaking the actual name
 * length through the rendered mask. */
const MASKED_NAME_HIDDEN_LENGTH = 5;

/**
 * Mask a personal name so the cancellation preview can confirm identity
 * without leaking the full name to anyone who intercepts the link. Keeps
 * the first character of every space-separated part and pads each part's
 * hidden portion to a fixed length, so the rendered mask never reveals
 * the real length of any individual name part. The empty-name branch is
 * deliberately unreachable for valid registrations (name is required
 * upstream); it is preserved as a length-preserving fallback so an empty
 * input still does not leak.
 */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 0);
  if (parts.length === 0) {
    return "•".repeat(MASKED_NAME_HIDDEN_LENGTH);
  }
  return parts
    .map((part) => `${part.charAt(0)}${"•".repeat(MASKED_NAME_HIDDEN_LENGTH)}`)
    .join(" ");
}
