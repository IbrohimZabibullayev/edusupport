import { Api, InlineKeyboard } from "grammy";
import { Module, Operator, Request, School, System } from "@prisma/client";
import { prisma } from "../../db";
import { escapeHtml, formatSpan, formatTashkent, formatTashkentDate, ticketId } from "../../util";
import { moduleLabel } from "./modules";
import { requestTypeLabelByKey } from "./requestTypes";

export type CardRequest = Request & {
  system: System | null;
  module: Module;
  school: School;
  operator: Operator;
};

export const cardInclude = { system: true, module: true, school: true, operator: true } as const;

/** Mas'ul odamni tag qiladigan HTML havola (username bo'lmasa ham bildirishnoma boradi) */
export function mentionAssignee(r: Pick<Request, "assigneeTgId" | "assigneeName" | "assigneeUsername">): string {
  if (!r.assigneeTgId) return "";
  if (r.assigneeUsername) return `@${escapeHtml(r.assigneeUsername)}`;
  return `<a href="tg://user?id=${r.assigneeTgId}">${escapeHtml(r.assigneeName ?? "mas'ul")}</a>`;
}

function deadlineLine(r: CardRequest): string {
  if (!r.deadline) return "";
  const left = r.deadline.getTime() - Date.now();
  if (r.done) return `⏰ Muddat: ${formatTashkentDate(r.deadline)}`;
  if (left < 0) return `🔴 Muddat: ${formatTashkentDate(r.deadline)} — ${formatSpan(r.deadline, new Date())} kechikdi`;
  return `⏰ Muddat: ${formatTashkentDate(r.deadline)}`;
}

export async function renderCardText(r: CardRequest): Promise<string> {
  const op = r.operator;
  const operatorLine = op.username
    ? `${escapeHtml(op.fullName)} (@${escapeHtml(op.username)})`
    : escapeHtml(op.fullName);

  const assignee = r.assigneeTgId
    ? `🙋 Mas'ul: ${r.assigneeUsername ? `${escapeHtml(r.assigneeName ?? "")} (@${escapeHtml(r.assigneeUsername)})` : escapeHtml(r.assigneeName ?? "")}`
    : "";

  return [
    ...(r.done ? [`✅ <b>BAJARILDI</b> — ${escapeHtml(r.doneByName ?? "—")} · ${formatSpan(r.createdAt, r.doneAt ?? new Date())}`, ""] : []),
    `${escapeHtml(await requestTypeLabelByKey(r.type))} — <code>${ticketId(r.ticketNumber)}</code>`,
    ...(r.system ? [`🖥 Tizim: ${escapeHtml(r.system.name)}`] : []),
    `🧩 Modul: ${escapeHtml(moduleLabel(r.module))}`,
    `🏫 Maktab: ${escapeHtml(r.school.name)}`,
    `👤 Operator: ${operatorLine}`,
    `🕒 Vaqt: ${formatTashkent(r.createdAt)}`,
    ...(assignee ? [assignee] : []),
    ...(deadlineLine(r) ? [deadlineLine(r)] : []),
    "",
    "💬 <b>Mijoz murojaati:</b>",
    `<blockquote>${escapeHtml(r.description)}</blockquote>`,
  ].join("\n");
}

export function cardKeyboard(r: Pick<Request, "id" | "done" | "assigneeTgId">): InlineKeyboard {
  if (r.done) return new InlineKeyboard().text("🔄 Qayta ochish", `rq:reopen:${r.id}`);
  return new InlineKeyboard()
    .text("✅ Bajarildi", `rq:done:${r.id}`)
    .row()
    .text(r.assigneeTgId ? "🔄 Mas'ulni almashtirish" : "🙋 Men olaman", r.assigneeTgId ? `rq:assign:${r.id}` : `rq:claim:${r.id}`)
    .text("⏰ Muddat", `rq:due:${r.id}`)
    .row()
    .text("👤 Boshqaga berish", `rq:assign:${r.id}`);
}

/** Guruhda turgan kartani bazadagi holatga qarab qayta chizadi */
export async function refreshCard(api: Api, requestId: number): Promise<void> {
  const r = await prisma.request.findUnique({ where: { id: requestId }, include: cardInclude });
  if (!r || !r.cardChatId || !r.cardMessageId) return;
  try {
    await api.editMessageText(r.cardChatId, r.cardMessageId, await renderCardText(r), {
      parse_mode: "HTML",
      reply_markup: cardKeyboard(r),
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    console.error(`${ticketId(r.ticketNumber)} kartasi yangilanmadi:`, err);
  }
}
