import { Bot, InlineKeyboard, session } from "grammy";
import { config } from "../config";
import { prisma } from "../db";
import { SETTING_BACKLOG_CHAT, SETTING_DEV_GROUP, setSetting } from "../settings";
import { cmdAdmin, cmdReport, handleAdminLogin, handleAdminPassword } from "./handlers/admin";
import {
  getOperator,
  handleApproveCallback,
  handleContact,
  handleRegName,
  handleStart,
} from "./handlers/registration";
import {
  handleDescMedia,
  handleDescStep,
  handleModuleStep,
  handleSchoolStep,
  handleSystemStep,
  handleTypeStep,
  startWizard,
} from "./handlers/request";
import { getActiveRequestTypes, requestTypeLabel } from "./services/requestTypes";
import { learnTopic } from "./services/topics";
import { PrismaStorage } from "./storage";
import { BTN_NEW_REQUEST } from "./texts";
import { MyContext, SessionData } from "./types";

/** Forum guruhda xabar qaysi bo'limda (topic) yozilgan bo'lsa, o'sha bo'lim raqami */
function threadOf(msg?: { is_topic_message?: boolean; message_thread_id?: number }): number | undefined {
  return msg?.is_topic_message ? msg.message_thread_id : undefined;
}

function createBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(config.botToken);

  bot.catch((err) => {
    console.error("Bot xatosi:", err.error);
  });

  // Bo'limlarni avtomatik o'rganish: guruhdagi xabarlar bo'lim nomini olib keladi —
  // "Bugs" → BUG, "Savollar" → ISSUE, "Features/Taklif" → SUGGESTION kabi biriktiriladi.
  // Buning uchun bot guruh xabarlarini ko'ra olishi kerak (guruhda admin bo'lsin yoki privacy o'chiq).
  bot.use(async (ctx, next) => {
    const msg = ctx.message;
    if (msg && ctx.chat && ctx.chat.type !== "private") {
      const chatId = String(ctx.chat.id);
      try {
        if (msg.forum_topic_created) {
          await learnTopic(chatId, msg.message_thread_id ?? msg.message_id, msg.forum_topic_created.name);
        } else if (msg.forum_topic_edited?.name && msg.message_thread_id) {
          await learnTopic(chatId, msg.message_thread_id, msg.forum_topic_edited.name);
        } else if (msg.is_topic_message && msg.message_thread_id && msg.reply_to_message?.forum_topic_created) {
          await learnTopic(chatId, msg.message_thread_id, msg.reply_to_message.forum_topic_created.name);
        }
      } catch (err) {
        console.error("Bo'lim avto-o'rganilmadi:", err);
      }
    }
    await next();
  });

  // Guruhda ham ishlaydi — DEV_GROUP_ID ni topish uchun qulay
  bot.command("chatid", (ctx) => {
    const threadId = threadOf(ctx.message);
    const lines = [`Chat ID: <code>${ctx.chat.id}</code>`];
    if (threadId) lines.push(`Bo'lim (topic) ID: <code>${threadId}</code>`);
    return ctx.reply(lines.join("\n"), { parse_mode: "HTML", message_thread_id: threadId });
  });

  // Guruhni bazaga saqlash — .env yoki kodni o'zgartirish shart emas
  const requireAdmin = async (telegramId: number) => {
    const op = await prisma.operator.findUnique({ where: { telegramId: telegramId.toString() } });
    return op?.isAdmin ? op : null;
  };

  // /setgroup — guruh qaysi tizimga tegishliligini tanlash uchun tugmalar chiqaradi
  bot.command("setgroup", async (ctx) => {
    if (!ctx.from) return;
    if (!(await requireAdmin(ctx.from.id))) {
      await ctx.reply("Bu buyruq faqat adminlar uchun.");
      return;
    }
    if (ctx.chat.type === "private") {
      await ctx.reply("Bu buyruqni kerakli guruhning ichida yozing.");
      return;
    }
    const systems = await prisma.system.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    const kb = new InlineKeyboard();
    for (const s of systems) kb.text(s.name, `bindgroup:${s.id}`).row();
    kb.text("📥 Umumiy (hamma tizim uchun)", "bindgroup:global");
    await ctx.reply("Bu guruh qaysi tizimning so'rovlarini qabul qiladi?", {
      reply_markup: kb,
      message_thread_id: threadOf(ctx.message),
    });
  });

  bot.callbackQuery(/^bindgroup:(\d+|global)$/, async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    if (!(await requireAdmin(ctx.from.id))) {
      await ctx.answerCallbackQuery({ text: "Faqat adminlar uchun", show_alert: true });
      return;
    }
    const target = ctx.match[1];
    const chatId = String(ctx.chat.id);
    let label: string;
    if (target === "global") {
      await setSetting(SETTING_DEV_GROUP, chatId);
      label = "Umumiy (hamma tizim)";
    } else {
      const system = await prisma.system
        .update({ where: { id: Number(target) }, data: { groupChatId: chatId } })
        .catch(() => null);
      if (!system) {
        await ctx.answerCallbackQuery({ text: "Tizim topilmadi", show_alert: true });
        return;
      }
      label = system.name;
    }
    await ctx.answerCallbackQuery();
    const topicHint = ctx.chat.is_forum
      ? `\n\nGuruhda bo'limlar (topics) bor — so'rov turlarini bo'limlarga ajratish uchun har bir bo'lim ichida /settopic yozing.`
      : "";
    try {
      await ctx.editMessageText(
        `✅ Guruh saqlandi! "${label}" bo'yicha mijozlardan kelgan muammo va fikr-mulohazalar endi shu guruhga yuborib boriladi.${topicHint}`
      );
    } catch {
      // xabar allaqachon o'zgartirilgan bo'lishi mumkin
    }
  });

  // /settopic — guruh bo'limi (topic) ichida yoziladi: shu bo'limga qaysi so'rov turlari tushishini belgilaydi
  bot.command("settopic", async (ctx) => {
    if (!ctx.from) return;
    if (!(await requireAdmin(ctx.from.id))) {
      await ctx.reply("Bu buyruq faqat adminlar uchun.");
      return;
    }
    if (ctx.chat.type === "private") {
      await ctx.reply("Bu buyruqni guruhdagi kerakli bo'lim (topic) ichida yozing.");
      return;
    }
    const threadId = threadOf(ctx.message);
    if (!ctx.chat.is_forum) {
      await ctx.reply("Bu guruhda bo'limlar (topics) yoqilmagan — so'rovlar guruhning o'ziga tushaveradi.");
      return;
    }
    const types = await getActiveRequestTypes();
    const kb = new InlineKeyboard();
    for (const t of types) kb.text(requestTypeLabel(t), `bindtopic:${t.key}`).row();
    await ctx.reply(
      threadId
        ? "Shu bo'limga qaysi turdagi so'rovlar tushsin?"
        : "Bu General (asosiy) bo'lim. Qaysi turni tanlasangiz, o'sha tur uchun bo'lim biriktirmasi o'chiriladi va so'rovlar shu yerga tushadi:",
      { reply_markup: kb, message_thread_id: threadId }
    );
  });

  bot.callbackQuery(/^bindtopic:(.+)$/, async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    if (!(await requireAdmin(ctx.from.id))) {
      await ctx.answerCallbackQuery({ text: "Faqat adminlar uchun", show_alert: true });
      return;
    }
    const type = ctx.match[1];
    const typeRow = await prisma.requestType.findUnique({ where: { key: type } });
    if (!typeRow) {
      await ctx.answerCallbackQuery({ text: "Tur topilmadi", show_alert: true });
      return;
    }
    const label = requestTypeLabel(typeRow);
    const chatId = String(ctx.chat.id);
    const msg = ctx.callbackQuery.message;
    const threadId = msg && "is_topic_message" in msg ? threadOf(msg) : undefined;

    let note: string;
    if (threadId !== undefined) {
      await prisma.groupTopic.upsert({
        where: { chatId_type: { chatId, type } },
        create: { chatId, type, threadId, auto: false },
        update: { threadId, auto: false },
      });
      note = `✅ "${label}" so'rovlari endi shu guruhning shu bo'limiga tushadi.`;
    } else {
      await prisma.groupTopic.deleteMany({ where: { chatId, type } });
      note = `✅ "${label}" so'rovlari endi General (asosiy) bo'limga tushadi.`;
    }
    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageText(note);
    } catch {
      // xabar allaqachon o'zgartirilgan bo'lishi mumkin
    }
  });

  // /setbacklog — takliflar uchun umumiy chat
  bot.command("setbacklog", async (ctx) => {
    if (!ctx.from) return;
    if (!(await requireAdmin(ctx.from.id))) {
      await ctx.reply("Bu buyruq faqat adminlar uchun.");
      return;
    }
    if (ctx.chat.type === "private") {
      await ctx.reply("Bu buyruqni kerakli guruhning ichida yozing.");
      return;
    }
    await setSetting(SETTING_BACKLOG_CHAT, String(ctx.chat.id));
    await ctx.reply("✅ Guruh saqlandi! Endi mijozlarning takliflari shu guruhga yuborib boriladi.", {
      message_thread_id: threadOf(ctx.message),
    });
  });

  // Qolgan hamma narsa faqat shaxsiy chatda
  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== "private") return;
    await next();
  });

  bot.use(
    session({
      initial: (): SessionData => ({ step: "idle" }),
      storage: new PrismaStorage<SessionData>(),
    })
  );

  // Buyruqlar
  bot.command("start", handleStart);
  bot.command("new", startWizard);
  bot.command("admin", cmdAdmin);
  bot.command("report", cmdReport);

  // Callback tugmalar (operator tasdiqlash — adminlar uchun)
  bot.callbackQuery(/^op_(approve|reject):(\d+)$/, (ctx) =>
    handleApproveCallback(ctx, Number(ctx.match[2]), ctx.match[1] === "approve")
  );
  // Eski xabarlardagi boshqa inline tugmalar
  bot.on("callback_query:data", (ctx) => ctx.answerCallbackQuery({ text: "Bu tugma eskirgan" }));

  // Kontakt (registratsiya)
  bot.on("message:contact", handleContact);

  // Media xabarlar — izoh bosqichida biriktirma sifatida yig'iladi
  bot.on(
    [
      "message:photo",
      "message:video",
      "message:voice",
      "message:audio",
      "message:document",
      "message:video_note",
      "message:animation",
    ],
    handleDescMedia
  );

  // Matnli xabarlar — joriy bosqichga qarab
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    switch (ctx.session.step) {
      case "reg_name":
        return handleRegName(ctx, text);
      case "reg_phone":
        return void (await ctx.reply("📱 Iltimos, tugma orqali telefon raqamingizni yuboring."));
      case "admin_login":
        return handleAdminLogin(ctx, text);
      case "admin_pass":
        return handleAdminPassword(ctx, text);
      case "req_system":
        return handleSystemStep(ctx, text);
      case "req_type":
        return handleTypeStep(ctx, text);
      case "req_module":
        return handleModuleStep(ctx, text);
      case "req_school":
        return handleSchoolStep(ctx, text);
      case "req_desc":
        return handleDescStep(ctx, text);
      default: {
        if (text === BTN_NEW_REQUEST) return startWizard(ctx);
        const op = await getOperator(ctx);
        if (!op) {
          await ctx.reply("Ro'yxatdan o'tish uchun /start buyrug'ini yuboring.");
        } else if (op.status === "APPROVED") {
          await ctx.reply(`So'rov kiritish uchun "${BTN_NEW_REQUEST}" tugmasini bosing yoki /new yozing.`);
        } else if (op.status === "PENDING") {
          await ctx.reply("⏳ So'rovingiz hali tasdiqlanmagan. Iltimos, kuting.");
        } else {
          await ctx.reply("Sizda botdan foydalanish huquqi yo'q.");
        }
      }
    }
  });

  return bot;
}

export const bot = createBot();
