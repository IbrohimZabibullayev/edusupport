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
import { PrismaStorage } from "./storage";
import { BTN_NEW_REQUEST } from "./texts";
import { MyContext, SessionData } from "./types";

function createBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(config.botToken);

  bot.catch((err) => {
    console.error("Bot xatosi:", err.error);
  });

  // Guruhda ham ishlaydi — DEV_GROUP_ID ni topish uchun qulay
  bot.command("chatid", (ctx) => ctx.reply(`Chat ID: <code>${ctx.chat.id}</code>`, { parse_mode: "HTML" }));

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
    await ctx.reply("Bu guruh qaysi tizimning so'rovlarini qabul qiladi?", { reply_markup: kb });
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
    try {
      await ctx.editMessageText(
        `✅ Guruh saqlandi! "${label}" bo'yicha mijozlardan kelgan muammo va fikr-mulohazalar endi shu guruhga yuborib boriladi.`
      );
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
    await ctx.reply("✅ Guruh saqlandi! Endi mijozlarning takliflari shu guruhga yuborib boriladi.");
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
