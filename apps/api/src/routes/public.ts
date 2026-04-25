import {
  BOX_CATALOG,
  GREENHOUSES,
  RESERVED_LABEL_AWAITING_REVIEW,
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
import { buildConfirmationEmail } from "../lib/email-templates.js";
import { queueAndSendEmail } from "../lib/email-service.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
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
    .selectFrom("planter_boxes")
    .select(ctx.db.fn.countAll<number>().as("count"))
    .where("state", "=", "available")
    .executeTakeFirstOrThrow();

  return {
    statusCode: 200,
    body: {
      isOpen,
      openingDatetime,
      hasAvailableBoxes: Number(availableCount.count) > 0,
      serverTime: new Date().toISOString(),
    },
  };
}

export async function handlePublicGreenhouses(ctx: RequestContext): Promise<RouteResponse> {
  const boxes = await ctx.db
    .selectFrom("planter_boxes")
    .select(["greenhouse_name", "state"])
    .execute();

  const summaries = GREENHOUSES.map((name) => {
    const ghBoxes = boxes.filter((b) => b.greenhouse_name === name);
    return {
      name,
      totalBoxes: ghBoxes.length,
      availableBoxes: ghBoxes.filter((b) => b.state === "available").length,
      occupiedBoxes: ghBoxes.filter((b) => b.state === "occupied" || b.state === "reserved").length,
    };
  });

  return {
    statusCode: 200,
    body: summaries,
  };
}

export async function handlePublicBoxes(ctx: RequestContext): Promise<RouteResponse> {
  const boxes = await ctx.db
    .selectFrom("planter_boxes")
    .select(["id", "name", "greenhouse_name", "state"])
    .orderBy("id", "asc")
    .execute();

  const publicBoxes = boxes.map((b) => ({
    id: b.id,
    name: b.name,
    greenhouse: b.greenhouse_name,
    state: b.state === "reserved" ? "occupied" as const : b.state,
  }));

  return {
    statusCode: 200,
    body: publicBoxes,
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
  const floor = body.floor ?? null;
  const door = body.door ?? null;

  const result = validateAddress(street, houseNumber, floor, door);

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

  return {
    statusCode: 200,
    body: {
      valid: true,
      errors: {},
      apartmentKey: normalizeApartmentKey(
        body.street!,
        body.houseNumber!,
        body.floor ?? null,
        body.door ?? null,
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

  const apartmentKey = normalizeApartmentKey(
    body.street,
    body.houseNumber,
    body.floor ?? null,
    body.door ?? null,
  );

  const result = await ctx.db.transaction().execute(async (trx) => {
    const box = await trx
      .selectFrom("planter_boxes")
      .select(["id", "state"])
      .where("id", "=", body.boxId)
      .forUpdate()
      .executeTakeFirst();

    if (!box) {
      throw badRequest("Box not found");
    }
    if (box.state !== "available") {
      throw conflict("Box is not available", "BOX_UNAVAILABLE");
    }

    const existingRegs = await trx
      .selectFrom("registrations")
      .select(["id", "box_id", "name", "email", "status"])
      .where("apartment_key", "=", apartmentKey)
      .where("status", "=", "active")
      .forUpdate()
      .execute();

    if (existingRegs.length > 0 && !body.confirmSwitch) {
      // Show the oldest registration (first created) to the user
      const oldest = existingRegs.reduce((a, b) =>
        (a.id < b.id ? a : b),
      );
      const existingBox = BOX_CATALOG.find((b) => b.id === oldest.box_id);
      const newBox = BOX_CATALOG.find((b) => b.id === body.boxId);
      return {
        type: "switch_required" as const,
        existingBoxId: oldest.box_id,
        existingBoxName: existingBox?.name ?? `Box ${oldest.box_id}`,
        existingGreenhouse: existingBox?.greenhouse ?? "Unknown",
        newBoxId: body.boxId,
        newBoxName: newBox?.name ?? `Box ${body.boxId}`,
        newGreenhouse: newBox?.greenhouse ?? "Unknown",
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
        .updateTable("planter_boxes")
        .set({ state: "available", updated_at: new Date().toISOString() })
        .where("id", "=", switchedReg.box_id)
        .execute();

      await logAuditEvent(trx, {
        actor_type: "public",
        actor_id: null,
        action: "registration_switch",
        entity_type: "registration",
        entity_id: switchedReg.id,
        before: { box_id: switchedReg.box_id, status: "active" },
        after: { box_id: switchedReg.box_id, status: "switched" },
        reason: existingRegs.length > 1
          ? `Replaced oldest of ${existingRegs.length} active registrations for this address`
          : undefined,
      });

      await logAuditEvent(trx, {
        actor_type: "public",
        actor_id: null,
        action: "box_state_change",
        entity_type: "planter_box",
        entity_id: String(switchedReg.box_id),
        before: { state: "occupied" },
        after: { state: "available" },
      });
    }

    const [newReg] = await trx
      .insertInto("registrations")
      .values({
        box_id: body.boxId,
        name: body.name,
        email: body.email,
        street: body.street,
        house_number: body.houseNumber,
        floor: body.floor ?? null,
        door: body.door ?? null,
        apartment_key: apartmentKey,
        language: body.language,
        status: "active",
      })
      .returning(["id"])
      .execute();

    await trx
      .updateTable("planter_boxes")
      .set({ state: "occupied", updated_at: new Date().toISOString() })
      .where("id", "=", body.boxId)
      .execute();

    await logAuditEvent(trx, {
      actor_type: "public",
      actor_id: null,
      action: "registration_create",
      entity_type: "registration",
      entity_id: newReg.id,
      after: {
        box_id: body.boxId,
        apartment_key: apartmentKey,
        status: "active",
      },
    });

    await logAuditEvent(trx, {
      actor_type: "public",
      actor_id: null,
      action: "box_state_change",
      entity_type: "planter_box",
      entity_id: String(body.boxId),
      before: { state: "available" },
      after: { state: "occupied" },
    });

    return {
      type: "created" as const,
      registrationId: newReg.id,
      switchedFromBoxId: switchedReg?.box_id,
    };
  });

  if (result.type === "switch_required") {
    return {
      statusCode: 409,
      body: {
        error: "Apartment already has an active registration",
        code: "SWITCH_REQUIRED",
        existingBoxId: result.existingBoxId,
        existingBoxName: result.existingBoxName,
        existingGreenhouse: result.existingGreenhouse,
        newBoxId: result.newBoxId,
        newBoxName: result.newBoxName,
        newGreenhouse: result.newGreenhouse,
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
    boxId: body.boxId,
    switchedFromBoxId: result.switchedFromBoxId,
    cancellationUrl,
  });

  await queueAndSendEmail(ctx.db, {
    recipientEmail: body.email,
    language: body.language,
    subject: emailContent.subject,
    bodyHtml: emailContent.bodyHtml,
  });

  if (result.switchedFromBoxId != null) {
    await notifyAdmins(ctx.db, {
      type: "user_switch",
      userName: body.name,
      userEmail: body.email,
      oldBoxId: result.switchedFromBoxId,
      newBoxId: body.boxId,
    });
  } else {
    await notifyAdmins(ctx.db, {
      type: "user_registration",
      userName: body.name,
      userEmail: body.email,
      boxId: body.boxId,
    });
  }

  return {
    statusCode: 200,
    body: {
      registrationId: result.registrationId,
      boxId: body.boxId,
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

  const apartmentKey = normalizeApartmentKey(
    body.street!,
    body.houseNumber!,
    body.floor ?? null,
    body.door ?? null,
  );

  const availableCount = await ctx.db
    .selectFrom("planter_boxes")
    .select(ctx.db.fn.countAll<number>().as("count"))
    .where("state", "=", "available")
    .executeTakeFirstOrThrow();

  if (Number(availableCount.count) > 0) {
    throw badRequest(
      "Boxes are still available. Please register for a box instead.",
      "BOXES_AVAILABLE",
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
          floor: body.floor ?? null,
          door: body.door ?? null,
          apartment_key: apartmentKey,
          language: body.language!,
          greenhouse_preference: body.greenhousePreference!,
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

  return {
    statusCode: 201,
    body: {
      alreadyOnWaitlist: false,
      waitlistEntryId: entryId,
      position,
    },
  };
}

async function getWaitlistPosition(
  ctx: RequestContext,
  apartmentKey: string,
): Promise<number> {
  const entry = await ctx.db
    .selectFrom("waitlist_entries")
    .select(["created_at"])
    .where("apartment_key", "=", apartmentKey)
    .where("status", "=", "waiting")
    .executeTakeFirst();

  if (!entry) return 0;

  const result = await ctx.db
    .selectFrom("waitlist_entries")
    .select(ctx.db.fn.countAll<number>().as("position"))
    .where("status", "=", "waiting")
    .where("created_at", "<=", entry.created_at)
    .executeTakeFirstOrThrow();

  return Number(result.position);
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
    .select(["id", "box_id", "name", "email", "language", "status"])
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
        boxId: reg.box_id,
        tableLabel: formatTableLabel(reg.box_id),
        language: reg.language,
      },
    };
  }

  return {
    statusCode: 200,
    body: {
      alreadyCancelled: false,
      boxId: reg.box_id,
      tableLabel: formatTableLabel(reg.box_id),
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
      .select(["id", "box_id", "name", "email", "language", "status"])
      .where("id", "=", resolved.registrationId)
      .forUpdate()
      .executeTakeFirst();

    if (!reg || reg.status !== "active") {
      return { type: "no_active_registration" as const, boxId: reg?.box_id };
    }

    // Lock the box row so concurrent admin moves/reserves can't race with
    // the cancellation and leave the table in an inconsistent state.
    await trx
      .selectFrom("planter_boxes")
      .select(["id", "state"])
      .where("id", "=", reg.box_id)
      .forUpdate()
      .executeTakeFirst();

    await trx
      .updateTable("registrations")
      .set({ status: "removed", updated_at: new Date().toISOString() })
      .where("id", "=", reg.id)
      .execute();

    await trx
      .updateTable("planter_boxes")
      .set({
        state: "reserved",
        reserved_label: RESERVED_LABEL_AWAITING_REVIEW,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", reg.box_id)
      .execute();

    await logAuditEvent(trx, {
      actor_type: "public",
      actor_id: null,
      action: "registration_self_cancel",
      entity_type: "registration",
      entity_id: reg.id,
      before: { box_id: reg.box_id, status: "active" },
      after: { status: "removed", source: "magic_link" },
      reason: "Resident self-cancelled via email magic link",
    });

    await logAuditEvent(trx, {
      actor_type: "public",
      actor_id: null,
      action: "box_state_change",
      entity_type: "planter_box",
      entity_id: String(reg.box_id),
      before: { state: "occupied" },
      after: { state: "reserved", reserved_label: RESERVED_LABEL_AWAITING_REVIEW },
      reason: "Held for admin review after resident self-cancellation",
    });

    return {
      type: "cancelled" as const,
      boxId: reg.box_id,
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
        boxId: outcome.boxId ?? null,
      },
    };
  }

  await notifyAdmins(ctx.db, {
    type: "user_cancellation",
    userName: outcome.recipientName,
    userEmail: outcome.recipientEmail,
    boxId: outcome.boxId,
  });

  return {
    statusCode: 200,
    body: {
      cancelled: true,
      boxId: outcome.boxId,
      tableLabel: formatTableLabel(outcome.boxId),
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
