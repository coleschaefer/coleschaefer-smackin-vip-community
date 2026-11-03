import { Flash } from "../../components/Flash";
import { addFactAction, retireFactAction, verifyFactAction } from "../actions";
import { getDb } from "../../lib/db";
import { listFacts } from "../../lib/ops";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const flash = await searchParams;
  const facts = await listFacts(await getDb());
  return (
    <main>
      <h1>Knowledge</h1>
      <p className="lede">
        Only verified facts can support a price, date, or access claim. Unverified notes are memory, not permission
        to invent an offer. The support route on file is contact@smackinsnacks.com.
      </p>
      <Flash error={flash.error} notice={flash.notice} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Fact</th><th>Status</th><th>Window</th><th></th></tr>
          </thead>
          <tbody>
            {facts.map((fact) => (
              <tr key={fact.slug}>
                <td><strong>{fact.slug}</strong><div>{fact.statement}</div><div className="meta">{fact.sourceNote}</div></td>
                <td><span className={fact.status === "verified" ? "pill ok" : "pill warn"}>{fact.status}</span></td>
                <td>{fact.effectiveFrom ?? "—"} → {fact.effectiveUntil ?? "open"}</td>
                <td>
                  <form action={verifyFactAction}><input type="hidden" name="slug" value={fact.slug} /><button type="submit">Mark verified</button></form>
                  <form action={retireFactAction}><input type="hidden" name="slug" value={fact.slug} /><button className="secondary" type="submit">Retire</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="stack" action={addFactAction}>
        <h2>Add an unverified fact</h2>
        <label>Slug<input name="slug" required placeholder="single-bag-trial" /></label>
        <label>Category<input name="category" defaultValue="offer" /></label>
        <label>Statement<textarea name="statement" required /></label>
        <button type="submit">Save unverified</button>
      </form>
    </main>
  );
}
