import { config } from "../../config";
import { prisma } from "../../db";
import { safeEquals } from "../../util";
import { menu } from "../keyboards";
import { buildOnDemandReport } from "../services/report";
import { MyContext } from "../types";
import { getOperator } from "./registration";

export async function cmdAdmin(ctx: MyContext): Promise<void> {
  ctx.session.step = "admin_login";
  ctx.session.adminLogin = undefined;
  await ctx.reply("🔐 Admin login'ini kiriting:");
}

export async function handleAdminLogin(ctx: MyContext, text: string): Promise<void> {
  ctx.session.adminLogin = text;
  ctx.session.step = "admin_pass";
  await ctx.reply("🔑 Endi parolni kiriting (xabar darhol o'chiriladi):");
}

export async function handleAdminPassword(ctx: MyContext, password: string): Promise<void> {
  // Parol yozilgan xabarni darhol o'chiramiz
  try {
    await ctx.deleteMessage();
  } catch (err) {
    console.error("Parol xabarini o'chirib bo'lmadi:", err);
  }

  const login = ctx.session.adminLogin ?? "";
  ctx.session.adminLogin = undefined;
  ctx.session.step = "idle";

  if (!safeEquals(login, config.adminLogin) || !safeEquals(password, config.adminPassword)) {
    await ctx.reply("❌ Login yoki parol noto'g'ri.");
    return;
  }

  if (!ctx.from) return;
  const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ");
  await prisma.operator.upsert({
    where: { telegramId: ctx.from.id.toString() },
    create: {
      telegramId: ctx.from.id.toString(),
      fullName: fullName || "Admin",
      username: ctx.from.username ?? null,
      status: "APPROVED",
      isAdmin: true,
    },
    update: { status: "APPROVED", isAdmin: true },
  });

  await ctx.reply(
    [
      "✅ Siz admin sifatida tasdiqlandingiz!",
      "",
      "Endi siz:",
      "• operator so'rovlarini tasdiqlaysiz,",
      "• yangi maktab bildirishnomalarini olasiz,",
      "• /report bilan istalgan payt hisobot olasiz,",
      "• har dushanba 09:00 da avtomatik haftalik hisobot olasiz.",
    ].join("\n"),
    { reply_markup: menu() }
  );
}

export async function cmdReport(ctx: MyContext): Promise<void> {
  const op = await getOperator(ctx);
  if (!op?.isAdmin) {
    await ctx.reply("Bu buyruq faqat adminlar uchun.");
    return;
  }
  const report = await buildOnDemandReport();
  await ctx.reply(report, { parse_mode: "HTML" });
}
