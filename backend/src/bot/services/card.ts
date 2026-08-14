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

/**
 * Mas'ul odamni tag qiladigan matn.
 * @username orqali tayinlanganda Telegram ID bermaydi — o'shanda username bilan
 * tag qilamiz; ID bo'lsa (tugma yoki text_mention) havola bilan.
 */
export function mentionAssignee(
  r: Pick<Request, "assigneeTgId" | "assigneeName" | "assigneeUsername"> & { assigneeExtra?: string | null }
): string {
  // ID barqarorroq (username o'zgarishi mumkin), shuning uchun avval o'sha
  const main = r.assigneeTgId
    ? `<a href="tg://user?id=${r.assigneeTgId}">${escapeHtml(r.assigneeName ?? "mas'ul")}</a>`
    : r.assigneeUsername
      ? `@${escapeHtml(r.assigneeUsername)}`
      : "";
  // Qo'shimcha mas'ullar ham eslatmada tag qilinishi kerak — aks holda ular
  // o'zlariga tegishli ish borligini bilmay qoladi
  const extra = splitExtra(r.assigneeExtra).map((u) => `@${escapeHtml(u)}`);
  return [main, ...extra].filter(Boolean).join(" ");
}

/** "a, b" → ["a", "b"] */
export function splitExtra(value?: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^@/, ""))
    .filter((s) => s.length > 0);
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

  const assigneeLabel =
    r.assigneeUsername && r.assigneeName && r.assigneeName !== r.assigneeUsername
      ? `${escapeHtml(r.assigneeName)} (@${escapeHtml(r.assigneeUsername)})`
      : r.assigneeUsername
        ? `@${escapeHtml(r.assigneeUsername)}`
        : escapeHtml(r.assigneeName ?? "");
  const extras = splitExtra(r.assigneeExtra).map((u) => `@${escapeHtml(u)}`);
  const allAssignees = [assigneeLabel, ...extras].filter(Boolean).join(", ");
  const assignee = allAssignees ? `🙋 Mas'ul: ${allAssignees}` : "";

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

/**
 * Guruhda turgan kartani bazadagi holatga qarab qayta chizadi.
 *
 * Karta media izohi (caption) bo'lishi ham mumkin — matn va media bitta xabarga
 * birlashtirilganda shunday bo'ladi. Telegram bunday xabarni editMessageText
 * bilan tahrirlamaydi, shuning uchun editMessageCaption ga tushamiz.
 */
export async function refreshCard(api: Api, requestId: number): Promise<void> {
  const r = await prisma.request.findUnique({ where: { id: requestId }, include: cardInclude });
  if (!r || !r.cardChatId || !r.cardMessageId) return;
  const text = await renderCardText(r);
  const markup = cardKeyboard(r);
  try {
    await api.editMessageText(r.cardChatId, r.cardMessageId, text, {
      parse_mode: "HTML",
      reply_markup: markup,
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    try {
      await api.editMessageCaption(r.cardChatId, r.cardMessageId, {
        caption: text,
        parse_mode: "HTML",
        reply_markup: markup,
      });
    } catch {
      console.error(`${ticketId(r.ticketNumber)} kartasi yangilanmadi:`, err);
    }
  }
}
