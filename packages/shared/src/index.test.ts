import { describe, expect, it } from "vitest";
import {
  TABLE_CATALOG,
  TOTAL_TABLE_COUNT,
  BOX_STATES,
  LANGUAGES,
  AUDIT_ACTIONS,
  validateEmail,
  normalizeApartmentKey,
  I18N_KEYS,
  LANGUAGE_LABELS,
} from "./index.js";

describe("barrel exports", () => {
  it("exports the table catalog", () => {
    expect(TABLE_CATALOG).toHaveLength(TOTAL_TABLE_COUNT);
  });

  it("exports table states", () => {
    expect(BOX_STATES).toEqual(["available", "occupied", "reserved"]);
  });

  it("exports languages", () => {
    expect(LANGUAGES).toEqual(["da", "en"]);
  });

  it("exports audit actions", () => {
    expect(AUDIT_ACTIONS.length).toBeGreaterThan(0);
    expect(AUDIT_ACTIONS).toContain("registration_create");
    expect(AUDIT_ACTIONS).toContain("table_state_change");
  });

  it("exports validators", () => {
    expect(validateEmail("test@example.com")).toEqual({ valid: true });
  });

  it("exports normalizeApartmentKey", () => {
    expect(normalizeApartmentKey("Else Alfelts Vej", 130, null, null)).toBe(
      "else alfelts vej 130",
    );
  });

  it("exports i18n keys", () => {
    expect(I18N_KEYS.common.appName).toBe("common.appName");
  });

  it("exports language labels", () => {
    expect(LANGUAGE_LABELS.da).toBe("Dansk");
    expect(LANGUAGE_LABELS.en).toBe("English");
  });
});
