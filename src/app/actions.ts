"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../lib/db";
import { runDemoPath } from "../lib/demo";
import { OpsError } from "../lib/errors";
import {
  acknowledgeFollowUp,
  addFact,
  approveDraft,
  assignOwner,
  attestColePersonalized,
  closeFollowUp,
  confirmHandoff,
  createFollowUp,
  createTask,
  markReadyForPublicUpdate,
  queueHumanPublish,
  recordContribution,
  rejectDraft,
  scheduleBufferBackup,
  sendCalendarToReview,
  setFactStatus,
  submitPermalink,
  updateSettings,
} from "../lib/ops";
import type { OperatingMode } from "../lib/policy";

function finish(path: string, notice?: string, error?: string): never {
  const params = new URLSearchParams();
  if (notice) params.set("notice", notice);
  if (error) params.set("error", error);
  revalidatePath("/", "layout");
  redirect(params.size ? `${path}?${params}` : path);
}

async function act(path: string, work: () => Promise<string>): Promise<void> {
  try {
    finish(path, await work());
  } catch (error) {
    if (error instanceof OpsError) finish(path, undefined, error.message);
    throw error;
  }
}

export async function saveSettings(formData: FormData): Promise<void> {
  const mode = String(formData.get("mode")) as OperatingMode;
  const publicationPaused = formData.get("publicationPaused") === "on";
  await act("/settings", async () => {
    await updateSettings(await getDb(), { mode, publicationPaused }, "operator");
    return "Settings saved.";
  });
}

export async function approveAction(formData: FormData): Promise<void> {
  await act("/review", async () => {
    await approveDraft(await getDb(), String(formData.get("id")), "operator");
    return "Draft approved. It is still not published.";
  });
}

export async function rejectAction(formData: FormData): Promise<void> {
  await act("/review", async () => {
    await rejectDraft(await getDb(), String(formData.get("id")), "operator");
    return "Draft rejected.";
  });
}

export async function coleAction(formData: FormData): Promise<void> {
  await act("/review", async () => {
    await attestColePersonalized(await getDb(), String(formData.get("id")), "operator");
    return "Recorded that Cole personalized this draft. A person still has to post it.";
  });
}

export async function queueAction(formData: FormData): Promise<void> {
  await act("/review", async () => {
    const publication = await queueHumanPublish(await getDb(), String(formData.get("id")), "operator");
    return `Queued for a person to post. Status: ${publication.status}.`;
  });
}

export async function bufferAction(formData: FormData): Promise<void> {
  await act("/review", async () => {
    const publication = await scheduleBufferBackup(await getDb(), String(formData.get("id")), "operator");
    return `Buffer notification status: ${publication.status}. This is not a Facebook publish.`;
  });
}

export async function linkAction(formData: FormData): Promise<void> {
  await act("/review", async () => {
    const publication = await submitPermalink(
      await getDb(),
      String(formData.get("publicationId")),
      String(formData.get("permalink") ?? ""),
      {
        postedByHuman: formData.get("postedByHuman") === "on",
        textMatchesDraft: formData.get("textMatchesDraft") === "on",
        actor: "operator",
      },
      "operator",
    );
    return `Link recorded as ${publication.status}.`;
  });
}

export async function reviewCalendarAction(formData: FormData): Promise<void> {
  await act("/calendar", async () => {
    const draft = await sendCalendarToReview(await getDb(), String(formData.get("id")), "operator");
    return draft.gatePass
      ? "Sent to review. It is not published."
      : `Blocked by the fact gate: ${draft.gateNotes.join(" ")}`;
  });
}

export async function createFollowUpAction(formData: FormData): Promise<void> {
  await act("/follow-ups", async () => {
    const followUp = await createFollowUp(
      await getDb(),
      {
        title: String(formData.get("title") ?? ""),
        memberDisplayName: String(formData.get("member") ?? ""),
        questionText: String(formData.get("question") ?? ""),
        sensitivity: String(formData.get("sensitivity") ?? "ordinary"),
        kind: String(formData.get("kind") ?? "question"),
      },
      "operator",
    );
    return `Follow-up ${followUp.id} opened.`;
  });
}

export async function taskAction(formData: FormData): Promise<void> {
  await act("/follow-ups", async () => {
    await createTask(await getDb(), String(formData.get("id")), String(formData.get("title") ?? "Own the next step"), "operator");
    return "Task added.";
  });
}

export async function acknowledgeAction(formData: FormData): Promise<void> {
  await act("/follow-ups", async () => {
    await acknowledgeFollowUp(await getDb(), String(formData.get("id")), "operator");
    return "Acknowledged.";
  });
}

export async function ownerAction(formData: FormData): Promise<void> {
  await act("/follow-ups", async () => {
    await assignOwner(await getDb(), String(formData.get("id")), String(formData.get("owner") ?? ""), "operator");
    return "Owner assigned.";
  });
}

export async function handoffAction(formData: FormData): Promise<void> {
  await act("/follow-ups", async () => {
    await confirmHandoff(await getDb(), String(formData.get("id")), String(formData.get("note") ?? ""), "operator");
    return "Handoff confirmed.";
  });
}

export async function readyAction(formData: FormData): Promise<void> {
  await act("/follow-ups", async () => {
    await markReadyForPublicUpdate(await getDb(), String(formData.get("id")), "operator");
    return "Marked ready for a public update.";
  });
}

export async function closeAction(formData: FormData): Promise<void> {
  await act("/follow-ups", async () => {
    await closeFollowUp(await getDb(), String(formData.get("id")), String(formData.get("outcome") ?? ""), "operator");
    return "Closed with an outcome.";
  });
}

export async function addFactAction(formData: FormData): Promise<void> {
  await act("/knowledge", async () => {
    await addFact(
      await getDb(),
      {
        slug: String(formData.get("slug") ?? ""),
        statement: String(formData.get("statement") ?? ""),
        status: "unverified",
        category: String(formData.get("category") ?? "operations"),
        sourceNote: "Added by an operator. Unverified until promoted.",
      },
      "operator",
    );
    return "Fact saved as unverified.";
  });
}

export async function verifyFactAction(formData: FormData): Promise<void> {
  await act("/knowledge", async () => {
    await setFactStatus(await getDb(), String(formData.get("slug")), "verified", "operator");
    return "Fact marked verified. Only do this when the statement is actually confirmed.";
  });
}

export async function retireFactAction(formData: FormData): Promise<void> {
  await act("/knowledge", async () => {
    await setFactStatus(await getDb(), String(formData.get("slug")), "retired", "operator");
    return "Fact retired.";
  });
}

export async function contributionAction(formData: FormData): Promise<void> {
  await act("/contributions", async () => {
    await recordContribution(await getDb(), {
      displayName: String(formData.get("name") ?? ""),
      kind: String(formData.get("kind") ?? "comment") as "post" | "comment" | "reaction",
      occurredAt: new Date(String(formData.get("occurredAt") ?? new Date().toISOString())),
      source: "manual",
      body: String(formData.get("body") ?? ""),
    });
    return "Contribution recorded. It was not read from Facebook.";
  });
}

export async function demoAction(formData: FormData): Promise<void> {
  const branch = String(formData.get("branch")) === "unverified" ? "unverified" : "verified";
  await act("/demo", async () => {
    const result = await runDemoPath(await getDb(), branch);
    return `Demo ${result.branch} finished with publication ${result.publicationStatus} and follow-up ${result.followUpState}.`;
  });
}

export async function loginAction(formData: FormData): Promise<void> {
  const expected = process.env.OPS_ACCESS_TOKEN ?? "";
  const given = String(formData.get("token") ?? "");
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  const matches = left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
  if (!matches) finish("/login", undefined, "That token does not match.");
  const jar = await cookies();
  jar.set("ops_token", given, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  finish("/");
}
