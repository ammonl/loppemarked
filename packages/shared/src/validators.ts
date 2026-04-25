import {
  ELIGIBLE_STREET,
  FLOOR_DOOR_REQUIRED_NUMBERS,
  HOUSE_NUMBER_MAX,
  HOUSE_NUMBER_MIN,
  VISIBLE_TABLE_IDS,
} from "./constants.js";
import { LANGUAGES } from "./enums.js";
import type { RegistrationInput, WaitlistInput } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate email format */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required" };
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Email is required" };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: "Invalid email format" };
  }
  return { valid: true };
}

/** Validate street name */
export function validateStreet(street: string): ValidationResult {
  if (!street || typeof street !== "string") {
    return { valid: false, error: "Street is required" };
  }
  if (street.trim() !== ELIGIBLE_STREET) {
    return {
      valid: false,
      error: `Street must be ${ELIGIBLE_STREET}`,
    };
  }
  return { valid: true };
}

/** Validate house number is in eligible range */
export function validateHouseNumber(houseNumber: number): ValidationResult {
  if (houseNumber == null || typeof houseNumber !== "number") {
    return { valid: false, error: "House number is required" };
  }
  if (!Number.isInteger(houseNumber)) {
    return { valid: false, error: "House number must be a whole number" };
  }
  if (houseNumber < HOUSE_NUMBER_MIN || houseNumber > HOUSE_NUMBER_MAX) {
    return {
      valid: false,
      error: `House number must be between ${HOUSE_NUMBER_MIN} and ${HOUSE_NUMBER_MAX}`,
    };
  }
  return { valid: true };
}

/** Check whether floor and door are required for a given house number */
export function isFloorDoorRequired(houseNumber: number): boolean {
  return FLOOR_DOOR_REQUIRED_NUMBERS.includes(houseNumber);
}

/** Validate floor/door fields based on house number rules. Floor is required; door is optional. */
export function validateFloorDoor(
  houseNumber: number,
  floor: string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  door?: string | null | undefined,
): ValidationResult {
  if (!isFloorDoorRequired(houseNumber)) {
    return { valid: true };
  }
  const hasFloor = floor != null && typeof floor === "string" && floor.trim().length > 0;
  if (!hasFloor) {
    return {
      valid: false,
      error: `Floor is required for house number ${houseNumber}`,
    };
  }
  return { valid: true };
}

/** Validate a complete address for eligibility */
export function validateAddress(
  street: string,
  houseNumber: number,
  floor: string | null | undefined,
  door: string | null | undefined,
): ValidationResult {
  const streetResult = validateStreet(street);
  if (!streetResult.valid) return streetResult;

  const houseResult = validateHouseNumber(houseNumber);
  if (!houseResult.valid) return houseResult;

  const floorDoorResult = validateFloorDoor(houseNumber, floor, door);
  if (!floorDoorResult.valid) return floorDoorResult;

  return { valid: true };
}

/**
 * Drop floor/door for house numbers that don't require them. Used by both
 * the public-facing forms (#95) and the API endpoints (#97) so the
 * apartment dedupe key is identical regardless of any stray client input.
 */
export function effectiveFloorDoor(
  houseNumber: number,
  floor: string | null | undefined,
  door: string | null | undefined,
): { floor: string | null; door: string | null } {
  if (!isFloorDoorRequired(houseNumber)) {
    return { floor: null, door: null };
  }
  return { floor: floor ?? null, door: door ?? null };
}

/**
 * Generate a normalized apartment key from address components.
 * Used as the uniqueness constraint for one-table-per-apartment rule.
 *
 * Format: "else alfelts vej <number>[/<floor>-<door>]"
 */
export function normalizeApartmentKey(
  street: string,
  houseNumber: number,
  floor: string | null | undefined,
  door: string | null | undefined,
): string {
  const base = `${street.trim().toLowerCase()} ${houseNumber}`;
  const floorPart = floor?.trim().toLowerCase();
  const doorPart = door?.trim().toLowerCase();
  if (floorPart && doorPart) {
    return `${base}/${floorPart}-${doorPart}`;
  }
  if (floorPart) {
    return `${base}/${floorPart}`;
  }
  return base;
}

/**
 * Format an address for user-facing display.
 *
 * Format: "Else Alfelts Vej [house_number] [floor]. [apartment]"
 * Missing apartment omits the trailing door value.
 * Missing floor and apartment shows only street and house number.
 */
export function formatAddress(
  street: string,
  houseNumber: number,
  floor: string | null | undefined,
  door: string | null | undefined,
): string {
  let result = `${street} ${houseNumber}`;
  const floorPart = floor?.trim();
  const doorPart = door?.trim();
  if (floorPart) {
    result += ` ${floorPart}.`;
    if (doorPart) {
      result += ` ${doorPart}`;
    }
  }
  return result;
}

/** Validate registrant name */
export function validateName(name: string): ValidationResult {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Name is required" };
  }
  if (name.trim().length === 0) {
    return { valid: false, error: "Name is required" };
  }
  return { valid: true };
}

/** Validate table ID is in the catalog. */
export function validateTableId(tableId: number): ValidationResult {
  if (tableId == null || typeof tableId !== "number") {
    return { valid: false, error: "Table ID is required" };
  }
  if (!Number.isInteger(tableId) || !VISIBLE_TABLE_IDS.includes(tableId)) {
    return { valid: false, error: "Table ID must be a valid catalog entry" };
  }
  return { valid: true };
}

/** Validate language is a supported value */
export function validateLanguage(language: string): ValidationResult {
  if (!language || typeof language !== "string") {
    return { valid: false, error: "Language is required" };
  }
  if (!(LANGUAGES as readonly string[]).includes(language)) {
    return { valid: false, error: `Language must be one of: ${LANGUAGES.join(", ")}` };
  }
  return { valid: true };
}

export interface RegistrationValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/** Validate a complete registration input, returning all field errors at once */
export function validateRegistrationInput(
  input: Partial<RegistrationInput>,
): RegistrationValidationResult {
  const errors: Record<string, string> = {};

  const nameResult = validateName((input.name ?? "") as string);
  if (!nameResult.valid) errors["name"] = nameResult.error!;

  const emailResult = validateEmail((input.email ?? "") as string);
  if (!emailResult.valid) errors["email"] = emailResult.error!;

  const streetResult = validateStreet((input.street ?? "") as string);
  if (!streetResult.valid) errors["street"] = streetResult.error!;

  const houseNumber = input.houseNumber ?? NaN;
  const houseResult = validateHouseNumber(houseNumber);
  if (!houseResult.valid) {
    errors["houseNumber"] = houseResult.error!;
  } else {
    const floorDoorResult = validateFloorDoor(
      houseNumber,
      input.floor,
      input.door,
    );
    if (!floorDoorResult.valid) errors["floorDoor"] = floorDoorResult.error!;
  }

  const tableResult = validateTableId((input.tableId ?? NaN) as number);
  if (!tableResult.valid) errors["tableId"] = tableResult.error!;

  const langResult = validateLanguage((input.language ?? "") as string);
  if (!langResult.valid) errors["language"] = langResult.error!;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/** Validate a complete waitlist input, returning all field errors at once */
export function validateWaitlistInput(
  input: Partial<WaitlistInput>,
): RegistrationValidationResult {
  const errors: Record<string, string> = {};

  const nameResult = validateName((input.name ?? "") as string);
  if (!nameResult.valid) errors["name"] = nameResult.error!;

  const emailResult = validateEmail((input.email ?? "") as string);
  if (!emailResult.valid) errors["email"] = emailResult.error!;

  const streetResult = validateStreet((input.street ?? "") as string);
  if (!streetResult.valid) errors["street"] = streetResult.error!;

  const houseNumber = input.houseNumber ?? NaN;
  const houseResult = validateHouseNumber(houseNumber);
  if (!houseResult.valid) {
    errors["houseNumber"] = houseResult.error!;
  } else {
    const floorDoorResult = validateFloorDoor(
      houseNumber,
      input.floor,
      input.door,
    );
    if (!floorDoorResult.valid) errors["floorDoor"] = floorDoorResult.error!;
  }

  const langResult = validateLanguage((input.language ?? "") as string);
  if (!langResult.valid) errors["language"] = langResult.error!;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
