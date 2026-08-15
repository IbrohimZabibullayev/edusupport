import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config";
import { AiProvider, AiTurn, AiToolCall, ModelStep, ToolSchema } from "../types";

/**
 * Anthropic (Claude) provayderi.
 *
 * Keshlash chegarasi system blokida: undan oldin tool sxemalari turadi, ya'ni
 * ikkalasi birga keshlanadi. Bu prefiks har chaqiruvda bir xil, shuning uchun
 * xarajatning katta qismi 0.1x narxda o'qishga aylanadi.
 */

const EFFORT = "low" as const;
const MAX_TOKENS = 8000;

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

/** Neytral tarixni Anthropic xabarlariga o'giradi */
function toMessages(turns: AiTurn[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const turn of turns) {
    if (turn.role === "user") {
      out.push({ role: "user", content: turn.text });
      continue;
    }
    if (turn.role === "model") {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (turn.text) blocks.push({ type: "text", text: turn.text });
      for (const c of turn.calls ?? []) {
        blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
      }
      if (blocks.length > 0) out.push({ role: "assistant", content: blocks });
      continue;
    }
    out.push({
      role: "user",
      content: turn.results.map((r) => ({
        type: "tool_result" as const,
        tool_use_id: r.id,
        content: JSON.stringify(r.output),
      })),
    });
  }
  return out;
}

export const anthropicProvider: AiProvider = {
  name: "anthropic",
  model: config.aiModel || "claude-sonnet-5",

  async step(system: string, turns: AiTurn[], tools: ToolSchema[]): Promise<ModelStep> {
    const response = await anthropic().messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      output_config: { effort: EFFORT },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })),
      messages: toMessages(turns),
    });

    if (response.stop_reason === "refusal") return { text: "", calls: [], refused: true };

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const calls: AiToolCall[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));

    return { text, calls };
  },
};
