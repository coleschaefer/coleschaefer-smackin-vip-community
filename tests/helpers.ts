import { createPglite, migrate, type Db } from "../src/lib/db";
import { seed } from "../src/lib/seed";

export async function freshDb(): Promise<Db> {
  const db = await createPglite();
  await migrate(db);
  await db.query(
    `INSERT INTO app_settings (id, mode, publication_paused, timezone)
     VALUES ('default', 'draft', false, 'America/Chicago')`,
  );
  return db;
}

export async function seededDb(): Promise<Db> {
  const db = await createPglite();
  await migrate(db);
  await seed(db);
  return db;
}
