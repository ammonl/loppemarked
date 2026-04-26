import { Migrator } from "kysely";
import type { Kysely, Migration, MigrationProvider } from "kysely";
import type { Database } from "./types.js";
import * as m001 from "./migrations/001_initial_schema.js";
import * as m002 from "./migrations/002_renumber_tables.js";
import * as m003 from "./migrations/003_extend_to_24_tables.js";

const migrations: Record<string, Migration> = {
  "001_initial_schema": m001,
  "002_renumber_tables": m002,
  "003_extend_to_24_tables": m003,
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
