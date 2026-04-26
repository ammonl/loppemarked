import type { Kysely } from "kysely";
import { sql } from "kysely";
import { VISIBLE_TABLE_IDS } from "@loppemarked/shared";

/**
 * Shift every existing table id up by one and seed a new id 1 so the
 * catalog grows from 23 to 24 entries. The relocation of the 150x135
 * table to the new top-of-column slot, the size swap between old #2
 * and old #15, and the replacement of old #20's slot with an 80x180
 * are all handled in the catalog metadata; this migration only has to
 * keep DB ids and constraints aligned with the new numbering.
 *
 * The catalog id check constraint and the registrations FK are
 * temporarily dropped so existing rows can be remapped in place; both
 * are restored against the new id list at the end of the migration.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE tables DROP CONSTRAINT IF EXISTS chk_table_id_in_catalog`.execute(db);
  await sql`ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_table_id_fkey`.execute(db);

  // Shift descending so each UPDATE sees a free target id.
  for (let oldId = 23; oldId >= 1; oldId--) {
    const newId = oldId + 1;
    await sql`UPDATE registrations SET table_id = ${sql.lit(newId)} WHERE table_id = ${sql.lit(oldId)}`.execute(db);
    await sql`UPDATE tables SET id = ${sql.lit(newId)} WHERE id = ${sql.lit(oldId)}`.execute(db);
  }

  await sql`INSERT INTO tables (id, state) VALUES (1, 'available') ON CONFLICT (id) DO NOTHING`.execute(db);

  await sql`ALTER TABLE registrations ADD CONSTRAINT registrations_table_id_fkey FOREIGN KEY (table_id) REFERENCES tables(id)`.execute(
    db,
  );

  const catalogIdLiterals = VISIBLE_TABLE_IDS.join(", ");
  await sql`ALTER TABLE tables ADD CONSTRAINT chk_table_id_in_catalog CHECK (id IN (${sql.raw(catalogIdLiterals)}))`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE tables DROP CONSTRAINT IF EXISTS chk_table_id_in_catalog`.execute(db);
  await sql`ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_table_id_fkey`.execute(db);

  // Drop the new id 1 row and any registrations attached to it before shifting back.
  await sql`DELETE FROM registrations WHERE table_id = 1`.execute(db);
  await sql`DELETE FROM tables WHERE id = 1`.execute(db);

  // Shift ascending so each UPDATE sees a free target id.
  for (let newId = 2; newId <= 24; newId++) {
    const oldId = newId - 1;
    await sql`UPDATE registrations SET table_id = ${sql.lit(oldId)} WHERE table_id = ${sql.lit(newId)}`.execute(db);
    await sql`UPDATE tables SET id = ${sql.lit(oldId)} WHERE id = ${sql.lit(newId)}`.execute(db);
  }

  await sql`ALTER TABLE registrations ADD CONSTRAINT registrations_table_id_fkey FOREIGN KEY (table_id) REFERENCES tables(id)`.execute(
    db,
  );

  const previousIds = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  ].join(", ");
  await sql`ALTER TABLE tables ADD CONSTRAINT chk_table_id_in_catalog CHECK (id IN (${sql.raw(previousIds)}))`.execute(
    db,
  );
}
