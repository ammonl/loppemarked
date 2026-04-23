import { Migrator } from "kysely";
import type { Kysely, Migration, MigrationProvider } from "kysely";
import type { Database } from "./types.js";
import * as m001 from "./migrations/001_initial_schema.js";
import * as m002 from "./migrations/002_allow_duplicate_apartment_registrations.js";
import * as m003 from "./migrations/003_admin_notification_preferences.js";
import * as m004 from "./migrations/004_waitlist_greenhouse_preference.js";
import * as m005 from "./migrations/005_registration_cancellation_tokens.js";

const migrations: Record<string, Migration> = {
  "001_initial_schema": m001,
  "002_allow_duplicate_apartment_registrations": m002,
  "003_admin_notification_preferences": m003,
  "004_waitlist_greenhouse_preference": m004,
  "005_registration_cancellation_tokens": m005,
};

export class InlineMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

export function createInlineMigrator(db: Kysely<Database>): Migrator {
  return new Migrator({
    db,
    provider: new InlineMigrationProvider(),
  });
}

export async function migrateToLatestInline(
  db: Kysely<Database>,
): Promise<{ success: boolean; executedMigrations: string[] }> {
  const migrator = createInlineMigrator(db);
  const { error, results } = await migrator.migrateToLatest();

  const executedMigrations = (results ?? [])
    .filter((r) => r.status === "Success")
    .map((r) => r.migrationName);

  if (error) {
    throw error;
  }

  return { success: true, executedMigrations };
}
