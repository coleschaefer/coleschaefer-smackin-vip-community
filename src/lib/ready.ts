import "server-only";
import { getDb, migrate } from "./db";
import { seed } from "./seed";

const globalReady = globalThis as unknown as { __smackinReady?: Promise<void> };

export async function ensureReady(): Promise<void> {
  if (!globalReady.__smackinReady) {
    globalReady.__smackinReady = (async () => {
      const db = await getDb();
      await migrate(db);
      await seed(db);
    })();
  }
  await globalReady.__smackinReady;
}
