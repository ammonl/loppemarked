import type { Language } from "./enums.js";

/**
 * Metadata for a numbered flea-market table.
 *
 * The `id` matches the underlying `tables.id`. The public flea-market page
 * presents tables by number, location, and size.
 *
 * Coordinates are in the `TABLE_MAP_VIEWBOX` system (top-left origin).
 * `widthCm` × `lengthCm` matches the inventory listing for that table
 * (e.g. 80×180, 150×135) — `lengthCm` is the longer side for elongated
 * tables but reflects the listed orientation for the near-square pieces.
 * SVG `width`/`height` are derived from those cm values at a uniform
 * 1 unit ≈ 15 cm scale.
 */
export interface TableCatalogEntry {
  id: number;
  number: number;
  widthCm: number;
  lengthCm: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** SVG viewBox for the Fælledhuset hall map (width × height units). */
export const TABLE_MAP_VIEWBOX = { width: 120, height: 95 } as const;

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
 * Fælledhuset hall table layout, sourced from the published reference map
 * and the actual on-site table inventory. Tables 1–10 form the three
 * left/center vertical aisles, 13–14 line the courtyard wall, 15–20 fill
 * two right-of-center aisles, and 21–23 line the right wall. 11 and 12
 * are the horizontal pair along the promenade wall. SVG width/height are
 * derived from the cm dimensions at 1 unit ≈ 15 cm.
 */
export const TABLE_CATALOG: readonly TableCatalogEntry[] = [
  { id: 1, number: 1, widthCm: 60, lengthCm: 140, x: 13, y: 32.9, width: 4, height: 9.3 },
  { id: 2, number: 2, widthCm: 80, lengthCm: 180, x: 12.4, y: 44.5, width: 5.3, height: 12 },
  { id: 3, number: 3, widthCm: 60, lengthCm: 140, x: 13, y: 58.9, width: 4, height: 9.3 },
  { id: 4, number: 4, widthCm: 75, lengthCm: 150, x: 29.5, y: 26.5, width: 5, height: 10 },
  { id: 5, number: 5, widthCm: 80, lengthCm: 180, x: 29.4, y: 39.5, width: 5.3, height: 12 },
  { id: 6, number: 6, widthCm: 80, lengthCm: 180, x: 29.4, y: 52.5, width: 5.3, height: 12 },
  { id: 7, number: 7, widthCm: 80, lengthCm: 180, x: 46.4, y: 12.5, width: 5.3, height: 12 },
  { id: 8, number: 8, widthCm: 80, lengthCm: 180, x: 46.4, y: 25.5, width: 5.3, height: 12 },
  { id: 9, number: 9, widthCm: 80, lengthCm: 180, x: 46.4, y: 39.5, width: 5.3, height: 12 },
  { id: 10, number: 10, widthCm: 80, lengthCm: 180, x: 46.4, y: 52.5, width: 5.3, height: 12 },
  { id: 11, number: 11, widthCm: 75, lengthCm: 180, x: 24.5, y: 76.5, width: 12, height: 5 },
  { id: 12, number: 12, widthCm: 75, lengthCm: 150, x: 45.5, y: 76.5, width: 10, height: 5 },
  { id: 13, number: 13, widthCm: 60, lengthCm: 120, x: 65.5, y: 14, width: 8, height: 4 },
  { id: 14, number: 14, widthCm: 150, lengthCm: 135, x: 78.5, y: 11.5, width: 10, height: 9 },
  { id: 15, number: 15, widthCm: 60, lengthCm: 110, x: 63, y: 33.9, width: 4, height: 7.3 },
  { id: 16, number: 16, widthCm: 80, lengthCm: 180, x: 62.4, y: 47.5, width: 5.3, height: 12 },
  { id: 17, number: 17, widthCm: 80, lengthCm: 180, x: 62.4, y: 61.5, width: 5.3, height: 12 },
  { id: 18, number: 18, widthCm: 80, lengthCm: 80, x: 79.4, y: 34.9, width: 5.3, height: 5.3 },
  { id: 19, number: 19, widthCm: 80, lengthCm: 180, x: 79.4, y: 45.5, width: 5.3, height: 12 },
  { id: 20, number: 20, widthCm: 150, lengthCm: 135, x: 77.5, y: 59.5, width: 9, height: 10 },
  { id: 21, number: 21, widthCm: 80, lengthCm: 180, x: 95.4, y: 22.5, width: 5.3, height: 12 },
  { id: 22, number: 22, widthCm: 80, lengthCm: 180, x: 95.4, y: 36.5, width: 5.3, height: 12 },
  { id: 23, number: 23, widthCm: 80, lengthCm: 180, x: 95.4, y: 49.5, width: 5.3, height: 12 },
] as const;

/** IDs of tables present on the published Fælledhuset map. */
export const VISIBLE_TABLE_IDS: readonly number[] = TABLE_CATALOG.map((t) => t.id);

/** Total number of bookable tables. */
export const TOTAL_TABLE_COUNT = TABLE_CATALOG.length;

/** Lookup helper for a table by its id. */
export function getTableById(id: number): TableCatalogEntry | undefined {
  return TABLE_CATALOG.find((t) => t.id === id);
}

/** "80x180 cm" style size label derived from a catalog entry. */
export function formatTableSize(table: Pick<TableCatalogEntry, "widthCm" | "lengthCm">): string {
  return `${table.widthCm}x${table.lengthCm} cm`;
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
    return `Table #${table.number} · ${formatTableSize(table)}`;
  }
  return `Table #${table.number}`;
}

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

/** Default language */
export const DEFAULT_LANGUAGE: Language = "da";

/** Default language for admin-created registrations */
export const ADMIN_DEFAULT_LANGUAGE: Language = "en";

/** Default reserved label applied when an admin holds a table off the public pool. */
export const RESERVED_LABEL_DEFAULT = "Admin Hold" as const;

/** Reserved label applied when a resident self-cancels (admin decides release). */
export const RESERVED_LABEL_AWAITING_REVIEW = "Awaiting Admin Review" as const;

/** Default validity window for resident self-cancellation magic links (60 days). */
export const CANCELLATION_TOKEN_TTL_DAYS = 60 as const;

/** Initial admin seed emails */
export const SEED_ADMIN_EMAILS = [
  "ammonl@hotmail.com",
] as const;
