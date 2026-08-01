import { prisma } from "../../db";
import { escapeHtml, formatMinutes, parseDurationToMinutes } from "../../util";
import {
  backCancelKeyboard,
  buildModuleKeyboard,
  buildPriorityKeyboard,
  buildSystemKeyboard,
  mainMenu,
  yesNoKeyboard,
} from "../keyboards";
import { getActiveModules, moduleLabel } from "../services/modules";
import { notifyAdmins } from "../services/notify";
import { getActivePriorities } from "../services/priorities";
import { getActiveSystems } from "../services/systems";
import { ASK_LOG_MODULE as ASK_MODULE, ASK_LOG_PROBLEM as ASK_PROBLEM, BTN_BACK, BTN_CANCEL, BTN_NO, BTN_YES } from "../texts";
import { MyContext } from "../types";
import { requireApprovedOperator } from "./registration";
import { resolveSchoolOrAsk } from "./schoolPick";

const ASK_SYSTEM = "Support log — qaysi tizim bo'yicha? Tanlang:";
const ASK_SCHOOL = "Mijoz (maktab/muassasa) nomini yozing:";


const ASK_PRIORITY = "Muammoning darajasi (prioriteti)?";
const ASK_TIME = [
  "Muammoni hal qilishga qancha vaqt ketdi?",
  "",
  "Masalan: <code>20</code> yoki <code>20 daqiqa</code> yoki <code>1 soat 20 daqiqa</code>.",
].join("\n");
const ASK_RECURRING = "Bu muammo takroriymi (avval ham bo'lganmi)?";

/** Tartib: tizim → modul → markaz → muammo → prioritet → vaqt → takroriy */
export async function startLogWizard(ctx: MyContext): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  ctx.session.logDraft = {};
  const systems = await getActiveSystems();
  if (systems.length > 0) {
    ctx.session.step = "log_system";
    await ctx.reply(ASK_SYSTEM, { reply_markup: buildSystemKeyboard(systems) });
  } else {
    ctx.session.step = "log_module";
    await ctx.reply(ASK_MODULE, { reply_markup: buildModuleKeyboard(await getActiveModules()) });
  }
}

async function cancel(ctx: MyContext): Promise<void> {
  ctx.session.step = "idle";
  ctx.session.logDraft = undefined;
  await ctx.reply("❌ Support log bekor qilindi.", { reply_markup: mainMenu });
}

export async function handleLogSystem(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancel(ctx);
  const systems = await getActiveSystems();
  const chosen = systems.find((s) => s.name === text);
  if (!chosen) {
    await ctx.reply("Iltimos, pastdagi tugmalardan birini tanlang.", { reply_markup: buildSystemKeyboard(systems) });
    return;
  }
  ctx.session.logDraft = { ...ctx.session.logDraft, systemId: chosen.id };
  ctx.session.step = "log_module";
  await ctx.reply(ASK_MODULE, { reply_markup: buildModuleKeyboard(await getActiveModules()) });
}

export async function handleLogModule(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancel(ctx);
  if (text === BTN_BACK) {
    const systems = await getActiveSystems();
    if (systems.length > 0) {
      ctx.session.step = "log_system";
      await ctx.reply(ASK_SYSTEM, { reply_markup: buildSystemKeyboard(systems) });
      return;
    }
  }
  const modules = await getActiveModules();
  const chosen = modules.find((m) => moduleLabel(m) === text);
  if (!chosen) {
    await ctx.reply("Iltimos, pastdagi tugmalardan birini tanlang.", { reply_markup: buildModuleKeyboard(modules) });
    return;
  }
  ctx.session.logDraft = { ...ctx.session.logDraft, moduleId: chosen.id };
  ctx.session.step = "log_school";
  await ctx.reply(ASK_SCHOOL, { reply_markup: backCancelKeyboard });
}

export async function handleLogSchool(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancel(ctx);
  if (text === BTN_BACK) {
    ctx.session.step = "log_module";
    await ctx.reply(ASK_MODULE, { reply_markup: buildModuleKeyboard(await getActiveModules()) });
    return;
  }
  // Dublikat himoyasi umumiy bosqichda — oqim shu yerdan davom etadi
  await resolveSchoolOrAsk(ctx, text, "log");
}

export async function handleLogProblem(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancel(ctx);
  if (text === BTN_BACK) {
    ctx.session.step = "log_school";
    await ctx.reply(ASK_SCHOOL, { reply_markup: backCancelKeyboard });
    return;
  }
  if (text.length < 3) {
    await ctx.reply("Muammo tavsifi juda qisqa — biroz batafsilroq yozing.");
    return;
  }
  ctx.session.logDraft = { ...ctx.session.logDraft, problem: text };

  const priorities = await getActivePriorities();
  if (priorities.length > 0) {
    ctx.session.step = "log_priority";
    await ctx.reply(ASK_PRIORITY, { reply_markup: buildPriorityKeyboard(priorities) });
  } else {
    ctx.session.step = "log_time";
    await ctx.reply(ASK_TIME, { parse_mode: "HTML", reply_markup: backCancelKeyboard });
  }
}

export async function handleLogPriority(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancel(ctx);
  if (text === BTN_BACK) {
    ctx.session.step = "log_problem";
    await ctx.reply(ASK_PROBLEM, { reply_markup: backCancelKeyboard });
    return;
  }
  const priorities = await getActivePriorities();
  const chosen = priorities.find((p) => p.name === text);
  if (!chosen) {
    await ctx.reply("Iltimos, pastdagi tugmalardan birini tanlang.", { reply_markup: buildPriorityKeyboard(priorities) });
    return;
  }
  ctx.session.logDraft = { ...ctx.session.logDraft, priorityId: chosen.id };
  ctx.session.step = "log_time";
  await ctx.reply(ASK_TIME, { parse_mode: "HTML", reply_markup: backCancelKeyboard });
}

export async function handleLogTime(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancel(ctx);
  if (text === BTN_BACK) {
    const priorities = await getActivePriorities();
    if (priorities.length > 0) {
      ctx.session.step = "log_priority";
      await ctx.reply(ASK_PRIORITY, { reply_markup: buildPriorityKeyboard(priorities) });
    } else {
      ctx.session.step = "log_problem";
      await ctx.reply(ASK_PROBLEM, { reply_markup: backCancelKeyboard });
    }
    return;
  }
  const minutes = parseDurationToMinutes(text);
  if (minutes === null || minutes <= 0) {
    await ctx.reply("Vaqtni tushunolmadim. Masalan: 20, 20 daqiqa yoki 1 soat 20 daqiqa.");
    return;
  }
  ctx.session.logDraft = { ...ctx.session.logDraft, resolveMinutes: minutes };
  ctx.session.step = "log_recurring";
  await ctx.reply(ASK_RECURRING, { reply_markup: yesNoKeyboard });
}

export async function handleLogRecurring(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancel(ctx);
  if (text === BTN_BACK) {
    ctx.session.step = "log_time";
    await ctx.reply(ASK_TIME, { parse_mode: "HTML", reply_markup: backCancelKeyboard });
    return;
  }
  if (text !== BTN_YES && text !== BTN_NO) {
    await ctx.reply("Iltimos, «Ha» yoki «Yo'q» tugmasini bosing.", { reply_markup: yesNoKeyboard });
    return;
  }
  ctx.session.logDraft = { ...ctx.session.logDraft, recurring: text === BTN_YES };
  await submitLog(ctx);
}

async function submitLog(ctx: MyContext): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;

  const d = ctx.session.logDraft;
  if (!d?.schoolId || !d.moduleId || !d.problem || d.resolveMinutes === undefined) {
    ctx.session.step = "idle";
    ctx.session.logDraft = undefined;
    await ctx.reply("Nimadir xato ketdi. Iltimos, qaytadan boshlang.", { reply_markup: mainMenu });
    return;
  }

  const log = await prisma.supportLog.create({
    data: {
      systemId: d.systemId ?? null,
      schoolId: d.schoolId,
      moduleId: d.moduleId,
      problem: d.problem,
      priorityId: d.priorityId ?? null,
      resolveMinutes: d.resolveMinutes,
      recurring: d.recurring ?? false,
      operatorId: op.id,
    },
    include: { school: true, module: true, priority: true, system: true },
  });

  ctx.session.step = "idle";
  ctx.session.logDraft = undefined;

  await ctx.reply(
    [
      "✅ Support log saqlandi!",
      "",
      ...(log.system ? [`🖥 Tizim: ${escapeHtml(log.system.name)}`] : []),
      `🏫 Mijoz: ${escapeHtml(log.school.name)}`,
      `🧩 Modul: ${escapeHtml(moduleLabel(log.module))}`,
      ...(log.priority ? [`⚡ Daraja: ${escapeHtml(log.priority.name)}`] : []),
      `⏱ Hal qilish vaqti: ${escapeHtml(formatMinutes(log.resolveMinutes))}`,
      `🔁 Takroriy: ${log.recurring ? "Ha" : "Yo'q"}`,
      "",
      `📝 ${escapeHtml(log.problem)}`,
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: mainMenu }
  );
}
