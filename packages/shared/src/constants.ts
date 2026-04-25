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
export const TABLE_MAP_VIEWBOX = { width: 120, height: 95 } as const;

const STANDARD_TABLE_SIZE_METERS = 2;

/**
 * Public-facing size label shown on the table-map detail panel. Until the
 * catalog carries individual dimensions, every table is presented at the
 * standard 100×200 cm.
 */
export const STANDARD_TABLE_SIZE_LABEL = "100x200cm" as const;

/** Side of a table the adjacent clothing rack sits on, in map coordinates. */
export type ClothingRackSide = "above" | "below" | "left" | "right";

/**
 * Tables flagged for an adjacent clothing rack along with the rack's side
 * relative to the table. Sellers without a flagged table are not permitted
 * to bring a rack of their own. Layout matches the published Fælledhuset
 * map reference.
 */
export const CLOTHING_RACKS: readonly { tableId: number; side: ClothingRackSide }[] = [
  { tableId: 1, side: "above" },
  { tableId: 3, side: "below" },
  { tableId: 4, side: "above" },
  { tableId: 11, side: "left" },
  { tableId: 12, side: "right" },
  { tableId: 13, side: "left" },
  { tableId: 15, side: "above" },
  { tableId: 18, side: "above" },
  { tableId: 21, side: "above" },
] as const;

/** Convenience id-only list, kept for code that just needs membership. */
export const CLOTHING_RACK_TABLE_IDS: readonly number[] = CLOTHING_RACKS.map(
  (r) => r.tableId,
);

export function tableHasClothingRack(id: number): boolean {
  return CLOTHING_RACK_TABLE_IDS.includes(id);
}

export function getClothingRackSide(id: number): ClothingRackSide | undefined {
  return CLOTHING_RACKS.find((r) => r.tableId === id)?.side;
}

/**
 * Fælledhuset hall table layout, sourced from the published reference map.
 * Tables 1–10 form the three left/center vertical aisles, 13–14 are a
 * horizontal pair near the courtyard wall, 15–20 fill two right-of-center
 * aisles, and 21/23/24 line the right wall (id 22 is intentionally
 * skipped). 11 and 12 are the horizontal pair along the promenade wall.
 */
export const TABLE_CATALOG: readonly TableCatalogEntry[] = [
  { id: 1, number: 1, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 12, y: 31, width: 6, height: 13 },
  { id: 2, number: 2, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 12, y: 44, width: 6, height: 13 },
  { id: 3, number: 3, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 12, y: 57, width: 6, height: 13 },
  { id: 4, number: 4, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 29, y: 25, width: 6, height: 13 },
  { id: 5, number: 5, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 29, y: 39, width: 6, height: 13 },
  { id: 6, number: 6, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 29, y: 52, width: 6, height: 13 },
  { id: 7, number: 7, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 46, y: 12, width: 6, height: 13 },
  { id: 8, number: 8, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 46, y: 25, width: 6, height: 13 },
  { id: 9, number: 9, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 46, y: 39, width: 6, height: 13 },
  { id: 10, number: 10, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 46, y: 52, width: 6, height: 13 },
  { id: 11, number: 11, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 24, y: 76, width: 13, height: 6 },
  { id: 12, number: 12, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 44, y: 76, width: 13, height: 6 },
  { id: 13, number: 13, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 63, y: 13, width: 13, height: 6 },
  { id: 14, number: 14, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 77, y: 13, width: 13, height: 6 },
  { id: 15, number: 15, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 62, y: 31, width: 6, height: 13 },
  { id: 16, number: 16, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 62, y: 47, width: 6, height: 13 },
  { id: 17, number: 17, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 62, y: 61, width: 6, height: 13 },
  { id: 18, number: 18, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 79, y: 31, width: 6, height: 13 },
  { id: 19, number: 19, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 79, y: 45, width: 6, height: 13 },
  { id: 20, number: 20, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 79, y: 58, width: 6, height: 13 },
  { id: 21, number: 21, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 95, y: 22, width: 6, height: 13 },
  { id: 23, number: 23, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 95, y: 36, width: 6, height: 13 },
  { id: 24, number: 24, sizeMeters: STANDARD_TABLE_SIZE_METERS, x: 95, y: 49, width: 6, height: 13 },
] as const;

/** IDs of tables present on the published Fælledhuset map. */
export const VISIBLE_TABLE_IDS: readonly number[] = TABLE_CATALOG.map((t) => t.id);

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
export const EMAIL_REPLY_TO = "ammonl@hotmail.com" as const;
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

