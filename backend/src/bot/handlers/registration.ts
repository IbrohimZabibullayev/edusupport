import { Operator } from "@prisma/client";
import { prisma } from "../../db";
import { escapeHtml } from "../../util";
import { approvalKeyboard, contactKeyboard, mainMenu } from "../keyboards";
import { notifyAdmins } from "../services/notify";
import { MyContext } from "../types";

export async function getOperator(ctx: MyContext): Promise<Operator | null> {
  if (!ctx.from) return null;
  return prisma.operator.findUnique({ where: { telegramId: ctx.from.id.toString() } });
}

/** Tasdiqlangan operatorni qaytaradi, aks holda foydalanuvchiga tushuntirib null qaytaradi */
export async function requireApprovedOperator(ctx: MyContext): Promise<Operator | null> {
  const op = await getOperator(ctx);
  if (!op) {
    await ctx.reply("Avval ro'yxatdan o'ting: /start buyrug'ini yuboring.");
    return null;
  }
  switch (op.status) {
    case "APPROVED":
      return op;
    case "PENDING":
      await ctx.reply("⏳ So'rovingiz hali admin tomonidan tasdiqlanmagan. Iltimos, kuting.");
      return null;
    case "REJECTED":
      await ctx.reply("❌ So'rovingiz rad etilgan. Savollar bo'lsa admin bilan bog'laning.");
      return null;
    case "BLOCKED":
      await ctx.reply("🚫 Sizning akkauntingiz bloklangan.");
      return null;
  }
}

export async function handleStart(ctx: MyContext): Promise<void> {
  ctx.session.step = "idle";
  ctx.session.draft = undefined;
  ctx.session.adminLogin = undefined;

  const op = await getOperator(ctx);
  if (!op) {
    ctx.session.step = "reg_name";
    await ctx.reply(
      "👋 EduSupport botiga xush kelibsiz!\n\nRo'yxatdan o'tish uchun ism-familiyangizni yozing:"
    );
    return;
  }

  switch (op.status) {
    case "PENDING":
      await ctx.reply("⏳ So'rovingiz adminga yuborilgan. Tasdiqlanishini kuting.");
      break;
    case "REJECTED":
      await ctx.reply("❌ So'rovingiz rad etilgan. Savollar bo'lsa admin bilan bog'laning.");
      break;
    case "BLOCKED":
      await ctx.reply("🚫 Sizning akkauntingiz bloklangan.");
      break;
    case "APPROVED":
      await ctx.reply(
        [
          `Assalomu alaykum, ${escapeHtml(op.fullName)}!`,
          "",
          "📩 <b>Eng tez yo'l:</b> mijozning xabarini shu yerga forward qiling — bot turi va modulini so'rab, o'zi dasturchilar guruhiga jo'natadi.",
          "",
          "To'liq shakl kerak bo'lsa pastdagi tugmadan foydalaning.",
        ].join("\n"),
        { parse_mode: "HTML", reply_markup: mainMenu }
      );
      break;
  }
}

export async function handleRegName(ctx: MyContext, text: string): Promise<void> {
  if (text.length < 3) {
    await ctx.reply("Iltimos, to'liq ism-familiyangizni yozing (kamida 3 harf).");
    return;
  }
  ctx.session.regName = text;
  ctx.session.step = "reg_phone";
  await ctx.reply("📱 Endi telefon raqamingizni yuboring — quyidagi tugmani bosing:", {
    reply_markup: contactKeyboard,
  });
}

export async function handleContact(ctx: MyContext): Promise<void> {
  if (ctx.session.step !== "reg_phone" || !ctx.message?.contact || !ctx.from) return;

  const contact = ctx.message.contact;
  if (contact.user_id && contact.user_id !== ctx.from.id) {
    await ctx.reply("Iltimos, o'zingizning raqamingizni yuboring (tugma orqali).");
    return;
  }

  const fullName = ctx.session.regName ?? ctx.from.first_name;
  const operator = await prisma.operator.upsert({
    where: { telegramId: ctx.from.id.toString() },
    create: {
      telegramId: ctx.from.id.toString(),
      fullName,
      phone: contact.phone_number,
      username: ctx.from.username ?? null,
    },
    update: { fullName, phone: contact.phone_number, username: ctx.from.username ?? null },
  });

  ctx.session.step = "idle";
  ctx.session.regName = undefined;

  await ctx.reply("✅ So'rovingiz adminga yuborildi. Tasdiqlanishini kuting.", {
    reply_markup: { remove_keyboard: true },
  });

  const text = [
    "🆕 <b>Yangi operator so'rovi</b>",
    `👤 Ism: ${escapeHtml(operator.fullName)}`,
    `📱 Telefon: ${escapeHtml(operator.phone ?? "—")}`,
    `🔗 Username: ${operator.username ? "@" + escapeHtml(operator.username) : "—"}`,
  ].join("\n");
  await notifyAdmins(ctx.api, text, approvalKeyboard(operator.id));
}

export async function handleApproveCallback(ctx: MyContext, operatorId: number, approve: boolean): Promise<void> {
  const caller = await getOperator(ctx);
  if (!caller?.isAdmin) {
    await ctx.answerCallbackQuery({ text: "Bu amal faqat adminlar uchun", show_alert: true });
    return;
  }

  const op = await prisma.operator.findUnique({ where: { id: operatorId } });
  if (!op) {
    await ctx.answerCallbackQuery({ text: "Operator topilmadi", show_alert: true });
    return;
  }
  if (op.status !== "PENDING") {
    await ctx.answerCallbackQuery({ text: "Bu so'rov allaqachon ko'rib chiqilgan", show_alert: true });
    return;
  }

  await prisma.operator.update({
    where: { id: operatorId },
    data: { status: approve ? "APPROVED" : "REJECTED" },
  });

  const original = ctx.callbackQuery?.message?.text ?? "Operator so'rovi";
  const verdict = approve ? "✅ Tasdiqlandi" : "❌ Rad etildi";
  try {
    await ctx.editMessageText(`${escapeHtml(original)}\n\n<b>${verdict}</b>`, { parse_mode: "HTML" });
  } catch {
    // xabar allaqachon o'zgartirilgan bo'lishi mumkin
  }
  await ctx.answerCallbackQuery({ text: verdict });

  try {
    if (approve) {
      await ctx.api.sendMessage(
        op.telegramId,
        "🎉 Tabriklaymiz! Admin sizni tasdiqladi. Endi so'rov kiritishingiz mumkin.",
        { reply_markup: mainMenu }
      );
    } else {
      await ctx.api.sendMessage(op.telegramId, "❌ Afsuski, so'rovingiz rad etildi.");
    }
  } catch (err) {
    console.error("Operatorga xabar yuborilmadi:", err);
  }
}
