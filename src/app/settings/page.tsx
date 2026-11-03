import Link from "next/link";
import { Flash } from "../../components/Flash";
import { saveSettings } from "../actions";
import { getDb } from "../../lib/db";
import { getSettings } from "../../lib/ops";
import { loadPolicy } from "../../lib/policy";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const flash = await searchParams;
  const settings = await getSettings(await getDb());
  const policy = loadPolicy();
  const tokenOn = Boolean(process.env.OPS_ACCESS_TOKEN);
  return (
    <main>
      <h1>Settings</h1>
      <p className="lede">
        Policy version {policy.version} is loaded from <code>policy/runtime-policy.yaml</code>. Default mode is draft.
        Pausing publication stops the human queue and the Buffer backup.
      </p>
      <Flash error={flash.error} notice={flash.notice} />
      {!tokenOn ? (
        <div className="banner">No OPS_ACCESS_TOKEN is set. This screen is open on this machine. Set a token before anyone else can reach it.</div>
      ) : null}
      <form className="stack" action={saveSettings}>
        <label>Mode
          <select name="mode" defaultValue={settings.mode}>
            <option value="observe">observe</option>
            <option value="draft">draft</option>
            <option value="bounded_live">bounded live</option>
          </select>
        </label>
        <label>
          <input type="checkbox" name="publicationPaused" defaultChecked={settings.publicationPaused} /> Pause publication
        </label>
        <button type="submit">Save</button>
      </form>
      <h2>Operating limits</h2>
      <ul>
        <li>Assistant: {policy.identity.assistantName}. Never impersonates {policy.identity.neverImpersonate.join(", ")}.</li>
        <li>Posts: at most {policy.contentRhythm.maxPostsPerWeek} a week, {policy.contentRhythm.maxRoutinePostsPerDay} routine post a day.</li>
        <li>Replies: at most {policy.replyCaps.maxPublicRepliesPerStaffedDay} public replies per staffed day.</li>
        <li>Support email: {policy.support.email}.</li>
        <li>Group: {policy.group.url}</li>
        <li>Buffer channel {policy.buffer.channelId} is {policy.buffer.role} with scheduling type {policy.buffer.schedulingType}.</li>
        <li>Drive folder {policy.drive.folderId}.</li>
      </ul>
      <p><Link href="/capabilities">Capability registry</Link> · <Link href="/demo">Demo path</Link></p>
    </main>
  );
}
