/** Box availability states */
export const BOX_STATES = ["available", "occupied", "reserved"] as const;
export type BoxState = (typeof BOX_STATES)[number];

/** Box states visible to public users (reserved is mapped to occupied) */
export const PUBLIC_BOX_STATES = ["available", "occupied"] as const;
export type PublicBoxState = (typeof PUBLIC_BOX_STATES)[number];

/** Registration lifecycle states */
export const REGISTRATION_STATUSES = ["active", "switched", "removed"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** Waitlist entry lifecycle states */
export const WAITLIST_ENTRY_STATUSES = ["waiting", "assigned", "cancelled"] as const;
export type WaitlistEntryStatus = (typeof WAITLIST_ENTRY_STATUSES)[number];

/** Actor types for audit trail */
export const ACTOR_TYPES = ["public", "admin", "system"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** Supported UI/email languages */
export const LANGUAGES = ["da", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

/** All auditable action types */
export const AUDIT_ACTIONS = [
  "registration_create",
  "registration_switch",
  "registration_remove",
  "registration_move",
  "registration_self_cancel",
  "waitlist_add",
  "waitlist_remove",
  "waitlist_assign",
  "waitlist_reorder_preserve",
  "table_state_change",
  "opening_datetime_change",
  "admin_create",
  "admin_delete",
  "admin_password_change",
  "email_sent",
  "notification_sent",
  "notification_skipped",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Email delivery statuses */
export const EMAIL_STATUSES = ["pending", "sent", "failed"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];
