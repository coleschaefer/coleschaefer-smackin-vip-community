import { Flash } from "../../components/Flash";
import {
  acknowledgeAction,
  closeAction,
  createFollowUpAction,
  handoffAction,
  ownerAction,
  readyAction,
  taskAction,
} from "../actions";
import { getDb } from "../../lib/db";
import { listFollowUps } from "../../lib/ops";

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const flash = await searchParams;
  const items = await listFollowUps(await getDb());
  return (
    <main>
      <h1>Follow-ups</h1>
      <p className="lede">
        States run new → tasked → acknowledged → owned → public update ready → closed. “Passed along” in a public
        reply is allowed only after a confirmed handoff. Closing requires an outcome.
      </p>
      <Flash error={flash.error} notice={flash.notice} />
      <form className="stack" action={createFollowUpAction}>
        <h2>New item</h2>
        <label>Title<input name="title" required /></label>
        <label>Member display name<input name="member" required /></label>
        <label>What they asked<textarea name="question" required /></label>
        <label>Sensitivity
          <select name="sensitivity" defaultValue="ordinary">
            <option>ordinary</option>
            <option>order</option>
            <option>safety</option>
            <option>personal_story</option>
          </select>
        </label>
        <label>Kind
          <select name="kind" defaultValue="question">
            <option>question</option>
            <option>idea</option>
            <option>first_contribution</option>
            <option>founder</option>
          </select>
        </label>
        <button type="submit">Open follow-up</button>
      </form>
      {items.map((item) => (
        <article className="card" key={item.id}>
          <p><span className="pill">{item.state}</span> <span className="pill">{item.sensitivity}</span> <span className="pill">{item.kind}</span></p>
          <h3>{item.title}</h3>
          <p>{item.memberDisplayName}</p>
          <p className="draft">{item.questionText}</p>
          <p className="meta">Owner: {item.ownerLabel ?? "unassigned"} · Handoff: {item.handoffConfirmedAt ? item.handoffNote : "not confirmed"} · Outcome: {item.outcome ?? "—"}</p>
          <div className="row-actions">
            <form action={taskAction}>
              <input type="hidden" name="id" value={item.id} />
              <input name="title" placeholder="Task" defaultValue="Own the next step" />
              <button type="submit">Add task</button>
            </form>
            <form action={acknowledgeAction}><input type="hidden" name="id" value={item.id} /><button className="secondary" type="submit">Acknowledge</button></form>
            <form action={readyAction}><input type="hidden" name="id" value={item.id} /><button className="secondary" type="submit">Ready for public update</button></form>
          </div>
          <form className="stack" action={ownerAction}>
            <input type="hidden" name="id" value={item.id} />
            <label>Owner<input name="owner" defaultValue={item.ownerLabel ?? "Community owner"} /></label>
            <button type="submit">Assign owner</button>
          </form>
          <form className="stack" action={handoffAction}>
            <input type="hidden" name="id" value={item.id} />
            <label>Handoff note<input name="note" placeholder="Who accepted it" /></label>
            <button className="secondary" type="submit">Confirm handoff</button>
          </form>
          <form className="stack" action={closeAction}>
            <input type="hidden" name="id" value={item.id} />
            <label>Outcome<textarea name="outcome" placeholder="What actually happened" /></label>
            <button type="submit">Close</button>
          </form>
        </article>
      ))}
    </main>
  );
}
