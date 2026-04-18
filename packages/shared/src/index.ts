export {
  BOX_STATES,
  PUBLIC_BOX_STATES,
  REGISTRATION_STATUSES,
  WAITLIST_ENTRY_STATUSES,
  ACTOR_TYPES,
  LANGUAGES,
  AUDIT_ACTIONS,
  EMAIL_STATUSES,
} from "./enums.js";

export type {
  BoxState,
  PublicBoxState,
  RegistrationStatus,
  WaitlistEntryStatus,
  ActorType,
  Language,
  AuditAction,
  EmailStatus,
} from "./enums.js";

export {
  GREENHOUSES,
  BOX_CATALOG,
  TOTAL_BOX_COUNT,
  KRONEN_BOX_RANGE,
  SOEN_BOX_RANGE,
  TABLE_CATALOG,
  TABLE_MAP_VIEWBOX,
  getTableById,
  DEFAULT_OPENING_DATETIME,
  OPENING_TIMEZONE,
  EMAIL_FROM,
  EMAIL_FROM_NAMES,
  EMAIL_REPLY_TO,
  ORGANIZER_CONTACTS,
  WHATSAPP_GROUP_URL,
  ELIGIBLE_STREET,
  HOUSE_NUMBER_MIN,
  HOUSE_NUMBER_MAX,
  FLOOR_DOOR_REQUIRED_NUMBERS,
  DEFAULT_LANGUAGE,
  ADMIN_DEFAULT_LANGUAGE,
  GREENHOUSE_PREFERENCES,
  RESERVED_LABEL_DEFAULT,
  SEED_ADMIN_EMAILS,
} from "./constants.js";

export type { Greenhouse, BoxCatalogEntry, GreenhousePreference, TableCatalogEntry } from "./constants.js";

export type {
  SystemSettings,
  GreenhouseSummary,
  PlanterBoxPublic,
  PlanterBox,
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
  normalizeApartmentKey,
  formatAddress,
  validateName,
  validateBoxId,
  validateLanguage,
  validateRegistrationInput,
  validateWaitlistInput,
} from "./validators.js";

export type { ValidationResult, RegistrationValidationResult } from "./validators.js";

export { buildDawaAutocompleteUrl, parseDawaHouseNumber } from "./dawa.js";

export type { DawaAutocompleteSuggestion, DawaAddress } from "./dawa.js";

export { I18N_KEYS, LANGUAGE_LABELS } from "./i18n.js";

export type { I18nKey } from "./i18n.js";
