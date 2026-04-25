import type { ColumnType, Generated, Insertable, Selectable } from "kysely";

export interface Database {
  tables: TableTable;
  admins: AdminTable;
  admin_credentials: AdminCredentialTable;
  admin_notification_preferences: AdminNotificationPreferencesTable;
  sessions: SessionTable;
  system_settings: SystemSettingsTable;
  registrations: RegistrationTable;
  waitlist_entries: WaitlistEntryTable;
  emails: EmailTable;
  audit_events: AuditEventTable;
  registration_cancellation_tokens: RegistrationCancellationTokenTable;
}

type TableState = "available" | "occupied" | "reserved";

export interface TableTable {
  id: number;
  state: ColumnType<TableState, TableState | undefined, TableState>;
  reserved_label: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface AdminTable {
  id: Generated<string>;
  email: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface AdminCredentialTable {
  admin_id: string;
  password_hash: string;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface AdminNotificationPreferencesTable {
  admin_id: string;
  notify_user_registration: ColumnType<boolean, boolean | undefined, boolean>;
  notify_admin_table_action: ColumnType<boolean, boolean | undefined, boolean>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface SessionTable {
  id: Generated<string>;
  admin_id: string;
  expires_at: ColumnType<Date, string, string>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface SystemSettingsTable {
  id: Generated<string>;
  opening_datetime: ColumnType<Date, string, string>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

type RegistrationStatus = "active" | "switched" | "removed";
type Lang = "da" | "en";

export interface RegistrationTable {
  id: Generated<string>;
  table_id: number;
  name: string;
  email: string;
  street: string;
  house_number: number;
  floor: string | null;
  door: string | null;
  apartment_key: string;
  language: ColumnType<Lang, Lang | undefined, Lang>;
  status: ColumnType<RegistrationStatus, RegistrationStatus | undefined, RegistrationStatus>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

type WaitlistStatus = "waiting" | "assigned" | "cancelled";

export interface WaitlistEntryTable {
  id: Generated<string>;
  name: string;
  email: string;
  street: string;
  house_number: number;
  floor: string | null;
  door: string | null;
  apartment_key: string;
  language: ColumnType<Lang, Lang | undefined, Lang>;
  status: ColumnType<WaitlistStatus, WaitlistStatus | undefined, WaitlistStatus>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

type EmailDeliveryStatus = "pending" | "sent" | "failed";

export interface EmailTable {
  id: Generated<string>;
  recipient_email: string;
  language: ColumnType<Lang, Lang | undefined, Lang>;
  subject: string;
  body_html: string;
  status: ColumnType<EmailDeliveryStatus, EmailDeliveryStatus | undefined, EmailDeliveryStatus>;
  edited_before_send: ColumnType<boolean, boolean | undefined, boolean>;
  sent_at: ColumnType<Date, string | null | undefined, string | null>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface RegistrationCancellationTokenTable {
  id: Generated<string>;
  token_hash: string;
  registration_id: string;
  expires_at: ColumnType<Date, string, string>;
  consumed_at: ColumnType<Date | null, string | null | undefined, string | null>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AuditEventTable {
  id: Generated<string>;
  timestamp: ColumnType<Date, string | undefined, never>;
  actor_type: "public" | "admin" | "system";
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before: ColumnType<Record<string, unknown> | null, string | null, never>;
  after: ColumnType<Record<string, unknown> | null, string | null, never>;
  reason: string | null;
}

export type Table = Selectable<TableTable>;
export type NewTable = Insertable<TableTable>;
export type Admin = Selectable<AdminTable>;
export type NewAdmin = Insertable<AdminTable>;
export type AdminCredential = Selectable<AdminCredentialTable>;
export type AdminNotificationPreferences = Selectable<AdminNotificationPreferencesTable>;
export type Session = Selectable<SessionTable>;
export type SystemSettings = Selectable<SystemSettingsTable>;
export type Registration = Selectable<RegistrationTable>;
export type WaitlistEntry = Selectable<WaitlistEntryTable>;
export type Email = Selectable<EmailTable>;
export type AuditEvent = Selectable<AuditEventTable>;
export type RegistrationCancellationToken = Selectable<RegistrationCancellationTokenTable>;
