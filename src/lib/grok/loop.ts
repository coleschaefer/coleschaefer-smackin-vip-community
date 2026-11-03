import type { Db } from "../db";
import { jsonParam } from "../db";
import { newId } from "../ops";
import { loadPolicy } from "../policy";
import { redact } from "../redact";
import { assertToolsAreBounded, executeTool, GROK_TOOLS, systemInstructions, type ToolContext } from "./tools";

interface FunctionCall {
  callId: string;
  name: string;
  arguments: string;
}

interface ModelResponse {
  id?: string;
  calls: FunctionCall[];
  text: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function parseModelResponse(payload: unknown): ModelResponse {
  const body = asRecord(payload);
  const calls: FunctionCall[] = [];
  let text = "";
  const output = Array.isArray(body.output) ? body.output : [];
  for (const item of output) {
    const row = asRecord(item);
    if (row.type === "function_call") {
      calls.push({
        callId: String(row.call_id ?? row.id ?? ""),
        name: String(row.name ?? ""),
        arguments: typeof row.arguments === "string" ? row.arguments : JSON.stringify(row.arguments ?? {}),
      });
    }
    if (row.type === "message" && Array.isArray(row.content)) {
      for (const part of row.content) {
        const content = asRecord(part);
        if (typeof content.text === "string") text += content.text;
      }
    }
  }
  const choices = Array.isArray(body.choices) ? body.choices : [];
  if (choices.length > 0) {
    const message = asRecord(asRecord(choices[0]).message);
    if (typeof message.content === "string") text += message.content;
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    for (const call of toolCalls) {
      const row = asRecord(call);
      const fn = asRecord(row.function);
      calls.push({
        callId: String(row.id ?? ""),
        name: String(fn.name ?? ""),
        arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {}),
      });
    }
  }
  return { id: typeof body.id === "string" ? body.id : undefined, calls, text };
}

export interface GrokRunResult {
  status: "needs_setup" | "succeeded" | "failed";
  runId: string | null;
  text: string;
  trace: unknown[];
  message: string;
}

export async function runGrokTask(
  db: Db,
  purpose: string,
  userPrompt: string,
  options: { fetchImpl?: typeof fetch; now?: Date; actor?: string } = {},
): Promise<GrokRunResult> {
  assertToolsAreBounded();
  const apiKey = process.env.XAI_API_KEY?.trim();
  const model = process.env.XAI_MODEL?.trim() || "grok-4.7";
  const base = (process.env.XAI_BASE_URL?.trim() || "https://api.x.ai").replace(/\/$/, "");
  if (!apiKey) {
    return {
      status: "needs_setup",
      runId: null,
      text: "",
      trace: [],
      message: "XAI_API_KEY is not set. No model request was sent.",
    };
  }
  const policy = loadPolicy();
  const runId = newId();
  const trace: unknown[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const ctx: ToolContext = { db, actor: options.actor ?? "grok", now: options.now ?? new Date() };
  let previousId: string | undefined;
  let input: unknown[] = [{ role: "user", content: userPrompt }];
  let finalText = "";

  try {
    for (let round = 0; round < 4; round += 1) {
      const response = await fetchImpl(`${base}/v1/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions: systemInstructions(policy),
          input,
          tools: GROK_TOOLS,
          previous_response_id: previousId,
        }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        const message = `Grok HTTP ${response.status}`;
        await storeRun(db, runId, purpose, model, "failed", trace, message);
        return { status: "failed", runId, text: "", trace, message };
      }
      const parsed = parseModelResponse(payload);
      previousId = parsed.id ?? previousId;
      if (parsed.calls.length === 0) {
        finalText = parsed.text;
        break;
      }
      const outputs: unknown[] = [];
      for (const call of parsed.calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
        const result = await executeTool(call.name, args, ctx);
        trace.push({ tool: call.name, arguments: redact(args), result: redact(result) });
        outputs.push({
          type: "function_call_output",
          call_id: call.callId,
          output: JSON.stringify(result),
        });
      }
      input = outputs;
    }
    await storeRun(db, runId, purpose, model, "succeeded", trace, null);
    return {
      status: "succeeded",
      runId,
      text: finalText,
      trace,
      message: "Grok tool loop finished. Drafts it stored still need a person to approve them.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grok request failed.";
    await storeRun(db, runId, purpose, model, "failed", trace, message);
    return { status: "failed", runId, text: "", trace, message };
  }
}

async function storeRun(
  db: Db,
  id: string,
  purpose: string,
  model: string,
  status: string,
  trace: unknown[],
  error: string | null,
): Promise<void> {
  await db.query(
    `INSERT INTO grok_runs (id, purpose, model, status, tool_trace, error)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [id, purpose, model, status, jsonParam(redact(trace)), error],
  );
}
