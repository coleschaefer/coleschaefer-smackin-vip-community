import { getDb, migrate } from "../src/lib/db";
import { processNextJob } from "../src/lib/jobs";
import { seed } from "../src/lib/seed";

if (!process.env.DATABASE_URL && process.env.REQUIRE_POSTGRES !== "true") {
  console.error(
    "The worker shares a database with the web app. Set DATABASE_URL. Embedded Postgres is single-process and is started by the web app.",
  );
  process.exit(1);
}

const db = await getDb();
await migrate(db);
await seed(db);
const workerId = `worker-${process.pid}`;
console.log(`${workerId} listening`);

for (;;) {
  const job = await processNextJob(db, workerId);
  if (!job) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
