import type { Language } from "./enums.js";

export const GREENHOUSES = ["Kronen", "Søen"] as const;
export type Greenhouse = (typeof GREENHOUSES)[number];

export interface BoxCatalogEntry {
  id: number;
  name: string;
  greenhouse: Greenhouse;
}

/**
 * Complete box catalog matching spec section 3.2.
 * Global numbering 1-29: Kronen 1-14, Søen 15-29.
 */
export const BOX_CATALOG: readonly BoxCatalogEntry[] = [
  { id: 1, name: "Linaria", greenhouse: "Kronen" },
  { id: 2, name: "Harebell", greenhouse: "Kronen" },
  { id: 3, name: "Stellaria", greenhouse: "Kronen" },
  { id: 4, name: "Honeysuckle", greenhouse: "Kronen" },
  { id: 5, name: "Daisy", greenhouse: "Kronen" },
  { id: 6, name: "Hawthorn", greenhouse: "Kronen" },
  { id: 7, name: "Alder", greenhouse: "Kronen" },
  { id: 8, name: "Linden", greenhouse: "Kronen" },
  { id: 9, name: "Thistle", greenhouse: "Kronen" },
  { id: 10, name: "Yarrow", greenhouse: "Kronen" },
  { id: 11, name: "Seabuck", greenhouse: "Kronen" },
  { id: 12, name: "Anemone", greenhouse: "Kronen" },
  { id: 13, name: "Jenny", greenhouse: "Kronen" },
  { id: 14, name: "Buttercup", greenhouse: "Kronen" },
  { id: 15, name: "Robin", greenhouse: "Søen" },
  { id: 16, name: "Mallard", greenhouse: "Søen" },
  { id: 17, name: "Wagtail", greenhouse: "Søen" },
  { id: 18, name: "Greenfinch", greenhouse: "Søen" },
  { id: 19, name: "Blue tit", greenhouse: "Søen" },
  { id: 20, name: "Great tit", greenhouse: "Søen" },
  { id: 21, name: "Mute swan", greenhouse: "Søen" },
  { id: 22, name: "Nuthatch", greenhouse: "Søen" },
  { id: 23, name: "Coot", greenhouse: "Søen" },
  { id: 24, name: "Hooded crow", greenhouse: "Søen" },
  { id: 25, name: "Gray goose", greenhouse: "Søen" },
  { id: 26, name: "Barn swallow", greenhouse: "Søen" },
  { id: 27, name: "Magpie", greenhouse: "Søen" },
  { id: 28, name: "Chaffinch", greenhouse: "Søen" },
  { id: 29, name: "Black bird", greenhouse: "Søen" },
] as const;

/** Total planter box count */
export const TOTAL_BOX_COUNT = 29;

/** Kronen box ID range */
export const KRONEN_BOX_RANGE = { start: 1, end: 14 } as const;

/** Søen box ID range */
export const SOEN_BOX_RANGE = { start: 15, end: 29 } as const;

/** Default registration opening datetime (Europe/Copenhagen) */
export const DEFAULT_OPENING_DATETIME = "2026-04-01T10:00:00" as const;
export const OPENING_TIMEZONE = "Europe/Copenhagen" as const;

/** Email sender configuration */
export const EMAIL_FROM = "loppemarked@un17hub.com" as const;
export const EMAIL_REPLY_TO = "elise7284@gmail.com" as const;
export const EMAIL_FROM_NAMES: Record<"da" | "en", string> = {
  da: "UN17 Village Loppemarked",
  en: "UN17 Village Loppemarked",
} as const;

/** Organizer contacts */
export const ORGANIZER_CONTACTS = [
  { name: "Elise Larson", email: "elise7284@gmail.com" },
  { name: "Lena Filthaut", email: "lena.filthaut@yahoo.com" },
] as const;

/** WhatsApp group link */
export const WHATSAPP_GROUP_URL =
  "https://chat.whatsapp.com/FqYOqLLsz98HmDcdsr8a3i" as const;

/** Address eligibility constants */
export const ELIGIBLE_STREET = "Else Alfelts Vej" as const;
export const HOUSE_NUMBER_MIN = 122 as const;
export const HOUSE_NUMBER_MAX = 202 as const;

/**
 * House numbers that require floor + door.
 * Includes 138, 144, and 161-202.
 */
export const FLOOR_DOOR_REQUIRED_NUMBERS: readonly number[] = [
  138,
  144,
  ...Array.from({ length: 202 - 161 + 1 }, (_, i) => 161 + i),
];

/** Greenhouse preference options for waitlist */
export const GREENHOUSE_PREFERENCES = ["kronen", "søen", "any"] as const;
export type GreenhousePreference = (typeof GREENHOUSE_PREFERENCES)[number];

/** Default language */
export const DEFAULT_LANGUAGE: Language = "da";

/** Default language for admin-created registrations */
export const ADMIN_DEFAULT_LANGUAGE: Language = "en";

/** Default box state for reserved label */
export const RESERVED_LABEL_DEFAULT = "Admin Hold" as const;

/** Initial admin seed emails */
export const SEED_ADMIN_EMAILS = [
  "ammonl@hotmail.com",
] as const;

