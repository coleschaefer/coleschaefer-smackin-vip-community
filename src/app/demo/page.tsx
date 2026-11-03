import { Flash } from "../../components/Flash";
import { demoAction } from "../actions";
import { getDb, text, asArray } from "../../lib/db";

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const flash = await searchParams;
  const runs = await getDb().then((db) => db.query("SELECT * FROM demo_runs ORDER BY created_at DESC LIMIT 3"));
  return (
    <main>
      <h1>Demo path</h1>
      <p className="lede">
        Fixture only. A member question becomes a task, an approved reply, a human publish record, a verified or
        unverified link, closure, and a contribution count. It does not call Facebook or Buffer. The reply is written
        by the policy composer unless a separate Grok run is configured.
      </p>
      <Flash error={flash.error} notice={flash.notice} />
      <div className="row-actions">
        <form action={demoAction}>
          <input type="hidden" name="branch" value="verified" />
          <button type="submit">Run verified branch</button>
        </form>
        <form action={demoAction}>
          <input type="hidden" name="branch" value="unverified" />
          <button className="secondary" type="submit">Run unverified branch</button>
        </form>
      </div>
      {runs.map((run) => (
        <article className="card" key={text(run, "id")}>
          <h2>{text(run, "branch")}</h2>
          <ol>
            {asArray(run.trace).map((step) => {
              const item = step as { step?: string; detail?: string };
              return <li key={`${text(run, "id")}-${item.step}`}><strong>{item.step}</strong> — {item.detail}</li>;
            })}
          </ol>
        </article>
      ))}
    </main>
  );
}
