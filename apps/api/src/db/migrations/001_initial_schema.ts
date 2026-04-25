import type { Kysely } from "kysely";
import { sql } from "kysely";
import { VISIBLE_TABLE_IDS } from "@loppemarked/shared";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);

  // Tables (flea market tables in Fælledhuset)
  await db.schema
    .createTable("tables")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("state", "varchar(20)", (col) =>
      col.notNull().defaultTo("available"),
    )
    .addColumn("reserved_label", "varchar(200)")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`ALTER TABLE tables ADD CONSTRAINT chk_table_state CHECK (state IN ('available', 'occupied', 'reserved'))`.execute(
    db,
  );

  // Postgres CHECK constraints don't accept bind parameters, so the
  // catalog ids must be inlined as a SQL literal. The values come from a
  // hardcoded module constant so there is no injection surface.
  const catalogIdLiterals = VISIBLE_TABLE_IDS.join(", ");
  await sql`ALTER TABLE tables ADD CONSTRAINT chk_table_id_in_catalog CHECK (id IN (${sql.raw(catalogIdLiterals)}))`.execute(
    db,
  );

  // Admins
  await db.schema
    .createTable("admins")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("email", "varchar(320)", (col) => col.notNull().unique())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Admin credentials
  await db.schema
    .createTable("admin_credentials")
    .addColumn("admin_id", "uuid", (col) =>
      col.primaryKey().references("admins.id").onDelete("cascade"),
    )
    .addColumn("password_hash", "varchar(500)", (col) => col.notNull())
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Admin notification preferences
  await db.schema
    .createTable("admin_notification_preferences")
    .addColumn("admin_id", "uuid", (col) =>
      col.primaryKey().references("admins.id").onDelete("cascade"),
    )
    .addColumn("notify_user_registration", "boolean", (col) =>
      col.notNull().defaultTo(true),
    )
    .addColumn("notify_admin_table_action", "boolean", (col) =>
      col.notNull().defaultTo(true),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Sessions
  await db.schema
    .createTable("sessions")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("admin_id", "uuid", (col) =>
      col.notNull().references("admins.id").onDelete("cascade"),
    )
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_sessions_admin_id")
    .on("sessions")
    .column("admin_id")
    .execute();

  await db.schema
    .createIndex("idx_sessions_expires_at")
    .on("sessions")
    .column("expires_at")
    .execute();

  // System settings (singleton row)
  await db.schema
    .createTable("system_settings")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("opening_datetime", "timestamptz", (col) => col.notNull())
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`CREATE UNIQUE INDEX uq_system_settings_singleton ON system_settings ((true))`.execute(
    db,
  );

  // Registrations (table bookings)
  await db.schema
    .createTable("registrations")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("table_id", "integer", (col) =>
      col.notNull().references("tables.id"),
    )
    .addColumn("name", "varchar(300)", (col) => col.notNull())
    .addColumn("email", "varchar(320)", (col) => col.notNull())
    .addColumn("street", "varchar(200)", (col) => col.notNull())
    .addColumn("house_number", "integer", (col) => col.notNull())
    .addColumn("floor", "varchar(20)")
    .addColumn("door", "varchar(20)")
    .addColumn("apartment_key", "varchar(300)", (col) => col.notNull())
    .addColumn("language", "varchar(5)", (col) =>
      col.notNull().defaultTo("da"),
    )
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().defaultTo("active"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`ALTER TABLE registrations ADD CONSTRAINT chk_registration_status CHECK (status IN ('active', 'switched', 'removed'))`.execute(
    db,
  );
  await sql`ALTER TABLE registrations ADD CONSTRAINT chk_registration_language CHECK (language IN ('da', 'en'))`.execute(
    db,
  );

  // One active occupant per table
  await sql`CREATE UNIQUE INDEX uq_registrations_active_table ON registrations (table_id) WHERE status = 'active'`.execute(
    db,
  );

  await db.schema
    .createIndex("idx_registrations_status")
    .on("registrations")
    .column("status")
    .execute();

  // Waitlist entries
  await db.schema
    .createTable("waitlist_entries")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "varchar(300)", (col) => col.notNull())
    .addColumn("email", "varchar(320)", (col) => col.notNull())
    .addColumn("street", "varchar(200)", (col) => col.notNull())
    .addColumn("house_number", "integer", (col) => col.notNull())
    .addColumn("floor", "varchar(20)")
    .addColumn("door", "varchar(20)")
    .addColumn("apartment_key", "varchar(300)", (col) => col.notNull())
    .addColumn("language", "varchar(5)", (col) =>
      col.notNull().defaultTo("da"),
    )
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().defaultTo("waiting"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`ALTER TABLE waitlist_entries ADD CONSTRAINT chk_waitlist_status CHECK (status IN ('waiting', 'assigned', 'cancelled'))`.execute(
    db,
  );
  await sql`ALTER TABLE waitlist_entries ADD CONSTRAINT chk_waitlist_language CHECK (language IN ('da', 'en'))`.execute(
    db,
  );

  await sql`CREATE UNIQUE INDEX uq_waitlist_active_apartment ON waitlist_entries (apartment_key) WHERE status = 'waiting'`.execute(
    db,
  );

  await db.schema
    .createIndex("idx_waitlist_fifo")
    .on("waitlist_entries")
    .columns(["status", "created_at"])
    .execute();

  // Emails
  await db.schema
    .createTable("emails")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("recipient_email", "varchar(320)", (col) => col.notNull())
    .addColumn("language", "varchar(5)", (col) =>
      col.notNull().defaultTo("da"),
    )
    .addColumn("subject", "varchar(500)", (col) => col.notNull())
    .addColumn("body_html", "text", (col) => col.notNull())
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().defaultTo("pending"),
    )
    .addColumn("edited_before_send", "boolean", (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn("sent_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`ALTER TABLE emails ADD CONSTRAINT chk_email_status CHECK (status IN ('pending', 'sent', 'failed'))`.execute(
    db,
  );
  await sql`ALTER TABLE emails ADD CONSTRAINT chk_email_language CHECK (language IN ('da', 'en'))`.execute(
    db,
  );

  await db.schema
    .createIndex("idx_emails_status")
    .on("emails")
    .column("status")
    .execute();

  // Audit events (immutable)
  await db.schema
    .createTable("audit_events")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("timestamp", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("actor_type", "varchar(20)", (col) => col.notNull())
    .addColumn("actor_id", "varchar(200)")
    .addColumn("action", "varchar(100)", (col) => col.notNull())
    .addColumn("entity_type", "varchar(100)", (col) => col.notNull())
    .addColumn("entity_id", "varchar(200)", (col) => col.notNull())
    .addColumn("before", "jsonb")
    .addColumn("after", "jsonb")
    .addColumn("reason", "text")
    .execute();

  await sql`ALTER TABLE audit_events ADD CONSTRAINT chk_audit_actor_type CHECK (actor_type IN ('public', 'admin', 'system'))`.execute(
    db,
  );

  await db.schema
    .createIndex("idx_audit_events_timestamp")
    .on("audit_events")
    .column("timestamp")
    .execute();

  await db.schema
    .createIndex("idx_audit_events_entity")
    .on("audit_events")
    .columns(["entity_type", "entity_id"])
    .execute();

  await db.schema
    .createIndex("idx_audit_events_action")
    .on("audit_events")
    .column("action")
    .execute();

  await sql`
    CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'audit_events table is immutable: % not allowed', TG_OP;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  await sql`
    CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation()
  `.execute(db);

  // Registration cancellation tokens (resident self-cancellation magic links)
  await db.schema
    .createTable("registration_cancellation_tokens")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("token_hash", "varchar(128)", (col) => col.notNull().unique())
    .addColumn("registration_id", "uuid", (col) =>
      col.notNull().references("registrations.id").onDelete("cascade"),
    )
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_cancellation_tokens_registration")
    .on("registration_cancellation_tokens")
    .column("registration_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS trg_audit_immutable ON audit_events`.execute(
    db,
  );
  await sql`DROP FUNCTION IF EXISTS prevent_audit_mutation()`.execute(db);

  const tables = [
    "registration_cancellation_tokens",
    "audit_events",
    "emails",
    "waitlist_entries",
    "registrations",
    "system_settings",
    "sessions",
    "admin_notification_preferences",
    "admin_credentials",
    "admins",
    "tables",
  ] as const;

  for (const table of tables) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}
