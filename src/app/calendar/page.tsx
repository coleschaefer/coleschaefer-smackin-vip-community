import { Flash } from "../../components/Flash";
import { reviewCalendarAction } from "../actions";
import { getDb, text } from "../../lib/db";
import { evaluateDraft } from "../../lib/gate";
import { listCalendar, listFacts } from "../../lib/ops";
import { loadPolicy } from "../../lib/policy";
import { asDateOnly, weekdayOfIso } from "../../lib/time";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const flash = await searchParams;
  const db = await getDb();
  const items = await listCalendar(db);
  const facts = await listFacts(db);
  const policy = loadPolicy();
  const now = new Date();

  return (
    <main>
      <h1>Calendar</h1>
      <p className="lede">
        Two weeks from the November 3, 2026 setup. At most five posts a week, one routine post a day, on the
        Monday–Sunday pillars. Slots with [CONFIRM] cannot be approved. Nothing here has been published.
      </p>
      <Flash error={flash.error} notice={flash.notice} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Pillar</th><th>Gate</th><th>Draft</th></tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const body = text(row, "body_draft");
              const voice = text(row, "voice") as "assistant" | "founder_draft";
              const gate = evaluateDraft({
                body,
                voice,
                intent: "post",
                now,
                facts,
                policy,
                handoffConfirmed: false,
                recentNormalizedBodies: [],
                repliesToday: 0,
              });
              const date = asDateOnly(row.scheduled_on);
              return (
                <tr key={text(row, "id")}>
                  <td>{date}<div className="meta">{weekdayOfIso(date)}</div></td>
                  <td>{text(row, "pillar")}<div className="meta">{voice}</div></td>
                  <td><span className={gate.pass ? "pill ok" : "pill bad"}>{gate.pass ? "pass" : "blocked"}</span>
                    <div className="meta">{gate.notes.join(" ")}</div>
                  </td>
                  <td>
                    <strong>{text(row, "title")}</strong>
                    <p className="draft">{body}</p>
                    <form action={reviewCalendarAction}>
                      <input type="hidden" name="id" value={text(row, "id")} />
                      <button type="submit">Send to review</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
