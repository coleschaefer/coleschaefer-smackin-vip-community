import { Flash } from "../../components/Flash";
import {
  approveAction,
  bufferAction,
  coleAction,
  linkAction,
  queueAction,
  rejectAction,
} from "../actions";
import { getDb } from "../../lib/db";
import { listDrafts, listPublications } from "../../lib/ops";
import { loadPolicy } from "../../lib/policy";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const flash = await searchParams;
  const db = await getDb();
  const drafts = await listDrafts(db);
  const publications = await listPublications(db);
  const policy = loadPolicy();

  return (
    <main>
      <h1>Review</h1>
      <p className="lede">
        Approval does not publish. The primary path is a person posting in the group, then pasting the permalink.
        Buffer ({policy.buffer.channelId}) is backup notification only, and only in bounded live mode.
      </p>
      <Flash error={flash.error} notice={flash.notice} />
      {drafts.map((draft) => {
        const related = publications.filter((item) => item.draftId === draft.id);
        return (
          <article className="card" key={draft.id}>
            <p>
              <span className={draft.gatePass ? "pill ok" : "pill bad"}>{draft.status}</span>{" "}
              <span className="pill">{draft.voice}</span> <span className="pill">{draft.author}</span>
            </p>
            <p className="draft">{draft.body}</p>
            {draft.gateNotes.length > 0 ? <p className="meta">{draft.gateNotes.join(" ")}</p> : null}
            <div className="row-actions">
              <form action={approveAction}><input type="hidden" name="id" value={draft.id} /><button type="submit">Approve</button></form>
              <form action={rejectAction}><input type="hidden" name="id" value={draft.id} /><button className="secondary" type="submit">Reject</button></form>
              {draft.voice === "founder_draft" ? (
                <form action={coleAction}><input type="hidden" name="id" value={draft.id} /><button className="secondary" type="submit">Cole personalized this</button></form>
              ) : null}
              <form action={queueAction}><input type="hidden" name="id" value={draft.id} /><button type="submit">Queue for a person to post</button></form>
              <form action={bufferAction}><input type="hidden" name="id" value={draft.id} /><button className="secondary" type="submit">Buffer notification backup</button></form>
            </div>
            {related.map((publication) => (
              <form className="stack" action={linkAction} key={publication.id}>
                <input type="hidden" name="publicationId" value={publication.id} />
                <p className="meta">{publication.channel} · {publication.status} · {publication.evidence}</p>
                <label>Permalink after a person posts it
                  <input name="permalink" placeholder="https://www.facebook.com/groups/604690051505802/posts/…" defaultValue={publication.permalink ?? ""} />
                </label>
                <label><input type="checkbox" name="postedByHuman" /> A person posted this</label>
                <label><input type="checkbox" name="textMatchesDraft" /> The live text matches this draft</label>
                <button type="submit">Record link</button>
              </form>
            ))}
          </article>
        );
      })}
    </main>
  );
}
