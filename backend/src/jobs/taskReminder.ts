import cron from "node-cron";
import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "../db";
import { MyContext } from "../bot/types";
import { escapeHtml, formatTashkentTime } from "../util";

/** Belgilangan vaqtdan shuncha oldin eslatiladi */
const LEAD_MS = 5 * 60_000;
/** Bundan ham eskirib ketgan taskka eslatma yuborilmaydi (bot to'xtab qolgan bo'lsa) */
const STALE_MS = 30 * 60_000;

/**
 * Vaqti yaqinlashgan tasklar bo'yicha operatorga shaxsiy eslatma yuboradi.
 * Har taskka bir marta — remindedAt qo'yiladi.
 */
export async function sendTaskReminders(bot: Bot<MyContext>): Promise<number> {
  const now = new Date();
  const due = await prisma.operatorTask.findMany({
    where: {
      done: false,
      remindedAt: null,
      dueAt: { lte: new Date(now.getTime() + LEAD_MS), gte: new Date(now.getTime() - STALE_MS) },
    },
    include: { operator: true },
    orderBy: { dueAt: "asc" },
  });

  let sent = 0;
  for (const t of due) {
    const minutesLeft = Math.max(0, Math.round((t.dueAt.getTime() - now.getTime()) / 60_000));
    const text = [
      minutesLeft > 0 ? `⏰ <b>${minutesLeft} daqiqadan keyin</b>` : "⏰ <b>Hozir</b>",
      "",
      `📝 ${escapeHtml(t.title)}`,
      ...(t.withWhom ? [`👥 ${escapeHtml(t.withWhom)}`] : []),
      `🕒 ${formatTashkentTime(t.dueAt)}`,
    ].join("\n");

    try {
      await bot.api.sendMessage(t.operator.telegramId, text, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("✅ Bajarildi", `tsk:done:${t.id}`)
          .text("⏰ +30 daqiqa", `tsk:snooze:${t.id}:30`),
      });
      await prisma.operatorTask.update({ where: { id: t.id }, data: { remindedAt: now } });
      sent++;
    } catch (err) {
      // Operator botni bloklagan bo'lishi mumkin — qayta urinmaslik uchun belgilab qo'yamiz
      console.error(`Task ${t.id} eslatmasi yuborilmadi:`, err);
      await prisma.operatorTask.update({ where: { id: t.id }, data: { remindedAt: now } });
    }
  }
  return sent;
}

/** Har daqiqada tekshiriladi — eslatma 5 daqiqalik aniqlikda kelishi uchun */
export function startTaskReminderJob(bot: Bot<MyContext>): void {
  cron.schedule("* * * * *", async () => {
    try {
      await sendTaskReminders(bot);
    } catch (err) {
      console.error("Task eslatmalari yuborilmadi:", err);
    }
  });
}
