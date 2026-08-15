import { config } from "./config";
import { aiLabel } from "./ai/client";
import { createServer } from "./api/server";
import { bot } from "./bot/bot";
import { startDeadlineReminderJob } from "./jobs/deadlineReminder";
import { startTaskReminderJob } from "./jobs/taskReminder";
import { startWeeklyReportJob } from "./jobs/weeklyReport";
import {
  backfillSchoolKeys,
  ensureDefaultGuessKeywords,
  ensureDefaultModules,
  ensureDefaultPriorities,
  ensureDefaultRequestTypes,
  ensureDefaultSystems,
  ensureDefaultTopicKeywords,
} from "./seed";

async function main(): Promise<void> {
  await ensureDefaultModules();
  await ensureDefaultSystems();
  await ensureDefaultRequestTypes();
  await ensureDefaultTopicKeywords();
  await ensureDefaultPriorities();
  await ensureDefaultGuessKeywords();
  await backfillSchoolKeys();

  const app = createServer();
  app.listen(config.port, () => {
    console.log(`✅ API ishga tushdi: http://localhost:${config.port}`);
  });

  startWeeklyReportJob(bot);
  startDeadlineReminderJob(bot);
  startTaskReminderJob(bot);

  bot
    .start({
      onStart: (info) => {
        console.log(`✅ Bot @${info.username} polling rejimida ishga tushdi`);
        // Qaysi AI ishlayotgani ko'rinib tursin — kalit almashtirilganda
        // logdan darrov tasdiqlash mumkin
        console.log(`🤖 Assistent: ${aiLabel()}`);
      },
    })
    .catch((err) => {
      console.error("Bot ishga tushmadi:", err);
      process.exit(1);
    });

  const shutdown = () => {
    console.log("To'xtatilmoqda...");
    bot.stop().finally(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Ishga tushirishda xatolik:", err);
  process.exit(1);
});
