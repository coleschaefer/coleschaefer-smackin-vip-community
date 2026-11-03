import { getDb, nullableText, text } from "../../lib/db";
import { countByAction, listLearning } from "../../lib/ops";

export default async function LearningPage() {
  const db = await getDb();
  const notes = await listLearning(db);
  const blocked = await countByAction(db, "draft.create");
  return (
    <main>
      <h1>Learning</h1>
      <p className="lede">
        Keep criticism. Do not treat a giveaway spike or one prolific member as broad participation. Guardrail
        events live in the action log.
      </p>
      <div className="grid">
        <article className="card">
          <div className="stat">{notes.length}</div>
          <div className="label">Notes on file</div>
        </article>
        <article className="card">
          <div className="stat">{blocked}</div>
          <div className="label">Draft attempts logged</div>
        </article>
      </div>
      {notes.map((note) => (
        <article className="card" key={text(note, "id")}>
          <p className="meta">{text(note, "week_key")} · {text(note, "source")}</p>
          <p>{text(note, "observation")}</p>
          {nullableText(note, "decision") ? <p className="meta">Decision: {nullableText(note, "decision")}</p> : null}
        </article>
      ))}
    </main>
  );
}
