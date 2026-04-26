export {
  TABLE_STATES,
  PUBLIC_TABLE_STATES,
  REGISTRATION_STATUSES,
  WAITLIST_ENTRY_STATUSES,
  ACTOR_TYPES,
  LANGUAGES,
  AUDIT_ACTIONS,
  EMAIL_STATUSES,
} from "./enums.js";

export type {
  TableState,
  PublicTableState,
  RegistrationStatus,
  WaitlistEntryStatus,
  ActorType,
  Language,
  AuditAction,
  EmailStatus,
} from "./enums.js";

export {
  TABLE_CATALOG,
  TABLE_MAP_VIEWBOX,
  CLOTHING_RACK_TABLE_IDS,
  CLOTHING_RACKS,
  VISIBLE_TABLE_IDS,
  TOTAL_TABLE_COUNT,
  getTableById,
  tableHasClothingRack,
  getClothingRackSide,
  formatTableLabel,
  formatTableSize,
  DEFAULT_OPENING_DATETIME,
  OPENING_TIMEZONE,
  EMAIL_FROM,
  EMAIL_FROM_NAMES,
  EMAIL_REPLY_TO,
  ORGANIZER_CONTACTS,
  EVENT_CONTACT,
  WHATSAPP_GROUP_URL,
  ELIGIBLE_STREET,
  HOUSE_NUMBER_MIN,
  HOUSE_NUMBER_MAX,
  FLOOR_DOOR_REQUIRED_NUMBERS,
  DEFAULT_LANGUAGE,
  ADMIN_DEFAULT_LANGUAGE,
  RESERVED_LABEL_DEFAULT,
  RESERVED_LABEL_AWAITING_REVIEW,
  CANCELLATION_TOKEN_TTL_DAYS,
  SEED_ADMIN_EMAILS,
} from "./constants.js";

export type {
  TableCatalogEntry,
  ClothingRackSide,
} from "./constants.js";

export type {
  SystemSettings,
  HallSummary,
  TablePublic,
  Table,
  NormalizedAddress,
  Registration,
  RegistrationPublic,
  WaitlistEntry,
  Admin,
  AuditEvent,
  EmailRecord,
  RegistrationInput,
  WaitlistInput,
  PublicStatus,
} from "./types.js";

export {
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

export type { ValidationResult, RegistrationValidationResult } from "./validators.js";

export { buildDawaAutocompleteUrl, parseDawaHouseNumber } from "./dawa.js";

export type { DawaAutocompleteSuggestion, DawaAddress } from "./dawa.js";

export { I18N_KEYS, LANGUAGE_LABELS } from "./i18n.js";

export type { I18nKey } from "./i18n.js";
