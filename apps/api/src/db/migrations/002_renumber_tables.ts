import type { Kysely } from "kysely";
import { sql } from "kysely";
import { VISIBLE_TABLE_IDS } from "@loppemarked/shared";

/**
 * Renumber the right-wall tables so the catalog is contiguous: old id 23
 * becomes 22, and old id 24 becomes 23. The catalog id check constraint
 * and the registrations FK have to be temporarily relaxed so the rows can
 * be remapped in place; both are restored against the new id list at the
 * end of the migration.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE tables DROP CONSTRAINT IF EXISTS chk_table_id_in_catalog`.execute(db);
  await sql`ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_table_id_fkey`.execute(db);

  await sql`UPDATE registrations SET table_id = 22 WHERE table_id = 23`.execute(db);
  await sql`UPDATE registrations SET table_id = 23 WHERE table_id = 24`.execute(db);

  await sql`UPDATE tables SET id = 22 WHERE id = 23`.execute(db);
  await sql`UPDATE tables SET id = 23 WHERE id = 24`.execute(db);

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

  await sql`UPDATE tables SET id = 24 WHERE id = 23`.execute(db);
  await sql`UPDATE tables SET id = 23 WHERE id = 22`.execute(db);

  await sql`UPDATE registrations SET table_id = 24 WHERE table_id = 23`.execute(db);
  await sql`UPDATE registrations SET table_id = 23 WHERE table_id = 22`.execute(db);

  await sql`ALTER TABLE registrations ADD CONSTRAINT registrations_table_id_fkey FOREIGN KEY (table_id) REFERENCES tables(id)`.execute(
    db,
  );

  const previousIds = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24,
  ].join(", ");
  await sql`ALTER TABLE tables ADD CONSTRAINT chk_table_id_in_catalog CHECK (id IN (${sql.raw(previousIds)}))`.execute(
    db,
  );
}
