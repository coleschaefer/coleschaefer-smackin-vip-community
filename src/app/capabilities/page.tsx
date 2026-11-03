import { getDb, text, asObject } from "../../lib/db";

export default async function CapabilitiesPage() {
  const rows = await getDb().then((db) => db.query("SELECT * FROM capabilities ORDER BY key"));
  return (
    <main>
      <h1>Capability registry</h1>
      <p className="lede">
        Status is what this app can actually do. Unsupported means no amount of configuration restores a removed
        Facebook Groups API. Needs setup means a credential is missing. Degraded means a real limit or a bad record
        is already visible.
      </p>
      {rows.map((row) => {
        const status = text(row, "status");
        const evidence = asObject(row.evidence);
        return (
          <article className="card" key={text(row, "key")}>
            <p>
              <span className={status === "supported" ? "pill ok" : status === "unsupported" ? "pill bad" : "pill warn"}>{status}</span>
            </p>
            <h2>{text(row, "name")}</h2>
            <p className="meta">{text(row, "key")}</p>
            <p>{text(row, "summary")}</p>
            <pre className="draft">{JSON.stringify(evidence, null, 2)}</pre>
          </article>
        );
      })}
    </main>
  );
}
