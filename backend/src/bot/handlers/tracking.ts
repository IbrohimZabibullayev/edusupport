import { InlineKeyboard } from "grammy";
import { prisma } from "../../db";
import { escapeHtml, formatSpan, formatTashkentDate, tashkentDayEnd, ticketId } from "../../util";
import { cardKeyboard, mentionAssignee, refreshCard } from "../services/card";
import { MyContext } from "../types";

/** Tugmani bosgan odamning ko'rinadigan ismi */
function pressedBy(ctx: MyContext): { tgId: string; name: string; username: string | null } {
  const u = ctx.from;
  return {
    tgId: String(u?.id ?? ""),
    name: [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "—",
    username: u?.username ?? null,
  };
}

async function load(ctx: MyContext, id: number) {
  const r = await prisma.request.findUnique({ where: { id } });
  if (!r) await ctx.answerCallbackQuery({ text: "So'rov topilmadi", show_alert: true });
  return r;
}

/** Guruhdagi kartaga reply qilib qisqa xabar qoldiradi (topik o'zi to'g'ri tanlanadi) */
async function noteOnCard(ctx: MyContext, r: { cardChatId: string | null; cardMessageId: number | null }, text: string) {
  if (!r.cardChatId || !r.cardMessageId) return;
  try {
    await ctx.api.sendMessage(r.cardChatId, text, {
      parse_mode: "HTML",
      reply_parameters: { message_id: r.cardMessageId, allow_sending_without_reply: true },
    });
  } catch (err) {
    console.error("Karta ostiga izoh qo'shilmadi:", err);
  }
}

export async function handleDone(ctx: MyContext, id: number): Promise<void> {
  const r = await load(ctx, id);
  if (!r) return;
  if (r.done) {
    await ctx.answerCallbackQuery({ text: "Bu so'rov allaqachon bajarilgan", show_alert: true });
    return;
  }
  const by = pressedBy(ctx);
  await prisma.request.update({
    where: { id },
    data: { done: true, doneAt: new Date(), doneByTgId: by.tgId, doneByName: by.name },
  });
  await ctx.answerCallbackQuery({ text: `${ticketId(r.ticketNumber)} bajarildi` });
  await refreshCard(ctx.api, id);
  await notifyOperatorDone(ctx, id);
}

/** So'rovni yuborgan operatorga shaxsiy xabar — u botni ishga tushirgan, ya'ni DM ochiq */
async function notifyOperatorDone(ctx: MyContext, id: number): Promise<void> {
  const r = await prisma.request.findUnique({ where: { id }, include: { operator: true, module: true } });
  if (!r) return;
  const text = [
    `✅ <b>Sizning so'rovingiz bajarildi</b>`,
    "",
    `Ticket: <code>${ticketId(r.ticketNumber)}</code>`,
    `Modul: ${escapeHtml(r.module.emoji ? `${r.module.emoji} ${r.module.name}` : r.module.name)}`,
    `Kim bajardi: ${escapeHtml(r.doneByName ?? "—")}`,
    `Ketgan vaqt: ${formatSpan(r.createdAt, r.doneAt ?? new Date())}`,
    "",
    `<blockquote>${escapeHtml(r.description.slice(0, 300))}</blockquote>`,
  ].join("\n");
  try {
    await ctx.api.sendMessage(r.operator.telegramId, text, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("🔄 Hali muammo bor", `rq:reopen:${id}`),
    });
  } catch (err) {
    console.error(`Operatorga (${r.operator.telegramId}) bajarildi xabari yetmadi:`, err);
  }
}

export async function handleReopen(ctx: MyContext, id: number): Promise<void> {
  const r = await load(ctx, id);
  if (!r) return;
  if (!r.done) {
    await ctx.answerCallbackQuery({ text: "Bu so'rov ochiq turibdi", show_alert: true });
    return;
  }
  const by = pressedBy(ctx);
  await prisma.request.update({
    where: { id },
    data: { done: false, doneAt: null, doneByTgId: null, doneByName: null, remindedAt: null },
  });
  await ctx.answerCallbackQuery({ text: `${ticketId(r.ticketNumber)} qayta ochildi` });
  await refreshCard(ctx.api, id);

  // Guruh ko'rib qolishi uchun karta ostiga izoh
  const who = escapeHtml(by.name);
  await noteOnCard(ctx, r, `🔄 <b>${ticketId(r.ticketNumber)} qayta ochildi</b> — ${who}${mentionAssignee(r) ? ` · ${mentionAssignee(r)}` : ""}`);

  // Operator o'z chatidan bosgan bo'lsa, o'sha xabarni ham yangilaymiz
  if (ctx.chat?.type === "private") {
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {
      // muhim emas
    }
  }
}

export async function handleClaim(ctx: MyContext, id: number): Promise<void> {
  const r = await load(ctx, id);
  if (!r) return;
  const by = pressedBy(ctx);
  await prisma.request.update({
    where: { id },
    data: { assigneeTgId: by.tgId, assigneeName: by.name, assigneeUsername: by.username },
  });
  await ctx.answerCallbackQuery({ text: "Siz mas'ul bo'ldingiz" });
  await refreshCard(ctx.api, id);
}

/**
 * Telegram Bot API guruhning oddiy a'zolarini ro'yxatlab bermaydi, shuning uchun
 * ro'yxat tuzmaymiz: tugmani bosgan odamdan mas'ulni o'zi tag qilishini so'raymiz.
 * Javob shu xabarga reply bo'lib keladi va undagi mention o'qiladi.
 */
const ASSIGN_PROMPT_MARK = "kimga berasiz";

export async function handleAssignAsk(ctx: MyContext, id: number): Promise<void> {
  const r = await load(ctx, id);
  if (!r) return;
  const by = pressedBy(ctx);
  await ctx.answerCallbackQuery();

  const who = by.username
    ? `@${escapeHtml(by.username)}`
    : `<a href="tg://user?id=${by.tgId}">${escapeHtml(by.name)}</a>`;
  await noteOnCard(
    ctx,
    r,
    [
      `👤 <b>${ticketId(r.ticketNumber)}</b> — ${who}, ${ASSIGN_PROMPT_MARK}?`,
      "",
      "<i>Shu xabarga reply qilib mas'ul xodimni tag qiling (masalan @username).</i>",
    ].join("\n")
  );
}

/** Reply xabaridagi birinchi mention — @username yoki usernamesiz odam */
function readMention(msg: {
  text?: string;
  entities?: { type: string; offset: number; length: number; user?: { id: number; first_name: string; last_name?: string; username?: string } }[];
}): { tgId: string | null; name: string; username: string | null } | null {
  const text = msg.text ?? "";
  for (const e of msg.entities ?? []) {
    if (e.type === "text_mention" && e.user) {
      return {
        tgId: String(e.user.id),
        name: [e.user.first_name, e.user.last_name].filter(Boolean).join(" "),
        username: e.user.username ?? null,
      };
    }
    if (e.type === "mention") {
      const handle = text.slice(e.offset + 1, e.offset + e.length);
      // @username orqali tag qilinganda Telegram ID bermaydi — username yetarli
      return { tgId: null, name: handle, username: handle };
    }
  }
  return null;
}

/**
 * Guruhda botning "kimga berasiz?" xabariga reply kelganda ishlaydi.
 * So'rov ticket raqamidan topiladi — qo'shimcha ustun kerak emas.
 */
export async function handleAssignReply(ctx: MyContext): Promise<boolean> {
  const msg = ctx.message;
  const replied = msg?.reply_to_message;
  if (!msg || !replied) return false;

  const src = ("text" in replied && replied.text) || "";
  if (!src.includes(ASSIGN_PROMPT_MARK)) return false;
  const ticket = src.match(/ES-?(\d+)/i);
  if (!ticket) return false;

  const r = await prisma.request.findUnique({ where: { ticketNumber: Number(ticket[1]) } });
  if (!r) return false;

  const picked = readMention(msg);
  if (!picked) {
    await ctx.reply("Mas'ulni tag qiling — masalan @username.", {
      reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
    });
    return true;
  }

  await prisma.request.update({
    where: { id: r.id },
    data: { assigneeTgId: picked.tgId, assigneeName: picked.name, assigneeUsername: picked.username },
  });
  await refreshCard(ctx.api, r.id);

  const updated = await prisma.request.findUnique({ where: { id: r.id } });
  if (updated) {
    await noteOnCard(
      ctx,
      updated,
      `🙋 ${mentionAssignee(updated)} — <code>${ticketId(r.ticketNumber)}</code> sizga biriktirildi.`
    );
  }
  return true;
}

const DUE_CHOICES: { label: string; days: number }[] = [
  { label: "Bugun", days: 0 },
  { label: "Ertaga", days: 1 },
  { label: "3 kun", days: 3 },
  { label: "1 hafta", days: 7 },
];

export async function handleDueMenu(ctx: MyContext, id: number): Promise<void> {
  const r = await load(ctx, id);
  if (!r) return;
  const kb = new InlineKeyboard();
  for (const c of DUE_CHOICES) kb.text(c.label, `rq:dueset:${id}:${c.days}`);
  kb.row();
  if (r.deadline) kb.text("❌ Muddatni olib tashlash", `rq:dueset:${id}:-1`).row();
  kb.text("⬅️ Orqaga", `rq:back:${id}`);
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({ reply_markup: kb });
}

export async function handleDueSet(ctx: MyContext, id: number, days: number): Promise<void> {
  const r = await load(ctx, id);
  if (!r) return;
  const deadline = days < 0 ? null : tashkentDayEnd(new Date(), days);
  await prisma.request.update({ where: { id }, data: { deadline, remindedAt: null } });
  await ctx.answerCallbackQuery({
    text: deadline ? `Muddat: ${formatTashkentDate(deadline)}` : "Muddat olib tashlandi",
  });
  await refreshCard(ctx.api, id);
}

/** Ichki menyudan kartaning asosiy tugmalariga qaytish */
export async function handleCardBack(ctx: MyContext, id: number): Promise<void> {
  const r = await load(ctx, id);
  if (!r) return;
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({ reply_markup: cardKeyboard(r) });
}
