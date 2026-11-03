import { getDb } from "../../../lib/db";
import { getSettings } from "../../../lib/ops";
import { ensureReady } from "../../../lib/ready";
import { databaseUrl } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureReady();
  const settings = await getSettings(await getDb());
  return Response.json({
    ok: true,
    mode: settings.mode,
    publicationPaused: settings.publicationPaused,
    database: databaseUrl() ? "postgres" : "embedded-postgres",
  });
}
