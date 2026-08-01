import { InlineKeyboard } from "grammy";
import { prisma } from "../../db";
import {
  escapeHtml,
  formatTashkentDate,
  formatTashkentTime,
  parseWhenTashkent,
  tashkentDayStart,
} from "../../util";
import { backCancelKeyboard, mainMenu } from "../keyboards";
import { BTN_BACK, BTN_CANCEL } from "../texts";
import { MyContext } from "../types";
import { requireApprovedOperator } from "./registration";

/**
 * Operatorning shaxsiy rejasi: o'ziga vazifa qo'yadi, vaqtini belgilaydi va
 * belgilangan vaqtdan 5 daqiqa oldin eslatma oladi. Faqat egasi ko'radi.
 */

const ASK_TITLE = "Nima qilish kerak? Qisqacha yozing:";
const ASK_WITH = [
  "Kim bilan?",
  "",
  "<i>Masalan: Najot Ta'lim direktori. Kerak bo'lmasa «O'tkazib yuborish».</i>",
].join("\n");
const ASK_WHEN = [
  "Qachon?",
  "",
  "Masalan: <code>14:30</code>, <code>ertaga 9:00</code>, <code>02.08 15:00</code>",
].join("\n");

const BTN_SKIP = "⏭ O'tkazib yuborish";

/** Sana sarlavhasi: Bugun / Ertaga / 02.08.2026 */
function dayLabel(due: Date, now: Date): string {
  const d0 = tashkentDayStart(now).getTime();
  const d1 = tashkentDayStart(now, -1).getTime();
  const dueDay = tashkentDayStart(due).getTime();
  if (dueDay === d0) return "Bugun";
  if (dueDay === d1) return "Ertaga";
  return formatTashkentDate(due);
}

/** Operatorning bajarilmagan tasklari + bugun bajarilganlari */
export async function showTasks(ctx: MyContext): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  ctx.session.step = "idle";

  const now = new Date();
  const tasks = await prisma.operatorTask.findMany({
    where: {
      operatorId: op.id,
      OR: [{ done: false }, { doneAt: { gte: tashkentDayStart(now) } }],
    },
    orderBy: [{ done: "asc" }, { dueAt: "asc" }],
    take: 30,
  });

  const kb = new InlineKeyboard().text("➕ Yangi task", "tsk:new");
  if (tasks.length === 0) {
    await ctx.reply(
      ["📝 <b>Mening rejam</b>", "", "Hozircha task yo'q.", "Belgilangan vaqtdan 5 daqiqa oldin eslatib turaman."].join("\n"),
      { parse_mode: "HTML", reply_markup: kb }
    );
    return;
  }

  const lines: string[] = ["📝 <b>Mening rejam</b>", ""];
  let lastDay = "";
  for (const t of tasks) {
    const day = t.done ? "Bajarilgan" : dayLabel(t.dueAt, now);
    if (day !== lastDay) {
      lines.push(`<b>${day}</b>`);
      lastDay = day;
    }
    const overdue = !t.done && t.dueAt < now;
    const mark = t.done ? "✅" : overdue ? "🔴" : "•";
    const who = t.withWhom ? ` — ${escapeHtml(t.withWhom)}` : "";
    lines.push(`${mark} <code>${formatTashkentTime(t.dueAt)}</code>  ${escapeHtml(t.title)}${who}`);
  }

  // Bajarilmaganlarga alohida "bajarildi" tugmasi
  for (const t of tasks.filter((x) => !x.done).slice(0, 8)) {
    kb.row().text(`✅ ${formatTashkentTime(t.dueAt)} ${t.title.slice(0, 26)}`, `tsk:done:${t.id}`);
  }

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: kb });
}

export async function startTaskWizard(ctx: MyContext): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  ctx.session.taskDraft = {};
  ctx.session.step = "task_title";
  await ctx.answerCallbackQuery().catch(() => undefined);
  await ctx.reply(ASK_TITLE, { reply_markup: backCancelKeyboard });
}

async function cancel(ctx: MyContext): Promise<void> {
  ctx.session.step = "idle";
  ctx.session.taskDraft = undefined;
  await ctx.reply("❌ Bekor qilindi.", { reply_markup: mainMenu });
}

export async function handleTaskTitle(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL || text === BTN_BACK) return cancel(ctx);
  if (text.length < 3) {
    await ctx.reply("Juda qisqa — biroz batafsilroq yozing.");
    return;
  }
  ctx.session.taskDraft = { ...ctx.session.taskDraft, title: text };
  ctx.session.step = "task_with";
  await ctx.reply(ASK_WITH, {
    parse_mode: "HTML",
    reply_markup: { keyboard: [[{ text: BTN_SKIP }], [{ text: BTN_BACK }, { text: BTN_CANCEL }]], resize_keyboard: true },
  });
}

export async function handleTaskWith(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancel(ctx);
  if (text === BTN_BACK) {
    ctx.session.step = "task_title";
    await ctx.reply(ASK_TITLE, { reply_markup: backCancelKeyboard });
    return;
  }
  ctx.session.taskDraft = { ...ctx.session.taskDraft, withWhom: text === BTN_SKIP ? undefined : text };
  ctx.session.step = "task_when";
  await ctx.reply(ASK_WHEN, { parse_mode: "HTML", reply_markup: backCancelKeyboard });
}

export async function handleTaskWhen(ctx: MyContext, text: string): Promise<void> {
  if (text === BTN_CANCEL) return cancel(ctx);
  if (text === BTN_BACK) {
    ctx.session.step = "task_with";
    await ctx.reply(ASK_WITH, { parse_mode: "HTML", reply_markup: backCancelKeyboard });
    return;
  }
  const op = await requireApprovedOperator(ctx);
  if (!op) return;

  const due = parseWhenTashkent(text);
  if (!due) {
    await ctx.reply(
      ["Vaqtni tushunolmadim.", "", "Masalan: <code>14:30</code>, <code>ertaga 9:00</code>, <code>02.08 15:00</code>"].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  const draft = ctx.session.taskDraft;
  if (!draft?.title) return cancel(ctx);

  const task = await prisma.operatorTask.create({
    data: { operatorId: op.id, title: draft.title, withWhom: draft.withWhom ?? null, dueAt: due },
  });

  ctx.session.step = "idle";
  ctx.session.taskDraft = undefined;

  const past = due.getTime() <= Date.now();
  await ctx.reply(
    [
      "✅ <b>Saqlandi</b>",
      "",
      `📝 ${escapeHtml(task.title)}`,
      ...(task.withWhom ? [`👥 ${escapeHtml(task.withWhom)}`] : []),
      `🕒 ${dayLabel(due, new Date())} ${formatTashkentTime(due)}`,
      "",
      past ? "<i>Vaqt o'tib ketgan — eslatma bo'lmaydi.</i>" : "<i>5 daqiqa oldin eslatib turaman.</i>",
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: mainMenu }
  );
}

/** Ro'yxatdagi yoki eslatmadagi "bajarildi" tugmasi */
export async function handleTaskDone(ctx: MyContext, id: number): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  const task = await prisma.operatorTask.findUnique({ where: { id } });
  // Faqat o'z taskini yopa oladi
  if (!task || task.operatorId !== op.id) {
    await ctx.answerCallbackQuery({ text: "Task topilmadi", show_alert: true });
    return;
  }
  if (!task.done) {
    await prisma.operatorTask.update({ where: { id }, data: { done: true, doneAt: new Date() } });
  }
  await ctx.answerCallbackQuery({ text: "Bajarildi ✅" });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  await showTasks(ctx);
}

/** Eslatmadagi "keyinroq" — muddatni surish */
export async function handleTaskSnooze(ctx: MyContext, id: number, minutes: number): Promise<void> {
  const op = await requireApprovedOperator(ctx);
  if (!op) return;
  const task = await prisma.operatorTask.findUnique({ where: { id } });
  if (!task || task.operatorId !== op.id) {
    await ctx.answerCallbackQuery({ text: "Task topilmadi", show_alert: true });
    return;
  }
  const due = new Date(Date.now() + minutes * 60_000);
  await prisma.operatorTask.update({ where: { id }, data: { dueAt: due, remindedAt: null } });
  await ctx.answerCallbackQuery({ text: `${formatTashkentTime(due)} ga surildi` });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
}
