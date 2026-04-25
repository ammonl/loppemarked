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

/**
 * Metadata for a numbered table.
 *
 * The `id` matches the underlying `planter_boxes.id` (1-29) so the public
 * flea-market page can reuse the existing box/greenhouse API surface while
 * presenting tables by number, location, and size.
 *
 * Coordinates are in the `TABLE_MAP_VIEWBOX` system (top-left origin).
 */
export interface TableCatalogEntry {
  id: number;
  number: number;
  sizeMeters: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** SVG viewBox for the Fælledhuset hall map (width × height units). */
export const TABLE_MAP_VIEWBOX = { width: 120, height: 80 } as const;

const STANDARD_TABLE_SIZE_METERS = 2;
const PREMIUM_TABLE_SIZE_METERS = 3;

/**
 * Public-facing size label shown on the table-map detail panel. Until the
 * catalog carries individual dimensions, every table is presented at the
 * standard 100×200 cm.
 */
export const STANDARD_TABLE_SIZE_LABEL = "100x200cm" as const;

/**
 * Tables flagged for an adjacent clothing rack. Sellers without a flagged
 * table are not permitted to bring a rack of their own.
 */
export const CLOTHING_RACK_TABLE_IDS: readonly number[] = [8, 14, 18, 22];

export function tableHasClothingRack(id: number): boolean {
  return CLOTHING_RACK_TABLE_IDS.includes(id);
}

/**
 * Fælledhuset hall table layout. Tables 1–22 line the perimeter
 * walls; tables 23–26 form the long center island (premium 3-meter
 * tables); tables 27–29 form a smaller second center aisle.
 */
export const TABLE_CATALOG: readonly TableCatalogEntry[] = [
  { id: 1, number: 1, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 20, y: 12, width: 10, height: 5 },
  { id: 2, number: 2, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 32, y: 12, width: 10, height: 5 },
  { id: 3, number: 3, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 44, y: 12, width: 10, height: 5 },
  { id: 4, number: 4, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 56, y: 12, width: 10, height: 5 },
  { id: 5, number: 5, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 68, y: 12, width: 10, height: 5 },
  { id: 6, number: 6, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 80, y: 12, width: 10, height: 5 },
  { id: 7, number: 7, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 92, y: 12, width: 10, height: 5 },
  { id: 8, number: 8, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 103, y: 22, width: 5, height: 10 },
  { id: 9, number: 9, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 103, y: 34, width: 5, height: 10 },
  { id: 10, number: 10, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 103, y: 46, width: 5, height: 10 },
  { id: 11, number: 11, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 103, y: 58, width: 5, height: 10 },
  { id: 12, number: 12, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 92, y: 63, width: 10, height: 5 },
  { id: 13, number: 13, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 80, y: 63, width: 10, height: 5 },
  { id: 14, number: 14, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 68, y: 63, width: 10, height: 5 },
  { id: 15, number: 15, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 56, y: 63, width: 10, height: 5 },
  { id: 16, number: 16, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 44, y: 63, width: 10, height: 5 },
  { id: 17, number: 17, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 32, y: 63, width: 10, height: 5 },
  { id: 18, number: 18, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 20, y: 63, width: 10, height: 5 },
  { id: 19, number: 19, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 12, y: 58, width: 5, height: 10 },
  { id: 20, number: 20, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 12, y: 46, width: 5, height: 10 },
  { id: 21, number: 21, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 12, y: 34, width: 5, height: 10 },
  { id: 22, number: 22, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 12, y: 22, width: 5, height: 10 },
  { id: 23, number: 23, sizeMeters: PREMIUM_TABLE_SIZE_METERS, x: 22, y: 28, width: 15, height: 6 },
  { id: 24, number: 24, sizeMeters: PREMIUM_TABLE_SIZE_METERS, x: 39, y: 28, width: 15, height: 6 },
  { id: 25, number: 25, sizeMeters: PREMIUM_TABLE_SIZE_METERS, x: 66, y: 28, width: 15, height: 6 },
  { id: 26, number: 26, sizeMeters: PREMIUM_TABLE_SIZE_METERS, x: 83, y: 28, width: 15, height: 6 },
  { id: 27, number: 27, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 30, y: 46, width: 10, height: 5 },
  { id: 28, number: 28, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 55, y: 46, width: 10, height: 5 },
  { id: 29, number: 29, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 80, y: 46, width: 10, height: 5 },
] as const;

/** Lookup helper for a table by its id (= box id). */
export function getTableById(id: number): TableCatalogEntry | undefined {
  return TABLE_CATALOG.find((t) => t.id === id);
}

/**
 * Human-readable table label used in admin UI and
 * admin-facing email templates.
 *
 * Falls back gracefully when the id is outside the catalog
 * so callers can handle ad-hoc entity ids without extra guards.
 */
export function formatTableLabel(id: number, opts: { includeDetails?: boolean } = {}): string {
  const table = getTableById(id);
  if (!table) return `Table #${id}`;
  if (opts.includeDetails) {
    return `Table #${table.number} · ${table.sizeMeters} m`;
  }
  return `Table #${table.number}`;
}

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

/**
 * Primary event contact shown across public and admin surfaces.
 *
 * Rendered UI must present this as a single `mailto:` link whose visible
 * text is the `name`; the `email` only appears inside the `href`.
 */
export const EVENT_CONTACT = {
  name: "Ammon Larson",
  email: "ammonl@hotmail.com",
} as const;

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

/** Reserved label applied when a resident self-cancels (admin decides release). */
export const RESERVED_LABEL_AWAITING_REVIEW = "Awaiting Admin Review" as const;

/** Default validity window for resident self-cancellation magic links (60 days). */
export const CANCELLATION_TOKEN_TTL_DAYS = 60 as const;

/** Initial admin seed emails */
export const SEED_ADMIN_EMAILS = [
  "ammonl@hotmail.com",
] as const;

