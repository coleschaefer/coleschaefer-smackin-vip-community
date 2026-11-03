import { getDb, migrate } from "../src/lib/db";
import { runDemoPath } from "../src/lib/demo";
import { seed } from "../src/lib/seed";

const branch = process.argv[2] === "unverified" ? "unverified" : "verified";
const db = await getDb();
await migrate(db);
await seed(db);
const result = await runDemoPath(db, branch);
console.log(JSON.stringify(result, null, 2));
await db.close();
