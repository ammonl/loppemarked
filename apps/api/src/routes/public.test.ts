import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { RequestContext } from "../router.js";
import { AppError } from "../lib/errors.js";
import { setSesClient } from "../lib/email-service.js";

vi.mock("../lib/admin-ops-notifications.js", () => ({
  notifyAdmins: vi.fn().mockResolvedValue(undefined),
}));
import {
  handleCancellationConfirm,
  handleCancellationInfo,
  handleJoinWaitlist,
  handlePublicBoxes,
  handlePublicGreenhouses,
  handlePublicRegister,
  handlePublicStatus,
  handleValidateAddress,
  handleValidateRegistration,
  handleWaitlistPosition,
  maskName,
} from "./public.js";
import { hashCancellationToken } from "../lib/cancellation-tokens.js";

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    db: {} as Kysely<Database>,
    method: "POST",
    path: "/public/validate-address",
    body: undefined,
    headers: {},
    params: {},
    ...overrides,
  };
}

describe("handlePublicStatus — server-authoritative time gate", () => {
  function makeMockDbForStatus(openingDatetime: Date | null, availableCount: number) {
    const settingsResult = openingDatetime
      ? { opening_datetime: openingDatetime }
      : undefined;

    const executeTakeFirstFn = vi.fn().mockResolvedValue(settingsResult);
    const selectFn = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });

    const countExecuteFn = vi.fn().mockResolvedValue({ count: availableCount });
    const asFn = vi.fn().mockReturnValue("count");
    const countAllFn = vi.fn().mockReturnValue({ as: asFn });
    const whereFn = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: countExecuteFn });
    const countSelectFn = vi.fn().mockReturnValue({ where: whereFn });

    return {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "system_settings") {
          return { select: selectFn };
        }
        if (table === "planter_boxes") {
          return { select: countSelectFn };
        }
        return {};
      }),
      fn: { countAll: countAllFn },
    } as unknown as Kysely<Database>;
  }

  it("returns isOpen false when opening is in the future", async () => {
    const futureDate = new Date(Date.now() + 86_400_000);
    const mockDb = makeMockDbForStatus(futureDate, 5);

    const res = await handlePublicStatus(makeCtx({ db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.isOpen).toBe(false);
    expect(body.openingDatetime).toBe(futureDate.toISOString());
    expect(body.hasAvailableBoxes).toBe(true);
  });

  it("returns isOpen true when opening is in the past", async () => {
    const pastDate = new Date(Date.now() - 86_400_000);
    const mockDb = makeMockDbForStatus(pastDate, 3);

    const res = await handlePublicStatus(makeCtx({ db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.isOpen).toBe(true);
    expect(body.openingDatetime).toBe(pastDate.toISOString());
  });

  it("returns isOpen false when no settings exist", async () => {
    const mockDb = makeMockDbForStatus(null, 0);

    const res = await handlePublicStatus(makeCtx({ db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.isOpen).toBe(false);
    expect(body.openingDatetime).toBeNull();
    expect(body.hasAvailableBoxes).toBe(false);
  });

  it("includes serverTime in response", async () => {
    const pastDate = new Date(Date.now() - 86_400_000);
    const mockDb = makeMockDbForStatus(pastDate, 1);

    const before = Date.now();
    const res = await handlePublicStatus(makeCtx({ db: mockDb }));
    const after = Date.now();

    const body = res.body as Record<string, unknown>;
    expect(body.serverTime).toBeDefined();
    const serverTime = new Date(body.serverTime as string).getTime();
    expect(serverTime).toBeGreaterThanOrEqual(before);
    expect(serverTime).toBeLessThanOrEqual(after);
  });

  it("returns isOpen true at exact opening boundary (opening <= now)", async () => {
    vi.useFakeTimers();
    const openingMs = Date.UTC(2026, 3, 1, 8, 0, 0);
    vi.setSystemTime(openingMs);

    const openingDate = new Date(openingMs);
    const mockDb = makeMockDbForStatus(openingDate, 5);

    const res = await handlePublicStatus(makeCtx({ db: mockDb }));
    const body = res.body as Record<string, unknown>;
    expect(body.isOpen).toBe(true);

    vi.useRealTimers();
  });

  it("returns isOpen false 1ms before opening boundary", async () => {
    vi.useFakeTimers();
    const openingMs = Date.UTC(2026, 3, 1, 8, 0, 0);
    vi.setSystemTime(openingMs - 1);

    const openingDate = new Date(openingMs);
    const mockDb = makeMockDbForStatus(openingDate, 5);

    const res = await handlePublicStatus(makeCtx({ db: mockDb }));
    const body = res.body as Record<string, unknown>;
    expect(body.isOpen).toBe(false);

    vi.useRealTimers();
  });

  it("uses server Date.now() not client-provided time", async () => {
    vi.useFakeTimers();
    const openingMs = Date.UTC(2026, 3, 1, 8, 0, 0);
    vi.setSystemTime(openingMs - 60_000);

    const openingDate = new Date(openingMs);
    const mockDb = makeMockDbForStatus(openingDate, 5);

    const res = await handlePublicStatus(makeCtx({ db: mockDb }));
    const body = res.body as Record<string, unknown>;
    expect(body.isOpen).toBe(false);

    vi.setSystemTime(openingMs + 60_000);
    const res2 = await handlePublicStatus(makeCtx({ db: mockDb }));
    const body2 = res2.body as Record<string, unknown>;
    expect(body2.isOpen).toBe(true);

    vi.useRealTimers();
  });

  it("hasAvailableBoxes reflects real count", async () => {
    const pastDate = new Date(Date.now() - 86_400_000);

    const noBoxesDb = makeMockDbForStatus(pastDate, 0);
    const res1 = await handlePublicStatus(makeCtx({ db: noBoxesDb }));
    expect((res1.body as Record<string, unknown>).hasAvailableBoxes).toBe(false);

    const someBoxesDb = makeMockDbForStatus(pastDate, 3);
    const res2 = await handlePublicStatus(makeCtx({ db: someBoxesDb }));
    expect((res2.body as Record<string, unknown>).hasAvailableBoxes).toBe(true);
  });
});

describe("handlePublicRegister — server time gate boundary", () => {
  const validRegBody = {
    name: "Alice",
    email: "alice@example.com",
    street: "Else Alfelts Vej",
    houseNumber: 130,
    floor: null,
    door: null,
    boxId: 1,
    language: "da",
  };

  beforeEach(() => {
    const mockSes = { send: vi.fn().mockResolvedValue({}) };
    setSesClient(mockSes as never);
  });

  it("rejects registration 1ms before opening", async () => {
    vi.useFakeTimers();
    const openingMs = Date.UTC(2026, 3, 1, 8, 0, 0);
    vi.setSystemTime(openingMs - 1);

    const openingDate = new Date(openingMs);
    const executeTakeFirstFn = vi.fn().mockResolvedValue({
      opening_datetime: openingDate,
    });
    const selectFn = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    try {
      await handlePublicRegister(makeCtx({ db: mockDb, body: validRegBody }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("Registration is not yet open");
    }

    vi.useRealTimers();
  });

  it("accepts registration at exact opening time", async () => {
    vi.useFakeTimers();
    const openingMs = Date.UTC(2026, 3, 1, 8, 0, 0);
    vi.setSystemTime(openingMs);

    const pastDate = new Date(openingMs);
    const mockDb = makeMockDbForRegister({
      openingDatetime: pastDate,
      box: { id: 1, state: "available" },
      existingReg: undefined,
      newRegId: "reg-boundary",
    });

    const res = await handlePublicRegister(makeCtx({ db: mockDb, body: validRegBody }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.registrationId).toBe("reg-boundary");

    vi.useRealTimers();
  });
});

describe("handleValidateAddress", () => {
  it("returns eligible for a valid address", async () => {
    const res = await handleValidateAddress(
      makeCtx({
        body: { street: "Else Alfelts Vej", houseNumber: 130, floor: null, door: null },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.eligible).toBe(true);
    expect(body.error).toBeNull();
    expect(body.apartmentKey).toBe("else alfelts vej 130");
  });

  it("returns eligible with floor/door info for apartment addresses", async () => {
    const res = await handleValidateAddress(
      makeCtx({
        body: { street: "Else Alfelts Vej", houseNumber: 170, floor: "2", door: "th" },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.eligible).toBe(true);
    expect(body.floorDoorRequired).toBe(true);
    expect(body.apartmentKey).toBe("else alfelts vej 170/2-th");
  });

  it("returns not eligible for invalid street", async () => {
    const res = await handleValidateAddress(
      makeCtx({
        body: { street: "Main Street", houseNumber: 130, floor: null, door: null },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.eligible).toBe(false);
    expect(body.error).toBeDefined();
  });

  it("returns not eligible for out-of-range house number", async () => {
    const res = await handleValidateAddress(
      makeCtx({
        body: { street: "Else Alfelts Vej", houseNumber: 50, floor: null, door: null },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.eligible).toBe(false);
  });

  it("throws badRequest when body is missing", async () => {
    try {
      await handleValidateAddress(makeCtx({ body: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });
});

describe("handleValidateRegistration", () => {
  const validBody = {
    name: "Alice",
    email: "alice@example.com",
    street: "Else Alfelts Vej",
    houseNumber: 130,
    floor: null,
    door: null,
    boxId: 1,
    language: "da",
  };

  it("returns valid for complete input", async () => {
    const res = await handleValidateRegistration(makeCtx({ body: validBody }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.valid).toBe(true);
    expect(body.apartmentKey).toBe("else alfelts vej 130");
  });

  it("returns 422 with errors for empty input", async () => {
    const res = await handleValidateRegistration(makeCtx({ body: {} }));
    expect(res.statusCode).toBe(422);
    const body = res.body as Record<string, unknown>;
    expect(body.valid).toBe(false);
    const errors = body.errors as Record<string, string>;
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });

  it("returns floorDoorRequired info", async () => {
    const res = await handleValidateRegistration(
      makeCtx({
        body: { ...validBody, houseNumber: 170, floor: "2", door: "th" },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.floorDoorRequired).toBe(true);
  });

  it("throws badRequest when body is missing", async () => {
    try {
      await handleValidateRegistration(makeCtx({ body: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });
});

describe("handlePublicRegister", () => {
  const validRegBody = {
    name: "Alice",
    email: "alice@example.com",
    street: "Else Alfelts Vej",
    houseNumber: 130,
    floor: null,
    door: null,
    boxId: 1,
    language: "da",
  };

  beforeEach(() => {
    const mockSes = { send: vi.fn().mockResolvedValue({}) };
    setSesClient(mockSes as never);
  });

  it("throws badRequest when body is missing", async () => {
    try {
      await handlePublicRegister(makeCtx({ body: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("returns 422 for invalid input", async () => {
    const res = await handlePublicRegister(makeCtx({ body: {} }));
    expect(res.statusCode).toBe(422);
    const body = res.body as Record<string, unknown>;
    expect(body.valid).toBe(false);
  });

  it("throws badRequest when registration is not open", async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const executeTakeFirstFn = vi.fn().mockResolvedValue({
      opening_datetime: futureDate,
    });
    const selectFn = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    try {
      await handlePublicRegister(makeCtx({ db: mockDb, body: validRegBody }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("Registration is not yet open");
    }
  });

  it("throws badRequest when box not found", async () => {
    const pastDate = new Date(Date.now() - 86400000);
    const mockDb = makeMockDbForRegister({
      openingDatetime: pastDate,
      box: undefined,
    });

    try {
      await handlePublicRegister(makeCtx({ db: mockDb, body: validRegBody }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).message).toBe("Box not found");
    }
  });

  it("throws 409 when box is not available", async () => {
    const pastDate = new Date(Date.now() - 86400000);
    const mockDb = makeMockDbForRegister({
      openingDatetime: pastDate,
      box: { id: 1, state: "occupied" },
    });

    try {
      await handlePublicRegister(makeCtx({ db: mockDb, body: validRegBody }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).code).toBe("BOX_UNAVAILABLE");
    }
  });

  it("returns 409 with switch details when apartment has existing registration and no confirmSwitch", async () => {
    const pastDate = new Date(Date.now() - 86400000);
    const mockDb = makeMockDbForRegister({
      openingDatetime: pastDate,
      box: { id: 1, state: "available" },
      existingReg: { id: "reg-old", box_id: 5, name: "Alice", email: "a@b.com", status: "active" },
    });

    const res = await handlePublicRegister(makeCtx({ db: mockDb, body: validRegBody }));
    expect(res.statusCode).toBe(409);
    const body = res.body as Record<string, unknown>;
    expect(body.code).toBe("SWITCH_REQUIRED");
    expect(body.existingBoxId).toBe(5);
    expect(body.existingBoxName).toBe("Daisy");
    expect(body.existingGreenhouse).toBe("Kronen");
    expect(body.newBoxId).toBe(1);
    expect(body.newBoxName).toBe("Linaria");
    expect(body.newGreenhouse).toBe("Kronen");
  });

  it("creates registration for new apartment (no existing)", async () => {
    const pastDate = new Date(Date.now() - 86400000);
    const mockDb = makeMockDbForRegister({
      openingDatetime: pastDate,
      box: { id: 1, state: "available" },
      existingReg: undefined,
      newRegId: "reg-new",
    });

    const res = await handlePublicRegister(makeCtx({ db: mockDb, body: validRegBody }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.registrationId).toBe("reg-new");
    expect(body.boxId).toBe(1);
    expect(body.apartmentKey).toBe("else alfelts vej 130");
  });

  it("performs switch when confirmSwitch is true", async () => {
    const pastDate = new Date(Date.now() - 86400000);
    const mockDb = makeMockDbForRegister({
      openingDatetime: pastDate,
      box: { id: 1, state: "available" },
      existingReg: { id: "reg-old", box_id: 5, name: "Alice", email: "a@b.com", status: "active" },
      newRegId: "reg-new",
    });

    const res = await handlePublicRegister(
      makeCtx({ db: mockDb, body: { ...validRegBody, confirmSwitch: true } }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.registrationId).toBe("reg-new");
    expect(body.boxId).toBe(1);
  });
});

describe("handleJoinWaitlist", () => {
  const validWaitlistBody = {
    name: "Alice",
    email: "alice@example.com",
    street: "Else Alfelts Vej",
    houseNumber: 130,
    floor: null,
    door: null,
    language: "da",
    greenhousePreference: "any",
  };

  it("throws badRequest when body is missing", async () => {
    try {
      await handleJoinWaitlist(makeCtx({ body: undefined }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("returns 422 for invalid input", async () => {
    const res = await handleJoinWaitlist(makeCtx({ body: {} }));
    expect(res.statusCode).toBe(422);
    const body = res.body as Record<string, unknown>;
    expect(body.valid).toBe(false);
  });

  it("throws 400 when boxes are still available", async () => {
    const executeTakeFirstOrThrowFn = vi.fn().mockResolvedValue({ count: 5 });
    const asFn = vi.fn().mockReturnValue("count");
    const countAllFn = vi.fn().mockReturnValue({ as: asFn });
    const fnObj = { countAll: countAllFn };
    const whereFn = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: executeTakeFirstOrThrowFn });
    const selectFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn, fn: fnObj } as unknown as Kysely<Database>;

    try {
      await handleJoinWaitlist(makeCtx({ db: mockDb, body: validWaitlistBody }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).code).toBe("BOXES_AVAILABLE");
    }
  });
});

describe("handleJoinWaitlist (happy path)", () => {
  const validWaitlistBody = {
    name: "Alice",
    email: "alice@example.com",
    street: "Else Alfelts Vej",
    houseNumber: 130,
    floor: null,
    door: null,
    language: "da",
    greenhousePreference: "any",
  };

  it("creates a new waitlist entry when no boxes available and apartment not on waitlist", async () => {
    const mockDb = makeMockDbForWaitlist({
      availableCount: 0,
      existingEntry: undefined,
      newEntryId: "wl-1",
      positionEntryCreatedAt: "2026-03-01T10:00:00Z",
      positionCount: 1,
    });

    const res = await handleJoinWaitlist(makeCtx({ db: mockDb, body: validWaitlistBody }));
    expect(res.statusCode).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body.alreadyOnWaitlist).toBe(false);
    expect(body.waitlistEntryId).toBe("wl-1");
    expect(body.position).toBe(1);
  });

  it("returns existing entry when apartment is already on waitlist, preserving original timestamp", async () => {
    const existingCreatedAt = "2026-03-01T08:00:00Z";
    const mockDb = makeMockDbForWaitlist({
      availableCount: 0,
      existingEntry: { id: "wl-existing", created_at: existingCreatedAt },
      positionEntryCreatedAt: existingCreatedAt,
      positionCount: 3,
    });

    const res = await handleJoinWaitlist(makeCtx({ db: mockDb, body: validWaitlistBody }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.alreadyOnWaitlist).toBe(true);
    expect(body.position).toBe(3);
    expect(body.joinedAt).toBe(new Date(existingCreatedAt).toISOString());
  });

  it("logs waitlist_reorder_preserve audit event for duplicate apartment", async () => {
    const existingCreatedAt = "2026-03-01T08:00:00Z";
    const mockDb = makeMockDbForWaitlist({
      availableCount: 0,
      existingEntry: { id: "wl-existing", created_at: existingCreatedAt },
      positionEntryCreatedAt: existingCreatedAt,
      positionCount: 1,
    });

    await handleJoinWaitlist(makeCtx({ db: mockDb, body: validWaitlistBody }));

    const insertCalls = (mockDb.insertInto as ReturnType<typeof vi.fn>).mock.calls;
    const auditCalls = insertCalls.filter(
      (call: string[]) => call[0] === "audit_events",
    );
    expect(auditCalls.length).toBeGreaterThan(0);
  });
});

describe("handleWaitlistPosition", () => {
  it("throws badRequest when apartmentKey param is missing", async () => {
    try {
      await handleWaitlistPosition(makeCtx({ params: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("returns onWaitlist false when no entry found", async () => {
    const executeTakeFirstFn = vi.fn().mockResolvedValue(undefined);
    const whereFn2 = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstFn });
    const whereFn1 = vi.fn().mockReturnValue({ where: whereFn2 });
    const selectFn = vi.fn().mockReturnValue({ where: whereFn1 });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handleWaitlistPosition(
      makeCtx({
        db: mockDb,
        params: { apartmentKey: "else alfelts vej 130" },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.onWaitlist).toBe(false);
    expect(body.position).toBeNull();
  });
});

describe("handlePublicGreenhouses", () => {
  it("returns greenhouse summaries with live box counts", async () => {
    const mockBoxes = [
      { greenhouse_name: "Kronen", state: "available" },
      { greenhouse_name: "Kronen", state: "occupied" },
      { greenhouse_name: "Kronen", state: "available" },
      { greenhouse_name: "Søen", state: "occupied" },
      { greenhouse_name: "Søen", state: "reserved" },
    ];
    const executeFn = vi.fn().mockResolvedValue(mockBoxes);
    const selectFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handlePublicGreenhouses(makeCtx({ db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Array<Record<string, unknown>>;
    expect(body).toHaveLength(2);

    const kronen = body.find((g) => g.name === "Kronen")!;
    expect(kronen.totalBoxes).toBe(3);
    expect(kronen.availableBoxes).toBe(2);
    expect(kronen.occupiedBoxes).toBe(1);
    expect(kronen).not.toHaveProperty("reservedBoxes");

    const soen = body.find((g) => g.name === "Søen")!;
    expect(soen.totalBoxes).toBe(2);
    expect(soen.availableBoxes).toBe(0);
    expect(soen.occupiedBoxes).toBe(2);
  });

  it("returns zero counts when no boxes exist", async () => {
    const executeFn = vi.fn().mockResolvedValue([]);
    const selectFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handlePublicGreenhouses(makeCtx({ db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Array<Record<string, unknown>>;
    for (const gh of body) {
      expect(gh.totalBoxes).toBe(0);
      expect(gh.availableBoxes).toBe(0);
      expect(gh.occupiedBoxes).toBe(0);
      expect(gh).not.toHaveProperty("reservedBoxes");
    }
  });
});

describe("handlePublicBoxes", () => {
  it("returns all boxes with live state", async () => {
    const mockRows = [
      { id: 1, name: "Linaria", greenhouse_name: "Kronen", state: "available" },
      { id: 2, name: "Harebell", greenhouse_name: "Kronen", state: "occupied" },
      { id: 15, name: "Robin", greenhouse_name: "Søen", state: "reserved" },
    ];
    const executeFn = vi.fn().mockResolvedValue(mockRows);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handlePublicBoxes(makeCtx({ db: mockDb }));
    expect(res.statusCode).toBe(200);
    const body = res.body as Array<Record<string, unknown>>;
    expect(body).toHaveLength(3);

    expect(body[0]).toEqual({ id: 1, name: "Linaria", greenhouse: "Kronen", state: "available" });
    expect(body[1]).toEqual({ id: 2, name: "Harebell", greenhouse: "Kronen", state: "occupied" });
    expect(body[2]).toEqual({ id: 15, name: "Robin", greenhouse: "Søen", state: "occupied" });
  });

  it("returns empty array when no boxes exist", async () => {
    const executeFn = vi.fn().mockResolvedValue([]);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handlePublicBoxes(makeCtx({ db: mockDb }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("maps greenhouse_name to greenhouse in response", async () => {
    const mockRows = [
      { id: 1, name: "Linaria", greenhouse_name: "Kronen", state: "occupied" },
    ];
    const executeFn = vi.fn().mockResolvedValue(mockRows);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handlePublicBoxes(makeCtx({ db: mockDb }));
    const body = res.body as Array<Record<string, unknown>>;
    expect(body[0].greenhouse).toBe("Kronen");
    expect(body[0]).not.toHaveProperty("greenhouse_name");
  });
});

describe("stale-state regression", () => {
  it("greenhouses endpoint reflects occupied state after registration", async () => {
    const boxesBeforeReg = [
      { greenhouse_name: "Kronen", state: "available" },
      { greenhouse_name: "Kronen", state: "available" },
    ];
    const executeFn1 = vi.fn().mockResolvedValue(boxesBeforeReg);
    const selectFn1 = vi.fn().mockReturnValue({ execute: executeFn1 });
    const selectFromFn1 = vi.fn().mockReturnValue({ select: selectFn1 });
    const db1 = { selectFrom: selectFromFn1 } as unknown as Kysely<Database>;

    const resBefore = await handlePublicGreenhouses(makeCtx({ db: db1 }));
    const before = (resBefore.body as Array<Record<string, unknown>>).find((g) => g.name === "Kronen")!;
    expect(before.availableBoxes).toBe(2);
    expect(before.occupiedBoxes).toBe(0);

    const boxesAfterReg = [
      { greenhouse_name: "Kronen", state: "available" },
      { greenhouse_name: "Kronen", state: "occupied" },
    ];
    const executeFn2 = vi.fn().mockResolvedValue(boxesAfterReg);
    const selectFn2 = vi.fn().mockReturnValue({ execute: executeFn2 });
    const selectFromFn2 = vi.fn().mockReturnValue({ select: selectFn2 });
    const db2 = { selectFrom: selectFromFn2 } as unknown as Kysely<Database>;

    const resAfter = await handlePublicGreenhouses(makeCtx({ db: db2 }));
    const after = (resAfter.body as Array<Record<string, unknown>>).find((g) => g.name === "Kronen")!;
    expect(after.availableBoxes).toBe(1);
    expect(after.occupiedBoxes).toBe(1);
  });

  it("boxes endpoint reflects state change after switch", async () => {
    const boxesBefore = [
      { id: 1, name: "Linaria", greenhouse_name: "Kronen", state: "occupied" },
      { id: 2, name: "Harebell", greenhouse_name: "Kronen", state: "available" },
    ];
    const exec1 = vi.fn().mockResolvedValue(boxesBefore);
    const order1 = vi.fn().mockReturnValue({ execute: exec1 });
    const sel1 = vi.fn().mockReturnValue({ orderBy: order1 });
    const from1 = vi.fn().mockReturnValue({ select: sel1 });
    const db1 = { selectFrom: from1 } as unknown as Kysely<Database>;

    const resBefore = await handlePublicBoxes(makeCtx({ db: db1 }));
    const before = resBefore.body as Array<Record<string, unknown>>;
    expect(before[0].state).toBe("occupied");
    expect(before[1].state).toBe("available");

    const boxesAfterSwitch = [
      { id: 1, name: "Linaria", greenhouse_name: "Kronen", state: "available" },
      { id: 2, name: "Harebell", greenhouse_name: "Kronen", state: "occupied" },
    ];
    const exec2 = vi.fn().mockResolvedValue(boxesAfterSwitch);
    const order2 = vi.fn().mockReturnValue({ execute: exec2 });
    const sel2 = vi.fn().mockReturnValue({ orderBy: order2 });
    const from2 = vi.fn().mockReturnValue({ select: sel2 });
    const db2 = { selectFrom: from2 } as unknown as Kysely<Database>;

    const resAfter = await handlePublicBoxes(makeCtx({ db: db2 }));
    const after = resAfter.body as Array<Record<string, unknown>>;
    expect(after[0].state).toBe("available");
    expect(after[1].state).toBe("occupied");
  });

  it("boxes endpoint maps reserved state to occupied for public users", async () => {
    const rows = [
      { id: 1, name: "Linaria", greenhouse_name: "Kronen", state: "reserved" },
    ];
    const executeFn = vi.fn().mockResolvedValue(rows);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handlePublicBoxes(makeCtx({ db: mockDb }));
    const body = res.body as Array<Record<string, unknown>>;
    expect(body[0].state).toBe("occupied");
  });
});

describe("role visibility — public endpoints do not expose reserved status or label", () => {
  it("handlePublicBoxes only returns id, name, greenhouse, and state (reserved mapped to occupied)", async () => {
    const mockRows = [
      {
        id: 1,
        name: "Linaria",
        greenhouse_name: "Kronen",
        state: "reserved",
      },
    ];
    const executeFn = vi.fn().mockResolvedValue(mockRows);
    const orderByFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handlePublicBoxes(makeCtx({ db: mockDb }));
    const body = res.body as Array<Record<string, unknown>>;
    const keys = Object.keys(body[0]);
    expect(keys).toEqual(["id", "name", "greenhouse", "state"]);
    expect(body[0].state).toBe("occupied");
    expect(body[0]).not.toHaveProperty("reserved_label");
    expect(body[0]).not.toHaveProperty("adminId");
    expect(body[0]).not.toHaveProperty("email");
  });

  it("handlePublicGreenhouses does not include reservedBoxes field", async () => {
    const mockBoxes = [
      { greenhouse_name: "Kronen", state: "reserved" },
    ];
    const executeFn = vi.fn().mockResolvedValue(mockBoxes);
    const selectFn = vi.fn().mockReturnValue({ execute: executeFn });
    const selectFromFn = vi.fn().mockReturnValue({ select: selectFn });
    const mockDb = { selectFrom: selectFromFn } as unknown as Kysely<Database>;

    const res = await handlePublicGreenhouses(makeCtx({ db: mockDb }));
    const body = res.body as Array<Record<string, unknown>>;
    const kronen = body.find((g) => g.name === "Kronen")!;
    const keys = Object.keys(kronen);
    expect(keys).toEqual([
      "name", "totalBoxes", "availableBoxes", "occupiedBoxes",
    ]);
    expect(kronen.occupiedBoxes).toBe(1);
    expect(kronen).not.toHaveProperty("reservedBoxes");
    expect(kronen).not.toHaveProperty("registrations");
    expect(kronen).not.toHaveProperty("reserved_label");
  });
});

describe("handleJoinWaitlist — FIFO ordering", () => {
  it("returns existing waitlist position when apartment already on waitlist (preserves original timestamp)", async () => {
    const existingEntry = {
      id: "wl-1",
      created_at: "2026-03-01T10:00:00Z",
    };

    let selectCallCount = 0;
    const mockDb = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "planter_boxes") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ count: 0 }),
              }),
            }),
          };
        }
        if (table === "waitlist_entries") {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    executeTakeFirst: vi.fn().mockResolvedValue(existingEntry),
                  }),
                }),
              }),
            };
          }
          if (selectCallCount === 2) {
            return {
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    executeTakeFirst: vi.fn().mockResolvedValue({ created_at: "2026-03-01T10:00:00Z" }),
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ position: 2 }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
      fn: {
        countAll: vi.fn().mockReturnValue({ as: vi.fn().mockReturnValue("position") }),
      },
      insertInto: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      })),
    } as unknown as Kysely<Database>;

    const res = await handleJoinWaitlist(
      makeCtx({
        db: mockDb,
        body: {
          name: "Alice",
          email: "alice@example.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "da",
          greenhousePreference: "any",
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.alreadyOnWaitlist).toBe(true);
    expect(body.position).toBe(2);
    expect(body.joinedAt).toBe(new Date("2026-03-01T10:00:00Z").toISOString());
  });

  it("returns position based on FIFO ordering after new join", async () => {
    let selectCallCount = 0;
    const mockDb = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "planter_boxes") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ count: 0 }),
              }),
            }),
          };
        }
        if (table === "waitlist_entries") {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    executeTakeFirst: vi.fn().mockResolvedValue(undefined),
                  }),
                }),
              }),
            };
          }
          if (selectCallCount === 2) {
            return {
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    executeTakeFirst: vi.fn().mockResolvedValue({ created_at: "2026-03-01T10:00:00Z" }),
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ position: 2 }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
      fn: {
        countAll: vi.fn().mockReturnValue({ as: vi.fn().mockReturnValue("position") }),
      },
      transaction: vi.fn().mockReturnValue({
        execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
          const trx = {
            insertInto: vi.fn().mockImplementation(() => ({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockReturnValue({
                  executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: "wl-new" }),
                }),
                execute: vi.fn().mockResolvedValue(undefined),
              }),
            })),
          };
          return fn(trx);
        }),
      }),
    } as unknown as Kysely<Database>;

    const res = await handleJoinWaitlist(
      makeCtx({
        db: mockDb,
        body: {
          name: "Bob",
          email: "bob@example.com",
          street: "Else Alfelts Vej",
          houseNumber: 130,
          language: "en",
          greenhousePreference: "any",
        },
      }),
    );

    expect(res.statusCode).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body.alreadyOnWaitlist).toBe(false);
    expect(body.waitlistEntryId).toBe("wl-new");
    expect(body.position).toBe(2);
  });
});

describe("handleWaitlistPosition — returns FIFO position", () => {
  it("returns correct position based on created_at ordering", async () => {
    const mockEntry = {
      id: "wl-2",
      created_at: "2026-03-02T10:00:00Z",
    };

    let selectCallCount = 0;
    const mockDb = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "waitlist_entries") {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    executeTakeFirst: vi.fn().mockResolvedValue(mockEntry),
                  }),
                }),
              }),
            };
          }
          if (selectCallCount === 2) {
            return {
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    executeTakeFirst: vi.fn().mockResolvedValue({ created_at: "2026-03-02T10:00:00Z" }),
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ position: 2 }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
      fn: {
        countAll: vi.fn().mockReturnValue({ as: vi.fn().mockReturnValue("position") }),
      },
    } as unknown as Kysely<Database>;

    const res = await handleWaitlistPosition(
      makeCtx({
        db: mockDb,
        params: { apartmentKey: "else alfelts vej 130" },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.onWaitlist).toBe(true);
    expect(body.position).toBe(2);
  });
});

interface MockRegisterOpts {
  openingDatetime: Date;
  box?: { id: number; state: string };
  existingReg?: { id: string; box_id: number; name: string; email: string; status: string };
  newRegId?: string;
}

function makeMockDbForRegister(opts: MockRegisterOpts): Kysely<Database> {
  const settingsResult = { opening_datetime: opts.openingDatetime };
  const existingRegs = opts.existingReg ? [opts.existingReg] : [];

  const mockTrx = {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "planter_boxes") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(opts.box),
              }),
            }),
          }),
        };
      }
      if (table === "registrations") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                forUpdate: vi.fn().mockReturnValue({
                  execute: vi.fn().mockResolvedValue(existingRegs),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "registrations") {
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([{ id: opts.newRegId ?? "reg-id" }]),
            }),
          }),
        };
      }
      if (table === "audit_events") {
        return {
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        };
      }
      return {};
    }),
  };

  return {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "system_settings") {
        return {
          select: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue(settingsResult),
          }),
        };
      }
      return {};
    }),
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "emails") {
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([{ id: "email-1" }]),
            }),
          }),
        };
      }
      if (table === "audit_events") {
        return {
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        };
      }
      return {};
    }),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
  } as unknown as Kysely<Database>;
}

interface MockWaitlistOpts {
  availableCount: number;
  existingEntry?: { id: string; created_at: string };
  newEntryId?: string;
  positionEntryCreatedAt?: string;
  positionCount?: number;
}

function makeMockDbForWaitlist(opts: MockWaitlistOpts): Kysely<Database> {
  let waitlistCallNum = 0;

  const mockTrx = {
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "waitlist_entries") {
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
                id: opts.newEntryId ?? "wl-id",
              }),
            }),
          }),
        };
      }
      if (table === "audit_events") {
        return {
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        };
      }
      return {};
    }),
  };

  const asFn = vi.fn().mockReturnValue("position");
  const countAllFn = vi.fn().mockReturnValue({ as: asFn });
  const fnObj = { countAll: countAllFn };

  function makeWaitlistSelect() {
    waitlistCallNum++;
    const n = waitlistCallNum;

    // Call 1: check existing entry by apartment_key (executeTakeFirst)
    if (n === 1) {
      return {
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue(opts.existingEntry),
            }),
          }),
        }),
      };
    }

    // Call 2: getWaitlistPosition first query - get entry's created_at (executeTakeFirst)
    if (n === 2) {
      return {
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue(
                opts.positionEntryCreatedAt
                  ? { created_at: opts.positionEntryCreatedAt }
                  : undefined,
              ),
            }),
          }),
        }),
      };
    }

    // Call 3: getWaitlistPosition second query - COUNT (executeTakeFirstOrThrow)
    return {
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
              position: opts.positionCount ?? 0,
            }),
          }),
        }),
      }),
    };
  }

  return {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "planter_boxes") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
                count: opts.availableCount,
              }),
            }),
          }),
        };
      }
      if (table === "waitlist_entries") {
        return makeWaitlistSelect();
      }
      return {};
    }),
    fn: fnObj,
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (fn: (trx: unknown) => Promise<unknown>) => fn(mockTrx),
      ),
    }),
    insertInto: vi.fn().mockImplementation((table: string) => {
      if (table === "audit_events") {
        return {
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined),
          }),
        };
      }
      return {};
    }),
  } as unknown as Kysely<Database>;
}

interface MockCancelTokenRow {
  id: string;
  registration_id: string;
  expires_at: Date;
  consumed_at: Date | null;
}

interface MockRegRow {
  id: string;
  box_id: number;
  name: string;
  email: string;
  language: "da" | "en";
  status: "active" | "switched" | "removed";
}

function makeMockDbForCancellation(opts: {
  tokenRow?: MockCancelTokenRow;
  regRow?: MockRegRow;
  updateNumRows?: number;
}): Kysely<Database> {
  const tokenExecute = vi.fn().mockResolvedValue(opts.tokenRow);
  const regExecute = vi.fn().mockResolvedValue(opts.regRow);

  return {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "registration_cancellation_tokens") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirst: tokenExecute,
            }),
          }),
        };
      }
      if (table === "registrations") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirst: regExecute,
            }),
          }),
        };
      }
      return {};
    }),
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
        const trx = {
          updateTable: vi.fn().mockImplementation((tbl: string) => ({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  executeTakeFirst: vi.fn().mockResolvedValue({
                    numUpdatedRows: tbl === "registration_cancellation_tokens"
                      ? BigInt(opts.updateNumRows ?? 1)
                      : BigInt(1),
                  }),
                }),
                execute: vi.fn().mockResolvedValue(undefined),
              }),
            }),
          })),
          selectFrom: vi.fn().mockImplementation((tbl: string) => {
            if (tbl === "registrations") {
              return {
                select: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    forUpdate: vi.fn().mockReturnValue({
                      executeTakeFirst: vi.fn().mockResolvedValue(opts.regRow),
                    }),
                  }),
                }),
              };
            }
            if (tbl === "planter_boxes") {
              return {
                select: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    forUpdate: vi.fn().mockReturnValue({
                      executeTakeFirst: vi.fn().mockResolvedValue({
                        id: opts.regRow?.box_id,
                        state: "occupied",
                      }),
                    }),
                  }),
                }),
              };
            }
            return {};
          }),
          insertInto: vi.fn().mockImplementation(() => ({
            values: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(undefined),
            }),
          })),
        };
        return fn(trx);
      }),
    }),
  } as unknown as Kysely<Database>;
}

describe("handleCancellationInfo", () => {
  it("throws badRequest when token is missing", async () => {
    try {
      await handleCancellationInfo(makeCtx({ params: {} }));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws badRequest on malformed percent-encoding instead of crashing", async () => {
    try {
      await handleCancellationInfo(
        makeCtx({ params: { token: "%" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("throws 404 for unknown token", async () => {
    const mockDb = makeMockDbForCancellation({ tokenRow: undefined });

    try {
      await handleCancellationInfo(
        makeCtx({ db: mockDb, params: { token: "unknown" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it("throws 404 for expired token", async () => {
    const mockDb = makeMockDbForCancellation({
      tokenRow: {
        id: "tok-1",
        registration_id: "reg-1",
        expires_at: new Date(Date.now() - 1000),
        consumed_at: null,
      },
    });

    try {
      await handleCancellationInfo(
        makeCtx({ db: mockDb, params: { token: "expired" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it("throws 404 for consumed token", async () => {
    const mockDb = makeMockDbForCancellation({
      tokenRow: {
        id: "tok-1",
        registration_id: "reg-1",
        expires_at: new Date(Date.now() + 60000),
        consumed_at: new Date(),
      },
    });

    try {
      await handleCancellationInfo(
        makeCtx({ db: mockDb, params: { token: "used" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it("returns masked name and table label for a valid token on an active booking", async () => {
    const mockDb = makeMockDbForCancellation({
      tokenRow: {
        id: "tok-1",
        registration_id: "reg-1",
        expires_at: new Date(Date.now() + 86_400_000),
        consumed_at: null,
      },
      regRow: {
        id: "reg-1",
        box_id: 3,
        name: "Anna Jensen",
        email: "anna@example.com",
        language: "da",
        status: "active",
      },
    });

    const res = await handleCancellationInfo(
      makeCtx({ db: mockDb, params: { token: "valid" } }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.alreadyCancelled).toBe(false);
    expect(body.boxId).toBe(3);
    expect(body.tableLabel).toContain("#3");
    expect(body.recipientNameHint).toBe("A••••• J•••••");
    expect(body.recipientNameHint).toHaveLength(13);
    expect(body).not.toHaveProperty("tableSizeMeters");
    expect(body).not.toHaveProperty("tableNumber");
  });

  it("masks each name part to a fixed-length per-part mask", async () => {
    const longNameDb = makeMockDbForCancellation({
      tokenRow: {
        id: "tok-1",
        registration_id: "reg-1",
        expires_at: new Date(Date.now() + 86_400_000),
        consumed_at: null,
      },
      regRow: {
        id: "reg-1",
        box_id: 3,
        name: "Bartholomew Featherstonehaugh",
        email: "b@example.com",
        language: "da",
        status: "active",
      },
    });
    const shortNameDb = makeMockDbForCancellation({
      tokenRow: {
        id: "tok-2",
        registration_id: "reg-2",
        expires_at: new Date(Date.now() + 86_400_000),
        consumed_at: null,
      },
      regRow: {
        id: "reg-2",
        box_id: 3,
        name: "Bart Fjord",
        email: "bo@example.com",
        language: "da",
        status: "active",
      },
    });

    const longRes = await handleCancellationInfo(
      makeCtx({ db: longNameDb, params: { token: "valid" } }),
    );
    const shortRes = await handleCancellationInfo(
      makeCtx({ db: shortNameDb, params: { token: "valid" } }),
    );
    const longBody = longRes.body as Record<string, unknown>;
    const shortBody = shortRes.body as Record<string, unknown>;
    expect(longBody.recipientNameHint).toBe("B••••• F•••••");
    expect(shortBody.recipientNameHint).toBe("B••••• F•••••");
  });

  it("flags already-cancelled registrations without exposing identity", async () => {
    const mockDb = makeMockDbForCancellation({
      tokenRow: {
        id: "tok-1",
        registration_id: "reg-1",
        expires_at: new Date(Date.now() + 86_400_000),
        consumed_at: null,
      },
      regRow: {
        id: "reg-1",
        box_id: 3,
        name: "Anna Jensen",
        email: "anna@example.com",
        language: "da",
        status: "removed",
      },
    });

    const res = await handleCancellationInfo(
      makeCtx({ db: mockDb, params: { token: "valid" } }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.alreadyCancelled).toBe(true);
    expect(body).not.toHaveProperty("recipientNameHint");
  });
});

describe("handleCancellationConfirm", () => {
  it("throws 404 for unknown token", async () => {
    const mockDb = makeMockDbForCancellation({ tokenRow: undefined });
    try {
      await handleCancellationConfirm(
        makeCtx({ db: mockDb, params: { token: "unknown" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it("rejects already-consumed token under concurrent use", async () => {
    const mockDb = makeMockDbForCancellation({
      tokenRow: {
        id: "tok-1",
        registration_id: "reg-1",
        expires_at: new Date(Date.now() + 86_400_000),
        consumed_at: null,
      },
      regRow: {
        id: "reg-1",
        box_id: 3,
        name: "Anna Jensen",
        email: "anna@example.com",
        language: "da",
        status: "active",
      },
      updateNumRows: 0,
    });

    try {
      await handleCancellationConfirm(
        makeCtx({ db: mockDb, params: { token: "racing" } }),
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it("returns cancelled outcome for a valid token", async () => {
    const mockDb = makeMockDbForCancellation({
      tokenRow: {
        id: "tok-1",
        registration_id: "reg-1",
        expires_at: new Date(Date.now() + 86_400_000),
        consumed_at: null,
      },
      regRow: {
        id: "reg-1",
        box_id: 3,
        name: "Anna Jensen",
        email: "anna@example.com",
        language: "da",
        status: "active",
      },
    });

    const res = await handleCancellationConfirm(
      makeCtx({ db: mockDb, params: { token: "valid" } }),
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.cancelled).toBe(true);
    expect(body.boxId).toBe(3);
    expect(body.tableLabel).toContain("#3");
  });

  it("hashes tokens deterministically for storage lookup", () => {
    expect(hashCancellationToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("maskName", () => {
  it("masks each name part with a fixed 5-character hidden portion", () => {
    expect(maskName("A")).toBe("A•••••");
    expect(maskName("Bo")).toBe("B•••••");
    expect(maskName("Anna Jensen")).toBe("A••••• J•••••");
    expect(maskName("Bartholomew Featherstonehaugh")).toBe("B••••• F•••••");
    expect(maskName("Anna Marie Jensen")).toBe("A••••• M••••• J•••••");
  });

  it("renders the same per-part mask regardless of how long each part is", () => {
    expect(maskName("Anna Jensen")).toBe("A••••• J•••••");
    expect(maskName("Annabella Jensenovich")).toBe("A••••• J•••••");
    expect(maskName("A J")).toBe("A••••• J•••••");
  });

  it("returns a length-preserving fallback for empty or whitespace-only input", () => {
    expect(maskName("")).toBe("•••••");
    expect(maskName("   ")).toBe("•••••");
    expect(maskName("\t\n")).toBe("•••••");
  });

  it("uses the first character of each space-separated part", () => {
    expect(maskName("Élise Müller")).toBe("É••••• M•••••");
    expect(maskName("  Søren  Kierkegaard  ")).toBe("S••••• K•••••");
  });
});
