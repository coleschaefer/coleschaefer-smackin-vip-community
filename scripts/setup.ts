import { getDb, migrate } from "../src/lib/db";
import { seed } from "../src/lib/seed";

const db = await getDb();
const applied = await migrate(db);
await seed(db);
console.log(applied.length ? `Applied ${applied.join(", ")}` : "Migrations already applied");
console.log(process.env.DATABASE_URL ? "Database: postgres" : "Database: embedded postgres in .data/pglite");
await db.close();
