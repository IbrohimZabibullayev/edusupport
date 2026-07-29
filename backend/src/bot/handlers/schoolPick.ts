import { InlineKeyboard } from "grammy";
import { escapeHtml } from "../../util";
import { buildModuleKeyboard, submitKeyboard } from "../keyboards";
import { getActiveModules } from "../services/modules";
import { notifyAdmins } from "../services/notify";
import { createSchool, matchSchool } from "../services/schools";
import { ASK_DESC, ASK_LOG_MODULE } from "../texts";
import { MyContext, SchoolFlow } from "../types";
import { requireApprovedOperator } from "./registration";

/**
 * Maktab nomini hal qiladigan umumiy bosqich — /new, /log va forward oqimi
 * shu yerdan o'tadi, shuning uchun dublikat himoyasi hamma joyda bir xil.
 *
 * - normalizatsiyadan keyin aynan mos kelsa → so'ramasdan bog'lanadi
 * - o'xshashi bo'lsa (imlo xatosi, qisqartma) → operatordan so'raladi
 * - hech nima topilmasa → yangi maktab yaratiladi
 */
export async function resolveSchoolOrAsk(ctx: MyContext, text: string, flow: SchoolFlow): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  if (text.trim().length < 3) {
    await ctx.reply("Maktab nomi juda qisqa — kamida 3 harf yozing.");
    return;
  }
  const name = text.trim();
  const match = await matchSchool(name);

  if (match.kind === "exact") {
    await continueAfterSchool(ctx, flow, match.school.id);
    return;
  }

  if (match.kind === "similar") {
    ctx.session.schoolAsk = { flow, name, ids: match.schools.map((s) => s.id) };
    ctx.session.step = "school_confirm";
    const kb = new InlineKeyboard();
    for (const s of match.schools) kb.text(`✅ ${s.name}`, `sch:pick:${s.id}`).row();
    kb.text(`➕ Yangi maktab: ${name}`, "sch:new");
    await ctx.reply(
      [
        `Siz yozdingiz: <b>${escapeHtml(name)}</b>`,
        "",
        match.schools.length > 1
          ? "Bazada shunga o'xshash maktablar bor. Qaysi biri?"
          : "Bazada shunga o'xshash maktab bor. Shumi?",
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: kb }
    );
    return;
  }

  await continueAfterSchool(ctx, flow, await createAndAnnounce(ctx, name));
}

async function createAndAnnounce(ctx: MyContext, name: string): Promise<number> {
  const op = (await requireApprovedOperator(ctx))!;
  const school = await createSchool(name, op.id);
  await notifyAdmins(
    ctx.api,
    `🏫 <b>Yangi maktab qo'shildi:</b> ${escapeHtml(school.name)}\n👤 Operator: ${escapeHtml(op.fullName)}`
  );
  return school.id;
}

/** Taklif qilingan maktablardan biri tanlandi */
export async function handleSchoolConfirmPick(ctx: MyContext, schoolId: number): Promise<void> {
  const ask = ctx.session.schoolAsk;
  if (!ask || !ask.ids.includes(schoolId)) {
    await ctx.answerCallbackQuery({ text: "Bu savol eskirgan", show_alert: true });
    return;
  }
  ctx.session.schoolAsk = undefined;
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  await continueAfterSchool(ctx, ask.flow, schoolId);
}

/** "Yo'q, baribir yangi maktab" */
export async function handleSchoolConfirmNew(ctx: MyContext): Promise<void> {
  const ask = ctx.session.schoolAsk;
  if (!ask) {
    await ctx.answerCallbackQuery({ text: "Bu savol eskirgan", show_alert: true });
    return;
  }
  ctx.session.schoolAsk = undefined;
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  await continueAfterSchool(ctx, ask.flow, await createAndAnnounce(ctx, ask.name));
}

/** Tasdiq bosqichida tugma o'rniga boshqa nom yozilsa — qaytadan qidiramiz */
export async function handleSchoolConfirmText(ctx: MyContext, text: string): Promise<void> {
  const ask = ctx.session.schoolAsk;
  if (!ask) {
    ctx.session.step = "idle";
    return;
  }
  await resolveSchoolOrAsk(ctx, text, ask.flow);
}

/** Maktab aniqlangach oqim davom etadi */
async function continueAfterSchool(ctx: MyContext, flow: SchoolFlow, schoolId: number): Promise<void> {
  ctx.session.schoolAsk = undefined;
  if (flow === "req") {
    ctx.session.draft = { ...ctx.session.draft, schoolId, descTexts: [], attachments: [] };
    ctx.session.step = "req_desc";
    await ctx.reply(ASK_DESC, { reply_markup: submitKeyboard });
    return;
  }
  ctx.session.logDraft = { ...ctx.session.logDraft, schoolId };
  ctx.session.step = "log_module";
  await ctx.reply(ASK_LOG_MODULE, { reply_markup: buildModuleKeyboard(await getActiveModules()) });
}
