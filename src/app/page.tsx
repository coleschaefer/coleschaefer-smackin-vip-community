import Link from "next/link";
import { Flash } from "../components/Flash";
import { getDb, text } from "../lib/db";
import { founderQueue, listCalendar, listFollowUps } from "../lib/ops";
import { loadPolicy } from "../lib/policy";
import { asDateOnly, chicagoDate, chicagoTime } from "../lib/time";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const flash = await searchParams;
  const db = await getDb();
  const policy = loadPolicy();
  const now = new Date();
  const today = chicagoDate(now);
  const followUps = (await listFollowUps(db)).filter((item) => item.state !== "closed");
  const founders = await founderQueue(db);
  const calendar = await listCalendar(db);
  const todayItems = calendar.filter((row) => asDateOnly(row.scheduled_on) === today);
  const capabilities = await db.query("SELECT status FROM capabilities");
  const counts = capabilities.reduce<Record<string, number>>((acc, row) => {
    const status = text(row, "status");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main>
      <p className="lede">Today · {today} · {chicagoTime(now)} America/Chicago</p>
      <h1>Attention before output</h1>
      <Flash error={flash.error} notice={flash.notice} />
      <p className="lede">
        Listen, answer, follow up, then publish only after a person approves the draft. Review windows are{" "}
        {policy.reviewWindows.localTimes.join(", ")}. They are internal, not a promise to members.
      </p>
      <div className="grid">
        <article className="card">
          <div className="stat">{followUps.length}</div>
          <div className="label">Open follow-ups</div>
        </article>
        <article className="card">
          <div className="stat">{founders.length}</div>
          <div className="label">Items prepared for Cole</div>
        </article>
        <article className="card">
          <div className="stat">{counts.unsupported ?? 0}</div>
          <div className="label">Unsupported Facebook capabilities</div>
        </article>
      </div>
      <div className="banner">
        Hypothesis under test, not a result: notice a member, invite a useful contribution, respond specifically,
        show the outcome, give a reason to return. Primary metric is weekly unique non-staff post and comment
        contributors, plus 7-day and 28-day return. Reactions stay separate.
      </div>
      <h2>Cole’s short queue</h2>
      {founders.length === 0 ? <p>No founder, idea, or first-contribution items are open.</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Kind</th><th>Item</th><th>State</th></tr>
          </thead>
          <tbody>
            {founders.map((item) => (
              <tr key={item.id}>
                <td>{item.kind}</td>
                <td>{item.title}<div className="meta">{item.questionText}</div></td>
                <td>{item.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Due and open</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Title</th><th>Member</th><th>State</th><th>Due</th></tr>
          </thead>
          <tbody>
            {followUps.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.memberDisplayName}</td>
                <td>{item.state}</td>
                <td>{item.dueAt ? new Date(item.dueAt).toISOString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Calendar today</h2>
      {todayItems.length === 0 ? <p>No pillar is scheduled for {today}. That can be the right call.</p> : null}
      {todayItems.map((row) => (
        <article className="card" key={text(row, "id")}>
          <span className="pill">{text(row, "pillar")}</span>
          <h3>{text(row, "title")}</h3>
          <p className="draft">{text(row, "body_draft")}</p>
        </article>
      ))}
      <p>
        <Link href="/capabilities">Capability registry</Link> · <Link href="/demo">Demo path</Link> ·{" "}
        <Link href="/contributions">Contribution report</Link>
      </p>
    </main>
  );
}
