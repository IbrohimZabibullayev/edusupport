import cron from "node-cron";
import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "../db";
import { mentionAssignee } from "../bot/services/card";
import { MyContext } from "../bot/types";
import { formatSpan, formatTashkentDate, tashkentDayEnd, tashkentDayStart, ticketId } from "../util";

/**
 * Muddati kelgan yoki o'tib ketgan, hali bajarilmagan so'rovlar bo'yicha
 * guruhdagi kartaga reply qilib mas'ulni tag qiladi. Kuniga bir marta.
 */
export async function sendDeadlineReminders(bot: Bot<MyContext>): Promise<number> {
  const now = new Date();
  const todayStart = tashkentDayStart(now);
  const todayEnd = tashkentDayEnd(now);

  const due = await prisma.request.findMany({
    where: {
      done: false,
      deadline: { not: null, lte: todayEnd },
      OR: [{ remindedAt: null }, { remindedAt: { lt: todayStart } }],
      cardChatId: { not: null },
    },
    orderBy: { deadline: "asc" },
  });

  let sent = 0;
  for (const r of due) {
    const overdue = r.deadline! < todayStart;
    const head = overdue
      ? `🔴 <b>${ticketId(r.ticketNumber)}</b> — muddat ${formatSpan(r.deadline!, now)} kechikdi`
      : `⏰ <b>${ticketId(r.ticketNumber)}</b> — muddat bugun tugaydi (${formatTashkentDate(r.deadline!)})`;
    const who = mentionAssignee(r);
    const text = [head, who ? `${who} — bu taskda o'zgarish bormi?` : "Mas'ul tayinlanmagan."].join("\n");

    try {
      await bot.api.sendMessage(r.cardChatId!, text, {
        parse_mode: "HTML",
        reply_parameters: { message_id: r.cardMessageId ?? 0, allow_sending_without_reply: true },
        reply_markup: new InlineKeyboard()
          .text("✅ Bajarildi", `rq:done:${r.id}`)
          .text("⏰ +1 kun", `rq:dueset:${r.id}:1`),
      });
      await prisma.request.update({ where: { id: r.id }, data: { remindedAt: now } });
      sent++;
    } catch (err) {
      console.error(`${ticketId(r.ticketNumber)} bo'yicha eslatma yuborilmadi:`, err);
    }
  }
  return sent;
}

/** Har kuni 09:00 (Asia/Tashkent) */
export function startDeadlineReminderJob(bot: Bot<MyContext>): void {
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        const sent = await sendDeadlineReminders(bot);
        if (sent > 0) console.log(`Muddat eslatmasi: ${sent} ta so'rov bo'yicha yuborildi`);
      } catch (err) {
        console.error("Muddat eslatmalari yuborilmadi:", err);
      }
    },
    { timezone: "Asia/Tashkent" }
  );
}
