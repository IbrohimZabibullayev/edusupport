import cron from "node-cron";
import { Bot } from "grammy";
import { notifyAdmins } from "../bot/services/notify";
import { buildWeeklyReport } from "../bot/services/report";
import { MyContext } from "../bot/types";

/** Har dushanba 09:00 (Asia/Tashkent) — hamma adminlarga haftalik hisobot */
export function startWeeklyReportJob(bot: Bot<MyContext>): void {
  cron.schedule(
    "0 9 * * 1",
    async () => {
      try {
        const report = await buildWeeklyReport();
        const sent = await notifyAdmins(bot.api, report);
        console.log(`Haftalik hisobot ${sent} ta adminga yuborildi`);
      } catch (err) {
        console.error("Haftalik hisobot yuborilmadi:", err);
      }
    },
    { timezone: "Asia/Tashkent" }
  );
}
