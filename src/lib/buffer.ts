import type { Policy } from "./policy";

export const BUFFER_ENDPOINT = "https://api.buffer.com";

const MUTATION = `mutation CreateGroupNotification($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess { post { id dueAt } }
    ... on MutationError { message }
  }
}`;

export interface NotificationInput {
  text: string;
  dueAt?: string;
}

export function notificationVariables(policy: Policy, input: NotificationInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    text: input.text,
    channelId: policy.buffer.channelId,
    schedulingType: "notification",
    mode: input.dueAt ? "customScheduled" : "addToQueue",
  };
  if (input.dueAt) body.dueAt = input.dueAt;
  return { input: body };
}

export function assertNotificationPayload(variables: Record<string, unknown>): void {
  const input = variables.input as Record<string, unknown>;
  if (input.schedulingType !== "notification") {
    throw new Error("Facebook group backup refuses any schedulingType other than notification.");
  }
  if (JSON.stringify(variables).includes("automatic")) {
    throw new Error("Refusing a Buffer payload that mentions automatic publishing.");
  }
}

export interface BufferCallResult {
  ok: boolean;
  status: "needs_setup" | "scheduled" | "failed";
  bufferPostId?: string;
  dueAt?: string;
  message: string;
}

export async function scheduleGroupNotification(
  policy: Policy,
  input: NotificationInput,
  fetchImpl: typeof fetch = fetch,
): Promise<BufferCallResult> {
  const apiKey = process.env.BUFFER_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      status: "needs_setup",
      message: "BUFFER_API_KEY is not set. No Buffer request was sent.",
    };
  }
  const variables = notificationVariables(policy, input);
  assertNotificationPayload(variables);
  const response = await fetchImpl(BUFFER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: MUTATION, variables }),
  });
  const payload = (await response.json()) as {
    data?: { createPost?: { post?: { id?: string; dueAt?: string }; message?: string } };
    errors?: { message: string }[];
  };
  if (!response.ok || payload.errors?.length) {
    return {
      ok: false,
      status: "failed",
      message: payload.errors?.[0]?.message ?? `Buffer HTTP ${response.status}`,
    };
  }
  const created = payload.data?.createPost;
  if (!created?.post?.id) {
    return {
      ok: false,
      status: "failed",
      message: created?.message ?? "Buffer did not return a post id.",
    };
  }
  return {
    ok: true,
    status: "scheduled",
    bufferPostId: created.post.id,
    dueAt: created.post.dueAt,
    message:
      "Buffer queued a notification reminder. That is not a Facebook publish. Paste the group permalink after a person posts it.",
  };
}
