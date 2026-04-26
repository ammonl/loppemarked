import { describe, expect, it } from "vitest";
import {
  validateEmail,
  validateStreet,
  validateHouseNumber,
  isFloorDoorRequired,
  validateFloorDoor,
  validateAddress,
  effectiveFloorDoor,
  normalizeApartmentKey,
  formatAddress,
  validateName,
  validateTableId,
  validateLanguage,
  validateRegistrationInput,
  validateWaitlistInput,
} from "./validators.js";

describe("validateEmail", () => {
  it("accepts valid emails", () => {
    expect(validateEmail("user@example.com")).toEqual({ valid: true });
    expect(validateEmail("a.b@c.dk")).toEqual({ valid: true });
  });

  it("rejects empty string", () => {
    expect(validateEmail("").valid).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(validateEmail("   ").valid).toBe(false);
  });

  it("rejects missing @", () => {
    expect(validateEmail("userexample.com").valid).toBe(false);
  });

  it("rejects missing domain", () => {
    expect(validateEmail("user@").valid).toBe(false);
  });
});

describe("validateStreet", () => {
  it("accepts Else Alfelts Vej", () => {
    expect(validateStreet("Else Alfelts Vej")).toEqual({ valid: true });
  });

  it("rejects other streets", () => {
    expect(validateStreet("Main Street").valid).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateStreet("").valid).toBe(false);
  });
});

describe("validateHouseNumber", () => {
  it("accepts numbers in range 122-202", () => {
    expect(validateHouseNumber(122)).toEqual({ valid: true });
    expect(validateHouseNumber(150)).toEqual({ valid: true });
    expect(validateHouseNumber(202)).toEqual({ valid: true });
  });

  it("rejects numbers below range", () => {
    expect(validateHouseNumber(121).valid).toBe(false);
    expect(validateHouseNumber(0).valid).toBe(false);
  });

  it("rejects numbers above range", () => {
    expect(validateHouseNumber(203).valid).toBe(false);
  });

  it("rejects non-integers", () => {
    expect(validateHouseNumber(122.5).valid).toBe(false);
  });
});

describe("isFloorDoorRequired", () => {
  it("returns true for 138", () => {
    expect(isFloorDoorRequired(138)).toBe(true);
  });

  it("returns true for 144", () => {
    expect(isFloorDoorRequired(144)).toBe(true);
  });

  it("returns true for 161-202", () => {
    expect(isFloorDoorRequired(161)).toBe(true);
    expect(isFloorDoorRequired(180)).toBe(true);
    expect(isFloorDoorRequired(202)).toBe(true);
  });

  it("returns false for numbers not requiring floor/door", () => {
    expect(isFloorDoorRequired(122)).toBe(false);
    expect(isFloorDoorRequired(130)).toBe(false);
    expect(isFloorDoorRequired(139)).toBe(false);
    expect(isFloorDoorRequired(160)).toBe(false);
  });
});

describe("validateFloorDoor", () => {
  it("passes when floor/door not required", () => {
    expect(validateFloorDoor(130, null, null)).toEqual({ valid: true });
  });

  it("passes when required and both provided", () => {
    expect(validateFloorDoor(138, "2", "th")).toEqual({ valid: true });
    expect(validateFloorDoor(170, "st", "1")).toEqual({ valid: true });
  });

  it("fails when required but floor missing", () => {
    expect(validateFloorDoor(138, null, "th").valid).toBe(false);
  });

  it("passes when required and floor provided but door missing", () => {
    expect(validateFloorDoor(144, "2", null).valid).toBe(true);
  });

  it("fails when required but both empty strings", () => {
    expect(validateFloorDoor(170, "", "").valid).toBe(false);
  });
});

describe("validateAddress", () => {
  it("accepts a valid full address", () => {
    expect(validateAddress("Else Alfelts Vej", 130, null, null)).toEqual({
      valid: true,
    });
  });

  it("accepts valid address with floor/door", () => {
    expect(validateAddress("Else Alfelts Vej", 170, "2", "th")).toEqual({
      valid: true,
    });
  });

  it("rejects invalid street", () => {
    expect(validateAddress("Other Street", 130, null, null).valid).toBe(false);
  });

  it("rejects invalid house number", () => {
    expect(validateAddress("Else Alfelts Vej", 100, null, null).valid).toBe(
      false,
    );
  });

  it("rejects missing floor/door when required", () => {
    expect(validateAddress("Else Alfelts Vej", 170, null, null).valid).toBe(
      false,
    );
  });
});

describe("effectiveFloorDoor", () => {
  it("drops floor and door for non-floor-required house numbers", () => {
    expect(effectiveFloorDoor(122, "2", "th")).toEqual({ floor: null, door: null });
    expect(effectiveFloorDoor(130, "ST", "TV")).toEqual({ floor: null, door: null });
  });

  it("preserves floor and door for floor-required house numbers", () => {
    expect(effectiveFloorDoor(138, "2", "th")).toEqual({ floor: "2", door: "th" });
    expect(effectiveFloorDoor(170, "ST", null)).toEqual({ floor: "ST", door: null });
  });

  it("normalizes undefined to null", () => {
    expect(effectiveFloorDoor(138, undefined, undefined)).toEqual({
      floor: null,
      door: null,
    });
  });
});

describe("normalizeApartmentKey", () => {
  it("normalizes a simple address", () => {
    expect(normalizeApartmentKey("Else Alfelts Vej", 130, null, null)).toBe(
      "else alfelts vej 130",
    );
  });

  it("normalizes address with floor and door", () => {
    expect(normalizeApartmentKey("Else Alfelts Vej", 170, "2", "TH")).toBe(
      "else alfelts vej 170/2-th",
    );
  });

  it("normalizes address with floor only", () => {
    expect(normalizeApartmentKey("Else Alfelts Vej", 140, "ST", null)).toBe(
      "else alfelts vej 140/st",
    );
  });

  it("trims whitespace", () => {
    expect(
      normalizeApartmentKey("  Else Alfelts Vej  ", 130, null, null),
    ).toBe("else alfelts vej 130");
  });

  it("produces consistent keys regardless of case", () => {
    const key1 = normalizeApartmentKey("Else Alfelts Vej", 170, "2", "Th");
    const key2 = normalizeApartmentKey("ELSE ALFELTS VEJ", 170, "2", "th");
    expect(key1).toBe(key2);
  });
});

describe("formatAddress", () => {
  it("formats address with street and house number only", () => {
    expect(formatAddress("Else Alfelts Vej", 130, null, null)).toBe(
      "Else Alfelts Vej 130",
    );
  });

  it("formats address with floor and door", () => {
    expect(formatAddress("Else Alfelts Vej", 170, "2", "th")).toBe(
      "Else Alfelts Vej 170 2. th",
    );
  });

  it("formats address with floor only (no door)", () => {
    expect(formatAddress("Else Alfelts Vej", 138, "st", null)).toBe(
      "Else Alfelts Vej 138 st.",
    );
  });

  it("handles undefined floor and door", () => {
    expect(formatAddress("Else Alfelts Vej", 122, undefined, undefined)).toBe(
      "Else Alfelts Vej 122",
    );
  });

  it("handles empty string floor and door gracefully", () => {
    expect(formatAddress("Else Alfelts Vej", 144, "", "")).toBe(
      "Else Alfelts Vej 144",
    );
  });

  it("trims whitespace from floor and door", () => {
    expect(formatAddress("Else Alfelts Vej", 170, " 2 ", " th ")).toBe(
      "Else Alfelts Vej 170 2. th",
    );
  });

  it("omits door when floor is missing", () => {
    expect(formatAddress("Else Alfelts Vej", 170, null, "th")).toBe(
      "Else Alfelts Vej 170",
    );
  });
});

describe("validateName", () => {
  it("accepts non-empty names", () => {
    expect(validateName("Alice")).toEqual({ valid: true });
  });

  it("rejects empty string", () => {
    expect(validateName("").valid).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(validateName("   ").valid).toBe(false);
  });
});

describe("validateTableId", () => {
  it("accepts catalog ids", () => {
    expect(validateTableId(1)).toEqual({ valid: true });
    expect(validateTableId(15)).toEqual({ valid: true });
    expect(validateTableId(23)).toEqual({ valid: true });
  });

  it("rejects 0", () => {
    expect(validateTableId(0).valid).toBe(false);
  });

  it("rejects ids outside the catalog (e.g. 24)", () => {
    expect(validateTableId(24).valid).toBe(false);
  });

  it("rejects ids beyond the catalog max", () => {
    expect(validateTableId(25).valid).toBe(false);
  });

  it("rejects non-integers", () => {
    expect(validateTableId(1.5).valid).toBe(false);
  });
});

describe("validateLanguage", () => {
  it("accepts da", () => {
    expect(validateLanguage("da")).toEqual({ valid: true });
  });

  it("accepts en", () => {
    expect(validateLanguage("en")).toEqual({ valid: true });
  });

  it("rejects unsupported language", () => {
    const result = validateLanguage("fr");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must be one of");
  });

  it("rejects empty string", () => {
    expect(validateLanguage("").valid).toBe(false);
  });
});

describe("validateRegistrationInput", () => {
  const validInput = {
    name: "Alice",
    email: "alice@example.com",
    street: "Else Alfelts Vej",
    houseNumber: 130,
    floor: null,
    door: null,
    tableId: 1,
    language: "da" as const,
  };

  it("accepts a fully valid input", () => {
    const result = validateRegistrationInput(validInput);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it("returns all field errors at once", () => {
    const result = validateRegistrationInput({});
    expect(result.valid).toBe(false);
    expect(result.errors["name"]).toBeDefined();
    expect(result.errors["email"]).toBeDefined();
    expect(result.errors["street"]).toBeDefined();
    expect(result.errors["houseNumber"]).toBeDefined();
    expect(result.errors["tableId"]).toBeDefined();
    expect(result.errors["language"]).toBeDefined();
  });

  it("validates floor/door when house number requires it", () => {
    const result = validateRegistrationInput({
      ...validInput,
      houseNumber: 170,
      floor: null,
      door: null,
    });
    expect(result.valid).toBe(false);
    expect(result.errors["floorDoor"]).toBeDefined();
  });

  it("passes floor/door check when provided for required house number", () => {
    const result = validateRegistrationInput({
      ...validInput,
      houseNumber: 170,
      floor: "2",
      door: "th",
    });
    expect(result.valid).toBe(true);
  });

  it("skips floor/door check when house number is invalid", () => {
    const result = validateRegistrationInput({
      ...validInput,
      houseNumber: 999,
    });
    expect(result.valid).toBe(false);
    expect(result.errors["houseNumber"]).toBeDefined();
    expect(result.errors["floorDoor"]).toBeUndefined();
  });
});

describe("validateWaitlistInput", () => {
  const validInput = {
    name: "Alice",
    email: "alice@example.com",
    street: "Else Alfelts Vej",
    houseNumber: 130,
    floor: null,
    door: null,
    language: "da" as const,
  };

  it("accepts a fully valid input", () => {
    const result = validateWaitlistInput(validInput);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it("does not require tableId (unlike registration)", () => {
    const result = validateWaitlistInput(validInput);
    expect(result.valid).toBe(true);
    expect(result.errors["tableId"]).toBeUndefined();
  });

  it("returns all field errors at once", () => {
    const result = validateWaitlistInput({});
    expect(result.valid).toBe(false);
    expect(result.errors["name"]).toBeDefined();
    expect(result.errors["email"]).toBeDefined();
    expect(result.errors["street"]).toBeDefined();
    expect(result.errors["houseNumber"]).toBeDefined();
    expect(result.errors["language"]).toBeDefined();
    expect(result.errors["tableId"]).toBeUndefined();
  });

  it("validates floor/door when house number requires it", () => {
    const result = validateWaitlistInput({
      ...validInput,
      houseNumber: 170,
      floor: null,
      door: null,
    });
    expect(result.valid).toBe(false);
    expect(result.errors["floorDoor"]).toBeDefined();
  });

  it("passes floor/door check when provided for required house number", () => {
    const result = validateWaitlistInput({
      ...validInput,
      houseNumber: 170,
      floor: "2",
      door: "th",
    });
    expect(result.valid).toBe(true);
  });
});
