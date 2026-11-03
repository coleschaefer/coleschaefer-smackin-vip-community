import { afterEach, expect, it } from "vitest";
import type { Db } from "../src/lib/db";
import { parseModelResponse, runGrokTask } from "../src/lib/grok/loop";
import { GROK_TOOLS } from "../src/lib/grok/tools";
import { freshDb } from "./helpers";
import { addFact } from "../src/lib/ops";

const open: Db[] = [];

afterEach(async () => {
  delete process.env.XAI_API_KEY;
  await Promise.all(open.splice(0).map((item) => item.close()));
});

it("does not call Grok without a key", async () => {
  const db = await freshDb();
  open.push(db);
  let called = false;
  const result = await runGrokTask(db, "test", "Who answers orders?", {
    fetchImpl: (() => {
      called = true;
      throw new Error("should not be called");
    }) as typeof fetch,
  });
  expect(result.status).toBe("needs_setup");
  expect(called).toBe(false);
});

it("executes a tool call and stores a redacted trace", async () => {
  const db = await freshDb();
  open.push(db);
  await addFact(
    db,
    {
      slug: "support-email",
      statement: "Private order support email is contact@smackinsnacks.com.",
      status: "verified",
      category: "support",
      sourceNote: "test",
      effectiveFrom: "2026-11-03",
    },
    "test",
  );
  process.env.XAI_API_KEY = "xai-test-secret-value";
  const seen: unknown[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      tools: { name: string }[];
      previous_response_id?: string;
      instructions: string;
    };
    seen.push(body);
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer xai-test-secret-value");
    if (!body.previous_response_id) {
      return new Response(
        JSON.stringify({
          id: "resp_1",
          output: [
            {
              type: "function_call",
              call_id: "call_1",
              name: "search_knowledge",
              arguments: JSON.stringify({ query: "support" }),
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        id: "resp_2",
        output: [{ type: "message", content: [{ type: "output_text", text: "Use the support fact." }] }],
      }),
      { status: 200 },
    );
  };
  const result = await runGrokTask(db, "support-question", "Where do order questions go?", { fetchImpl });
  expect(result.status).toBe("succeeded");
  expect(result.text).toContain("support");
  expect(JSON.stringify(result.trace)).toContain("contact@smackinsnacks.com");
  expect(JSON.stringify(result.trace)).not.toContain("xai-test-secret-value");
  const first = seen[0] as { tools: { name: string }[]; instructions: string };
  expect(first.tools.map((tool) => tool.name)).toEqual(GROK_TOOLS.map((tool) => tool.name));
  expect(first.instructions).toMatch(/not Cole/);
  const runs = await db.query("SELECT status, tool_trace FROM grok_runs");
  expect(runs[0]?.status).toBe("succeeded");
  expect(JSON.stringify(runs[0]?.tool_trace)).not.toContain("xai-test-secret-value");
});

it("parses legacy chat-completions tool calls", () => {
  const parsed = parseModelResponse({
    choices: [
      {
        message: {
          content: "",
          tool_calls: [{ id: "call_9", function: { name: "get_operating_facts", arguments: "{}" } }],
        },
      },
    ],
  });
  expect(parsed.calls[0]?.name).toBe("get_operating_facts");
});
