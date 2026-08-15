import { Content, FunctionDeclaration, GoogleGenAI, Part, Schema, Type } from "@google/genai";
import { config } from "../../config";
import { AiProvider, AiTurn, AiToolCall, ModelStep, ToolSchema } from "../types";

/**
 * Google AI Studio (Gemini) provayderi.
 *
 * Gemini formati Anthropic'nikidan ikki joyda jiddiy farq qiladi:
 *  1. Tizim ko'rsatmasi xabarlar ichida emas, alohida `systemInstruction` da.
 *  2. Amal natijasi "tool" degan alohida rol emas — u "user" rolidagi
 *     xabarning `functionResponse` qismi bo'lib qaytariladi.
 */

let client: GoogleGenAI | null = null;

function genai(): GoogleGenAI {
  if (!client) {
    // baseUrl — proksi orqali ishlash va testda soxta server ko'tarish uchun
    const baseUrl = process.env.GOOGLE_BASE_URL;
    client = new GoogleGenAI({
      apiKey: config.googleApiKey,
      ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
    });
  }
  return client;
}

/** JSON Schema tipini Gemini kutgan enumga o'giradi */
function toType(raw: unknown): Type {
  switch (String(raw)) {
    case "string":
      return Type.STRING;
    case "number":
      return Type.NUMBER;
    case "integer":
      return Type.INTEGER;
    case "boolean":
      return Type.BOOLEAN;
    case "array":
      return Type.ARRAY;
    case "object":
      return Type.OBJECT;
    default:
      return Type.STRING;
  }
}

/**
 * Bizning sxemalarimiz sodda (satr, son, mantiqiy, ro'yxat, enum), shuning
 * uchun to'liq JSON Schema qo'llab-quvvatlash shart emas — kerakli qismini
 * o'giramiz. Noma'lum kalitlar tashlab yuboriladi: Gemini ularga 400 beradi.
 */
function toSchema(node: Record<string, unknown>): Schema {
  const out: Schema = { type: toType(node.type) };
  if (typeof node.description === "string") out.description = node.description;
  if (Array.isArray(node.enum)) out.enum = node.enum.map(String);
  if (node.items && typeof node.items === "object") {
    out.items = toSchema(node.items as Record<string, unknown>);
  }
  if (node.properties && typeof node.properties === "object") {
    out.properties = Object.fromEntries(
      Object.entries(node.properties as Record<string, Record<string, unknown>>).map(([k, v]) => [k, toSchema(v)])
    );
  }
  if (Array.isArray(node.required)) out.required = node.required.map(String);
  return out;
}

function toDeclarations(tools: ToolSchema[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: toSchema(t.input_schema as unknown as Record<string, unknown>),
  }));
}

/** Neytral tarixni Gemini `contents` ga o'giradi */
function toContents(turns: AiTurn[]): Content[] {
  const out: Content[] = [];
  for (const turn of turns) {
    if (turn.role === "user") {
      out.push({ role: "user", parts: [{ text: turn.text }] });
      continue;
    }
    if (turn.role === "model") {
      const parts: Part[] = [];
      if (turn.text) parts.push({ text: turn.text });
      for (const c of turn.calls ?? []) parts.push({ functionCall: { name: c.name, args: c.input } });
      // Bo'sh part ro'yxati bilan Gemini 400 qaytaradi
      if (parts.length > 0) out.push({ role: "model", parts });
      continue;
    }
    // Amal natijalari — Gemini'da "user" rolining functionResponse qismlari
    const parts: Part[] = turn.results.map((r) => ({
      functionResponse: { name: r.name, response: asRecord(r.output) },
    }));
    if (parts.length > 0) out.push({ role: "user", parts });
  }
  return out;
}

/** functionResponse.response obyekt bo'lishi shart */
function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return { result: value };
}

export const googleProvider: AiProvider = {
  name: "google",
  model: config.aiModel || "gemini-2.5-flash",

  async step(system: string, turns: AiTurn[], tools: ToolSchema[]): Promise<ModelStep> {
    const response = await genai().models.generateContent({
      model: this.model,
      contents: toContents(turns),
      config: {
        systemInstruction: system,
        tools: [{ functionDeclarations: toDeclarations(tools) }],
        maxOutputTokens: 8000,
        // Javoblar qisqa va bir xil bo'lishi kerak — bu ijodiy vazifa emas
        temperature: 0.3,
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => typeof p.text === "string" && !p.thought)
      .map((p) => p.text as string)
      .join("")
      .trim();

    const calls: AiToolCall[] = [];
    for (const [i, p] of parts.entries()) {
      if (!p.functionCall?.name) continue;
      calls.push({
        // Gemini id bermasligi mumkin — tartib raqamidan barqaror id yasaymiz
        id: p.functionCall.id ?? `call_${turns.length}_${i}`,
        name: p.functionCall.name,
        input: (p.functionCall.args ?? {}) as Record<string, unknown>,
      });
    }

    // Xavfsizlik filtri to'xtatgan bo'lsa matn ham, amal ham bo'lmaydi
    const blocked = response.candidates?.[0]?.finishReason === "SAFETY";
    return { text, calls, refused: blocked };
  },
};
