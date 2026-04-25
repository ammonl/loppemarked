import type { Kysely } from "kysely";
import {
  DEFAULT_OPENING_DATETIME,
  OPENING_TIMEZONE,
  SEED_ADMIN_EMAILS,
  VISIBLE_TABLE_IDS,
} from "@loppemarked/shared";

import type { Database } from "./types.js";

/**
 * Return seed rows for the `tables` table — one row per visible flea-market
 * table, all in the `available` state.
 */
export function getTableRows(): Array<{ id: number; state: "available" }> {
  return VISIBLE_TABLE_IDS.map((id) => ({ id, state: "available" as const }));
}

/**
 * Return admin seed emails. Passwords must be hashed before insertion.
 */
export function getAdminEmails(): readonly string[] {
  return SEED_ADMIN_EMAILS;
}

/**
 * Seed the database with initial data.
 * Requires a password hash function to be provided (avoids bundling bcrypt/argon2 here).
 */
export async function seed(
  db: Kysely<Database>,
  hashPassword: (password: string) => Promise<string>,
  initialPassword: string,
): Promise<void> {
  // Seed tables
  const tableRows = getTableRows();
  await db
    .insertInto("tables")
    .values(tableRows)
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  // Seed system settings (opening datetime) interpreted in Copenhagen timezone
  const openingTimestamp = `${DEFAULT_OPENING_DATETIME} ${OPENING_TIMEZONE}`;
  const existing = await db
    .selectFrom("system_settings")
    .select("id")
    .executeTakeFirst();

  if (!existing) {
    await db
      .insertInto("system_settings")
      .values({ opening_datetime: openingTimestamp })
      .execute();
  }

  // Seed initial admin accounts
  const passwordHash = await hashPassword(initialPassword);

  for (const email of SEED_ADMIN_EMAILS) {
    const existingAdmin = await db
      .selectFrom("admins")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();

    if (!existingAdmin) {
      const [admin] = await db
        .insertInto("admins")
        .values({ email })
        .returning("id")
        .execute();

      await db
        .insertInto("admin_credentials")
        .values({
          admin_id: admin.id,
          password_hash: passwordHash,
        })
        .execute();
    }
  }
}
