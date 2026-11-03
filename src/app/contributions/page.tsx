import { Flash } from "../../components/Flash";
import { contributionAction } from "../actions";
import { getDb } from "../../lib/db";
import { contributionReport } from "../../lib/ops";
import { loadPolicy } from "../../lib/policy";

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const flash = await searchParams;
  const db = await getDb();
  const policy = loadPolicy();
  const now = new Date();
  const official = await contributionReport(db, now, policy.metrics.officialSources, "Official");
  const illustration = await contributionReport(db, now, policy.metrics.illustrationSources, "Illustration");
  return (
    <main>
      <h1>Member contributions</h1>
      <p className="lede">
        Weekly unique non-staff, non-agent authors of posts and comments. Reactions are a separate count.
        Seven-day and 28-day return use matured cohorts only. Staff excluded: {policy.staffExcluded.join(", ")}.
      </p>
      <Flash error={flash.error} notice={flash.notice} />
      <Report title="Official" report={official} empty="No manual or imported contributions yet. The illustration below is not the official number." />
      <Report title="Illustration from tagged sample rows" report={illustration} empty="No sample rows." />
      <p className="meta">{illustration.coverage} Sample rows are not a live Facebook ingest.</p>
      <form className="stack" action={contributionAction}>
        <h2>Record a contribution by hand</h2>
        <label>Display name<input name="name" required /></label>
        <label>Kind
          <select name="kind" defaultValue="comment">
            <option>post</option>
            <option>comment</option>
            <option>reaction</option>
          </select>
        </label>
        <label>When<input name="occurredAt" type="datetime-local" required /></label>
        <label>Note<textarea name="body" /></label>
        <button type="submit">Save manual row</button>
      </form>
    </main>
  );
}

function Report({
  title,
  report,
  empty,
}: {
  title: string;
  report: Awaited<ReturnType<typeof contributionReport>>;
  empty: string;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {report.weeks.length === 0 ? <p>{empty}</p> : null}
      <div className="grid">
        {report.returns.map((item) => (
          <article className="card" key={item.windowDays}>
            <div className="stat">{item.rate == null ? "—" : `${Math.round(item.rate * 100)}%`}</div>
            <div className="label">
              {item.windowDays}-day return · {item.returned}/{item.matured} matured · {item.immature} not yet matured
            </div>
          </article>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Week of</th><th>Unique contributors</th><th>First time</th><th>Returning</th>
              <th>Posts</th><th>Comments</th><th>Reactions</th><th>Staff or agent excluded</th>
            </tr>
          </thead>
          <tbody>
            {report.weeks.map((week) => (
              <tr key={week.weekStart}>
                <td>{week.weekStart}</td>
                <td>{week.uniqueContributors}</td>
                <td>{week.firstTime}</td>
                <td>{week.returning}</td>
                <td>{week.posts}</td>
                <td>{week.comments}</td>
                <td>{week.reactions}</td>
                <td>{week.staffOrAgentExcluded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
