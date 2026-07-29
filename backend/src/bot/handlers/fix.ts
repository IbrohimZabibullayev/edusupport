import { InlineKeyboard } from "grammy";
import { prisma } from "../../db";
import { escapeHtml, ticketId } from "../../util";
import { refreshCard } from "../services/card";
import { correctClientMemory } from "../services/clients";
import { getActiveModules, moduleLabel } from "../services/modules";
import { notifyAdmins } from "../services/notify";
import { getActiveRequestTypes, requestTypeLabel, requestTypeLabelByKey } from "../services/requestTypes";
import { createSchool, matchSchool } from "../services/schools";
import { MyContext } from "../types";
import { requireApprovedOperator } from "./registration";

/**
 * Avtomatik yuborilgan so'rovni operator keyin tuzatishi uchun.
 * Har o'zgarishdan keyin guruhdagi karta ham qayta chiziladi.
 */

async function load(ctx: MyContext, id: number) {
  const r = await prisma.request.findUnique({
    where: { id },
    include: { module: true, school: true, system: true },
  });
  if (!r) await ctx.answerCallbackQuery({ text: "So'rov topilmadi", show_alert: true });
  return r;
}

/** Operatorning shaxsiy chatidagi tasdiq xabarini yangilaydi */
async function renderSummary(ctx: MyContext, id: number): Promise<void> {
  const r = await prisma.request.findUnique({
    where: { id },
    include: { module: true, school: true, system: true, attachments: true },
  });
  if (!r) return;
  const lines = [
    `✅ <b>${ticketId(r.ticketNumber)}</b> guruhga yuborildi`,
    "",
    `${escapeHtml(await requestTypeLabelByKey(r.type))} · ${escapeHtml(moduleLabel(r.module))}`,
    `🏫 ${escapeHtml(r.school.name)}`,
    ...(r.system ? [`🖥 ${escapeHtml(r.system.name)}`] : []),
    ...(r.attachments.length > 0 ? [`📎 ${r.attachments.length} ta fayl`] : []),
  ].join("\n");
  await ctx
    .editMessageText(lines, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("✏️ Tuzatish", `fx:menu:${id}`),
    })
    .catch(() => undefined);
}

export async function handleFixMenu(ctx: MyContext, id: number): Promise<void> {
  const r = await load(ctx, id);
  if (!r) return;
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard()
      .text("So'rov turi", `fx:type:${id}`)
      .text("Modul", `fx:mod:${id}`)
      .row()
      .text("Maktab", `fx:sch:${id}`)
      .row()
      .text("⬅️ Yopish", `fx:close:${id}`),
  });
}

export async function handleFixClose(ctx: MyContext, id: number): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({
    reply_markup: new InlineKeyboard().text("✏️ Tuzatish", `fx:menu:${id}`),
  });
}

export async function handleFixTypeMenu(ctx: MyContext, id: number): Promise<void> {
  if (!(await load(ctx, id))) return;
  const kb = new InlineKeyboard();
  for (const t of await getActiveRequestTypes()) kb.text(requestTypeLabel(t), `fx:typeset:${id}:${t.key}`).row();
  kb.text("⬅️ Orqaga", `fx:menu:${id}`);
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({ reply_markup: kb });
}

export async function handleFixTypeSet(ctx: MyContext, id: number, key: string): Promise<void> {
  if (!(await load(ctx, id))) return;
  await prisma.request.update({ where: { id }, data: { type: key } });
  await ctx.answerCallbackQuery({ text: "So'rov turi o'zgartirildi" });
  await afterFix(ctx, id);
}

export async function handleFixModuleMenu(ctx: MyContext, id: number): Promise<void> {
  if (!(await load(ctx, id))) return;
  const modules = await getActiveModules();
  const kb = new InlineKeyboard();
  for (let i = 0; i < modules.length; i += 2) {
    kb.text(moduleLabel(modules[i]), `fx:modset:${id}:${modules[i].id}`);
    if (modules[i + 1]) kb.text(moduleLabel(modules[i + 1]), `fx:modset:${id}:${modules[i + 1].id}`);
    kb.row();
  }
  kb.text("⬅️ Orqaga", `fx:menu:${id}`);
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({ reply_markup: kb });
}

export async function handleFixModuleSet(ctx: MyContext, id: number, moduleId: number): Promise<void> {
  if (!(await load(ctx, id))) return;
  await prisma.request.update({ where: { id }, data: { moduleId } });
  await ctx.answerCallbackQuery({ text: "Modul o'zgartirildi" });
  await afterFix(ctx, id);
}

export async function handleFixSchoolMenu(ctx: MyContext, id: number): Promise<void> {
  const r = await load(ctx, id);
  if (!r) return;
  const recent = await prisma.school.findMany({ orderBy: { id: "desc" }, take: 8 });
  const kb = new InlineKeyboard();
  const list = recent.filter((s) => s.id !== r.schoolId);
  for (let i = 0; i < list.length; i += 2) {
    kb.text(list[i].name, `fx:schset:${id}:${list[i].id}`);
    if (list[i + 1]) kb.text(list[i + 1].name, `fx:schset:${id}:${list[i + 1].id}`);
    kb.row();
  }
  kb.text("✏️ Nom yozish", `fx:schtext:${id}`).row().text("⬅️ Orqaga", `fx:menu:${id}`);
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({ reply_markup: kb });
}

export async function handleFixSchoolSet(ctx: MyContext, id: number, schoolId: number): Promise<void> {
  if (!(await load(ctx, id))) return;
  await prisma.request.update({ where: { id }, data: { schoolId } });
  await ctx.answerCallbackQuery({ text: "Maktab o'zgartirildi" });
  await afterFix(ctx, id);
}

export async function handleFixSchoolText(ctx: MyContext, id: number): Promise<void> {
  if (!(await load(ctx, id))) return;
  ctx.session.step = "fix_school_text";
  ctx.session.fixRequestId = id;
  await ctx.answerCallbackQuery();
  await ctx.reply("Maktab nomini yozing:");
}

/** fix_school_text bosqichida yozilgan nom */
export async function handleFixSchoolInput(ctx: MyContext, text: string): Promise<void> {
  const id = ctx.session.fixRequestId;
  ctx.session.step = "idle";
  ctx.session.fixRequestId = undefined;
  if (!id) return;
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  if (text.length < 3) {
    await ctx.reply("Maktab nomi juda qisqa — kamida 3 harf yozing.");
    return;
  }

  // Tuzatish oqimida o'xshashi topilsa eng yaqinini ishlatamiz — dublikat yaratmaymiz
  const match = await matchSchool(text);
  let schoolId: number;
  if (match.kind === "exact") {
    schoolId = match.school.id;
  } else if (match.kind === "similar") {
    schoolId = match.schools[0].id;
  } else {
    const school = await createSchool(text, op.id);
    await notifyAdmins(
      ctx.api,
      `🏫 <b>Yangi maktab qo'shildi:</b> ${escapeHtml(school.name)}\n👤 Operator: ${escapeHtml(op.fullName)}`
    );
    schoolId = school.id;
  }

  await prisma.request.update({ where: { id }, data: { schoolId } });
  await refreshCard(ctx.api, id);
  await syncClientMemory(id);
  const r = await prisma.request.findUnique({ where: { id }, include: { school: true } });
  await ctx.reply(
    `✅ ${ticketId(r!.ticketNumber)} — maktab: <b>${escapeHtml(r!.school.name)}</b>`,
    { parse_mode: "HTML" }
  );
}

async function afterFix(ctx: MyContext, id: number): Promise<void> {
  await refreshCard(ctx.api, id);
  await syncClientMemory(id);
  await renderSummary(ctx, id);
}

/**
 * Tuzatilgan qiymat o'sha mijozning xotirasiga ham yoziladi — keyingi safar
 * shu mijozdan kelgan xabar to'g'ri taxmin qilinsin.
 */
async function syncClientMemory(requestId: number): Promise<void> {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r?.clientKey) return;
  await correctClientMemory(r.clientKey, r.schoolId, r.type, r.moduleId);
}
