import { aiEnabled } from "../ai/client";
import { InlineKeyboard, Keyboard } from "grammy";
import { moduleLabel } from "./services/modules";
import { requestTypeLabel } from "./services/requestTypes";
import { BTN_BACK, BTN_CANCEL, BTN_NEW_REQUEST, BTN_NO, BTN_SUBMIT, BTN_SUPPORT_LOG, BTN_TASKS, BTN_YES } from "./texts";

export const mainMenu = new Keyboard()
  .text(BTN_NEW_REQUEST)
  .text(BTN_SUPPORT_LOG)
  .row()
  .text(BTN_TASKS)
  .resized()
  .persistent();

/**
 * Pastdagi tugmalar qatori.
 *
 * Assistent yoqilgan bo'lsa tugmalar kerak emas — operator shunchaki yozadi,
 * shuning uchun klaviatura yig'ishtiriladi. Assistent o'chiq bo'lsa (kalit yo'q
 * yoki xato) eski tugmali rejim qaytadi.
 */
export function menu(): Keyboard | { remove_keyboard: true } {
  return aiEnabled() ? { remove_keyboard: true } : mainMenu;
}

export const contactKeyboard = new Keyboard()
  .requestContact("📱 Raqamni yuborish")
  .resized()
  .oneTime();

/* Wizard tugmalari — klaviatura o'rnida chiqadigan katta (reply) tugmalar */

/** Tizim tugmalari bazadagi faol tizimlardan dinamik quriladi */
export function buildSystemKeyboard(systems: { name: string }[]): Keyboard {
  const kb = new Keyboard();
  for (const s of systems) kb.text(s.name).row();
  return kb.text(BTN_CANCEL).resized();
}

/** So'rov turi tugmalari bazadagi faol turlardan dinamik quriladi */
export function buildTypeKeyboard(types: { name: string; emoji: string }[]): Keyboard {
  const kb = new Keyboard();
  for (const t of types) kb.text(requestTypeLabel(t)).row();
  return kb.text(BTN_BACK).text(BTN_CANCEL).resized();
}

/** Modul tugmalari bazadagi faol modullardan dinamik quriladi (2 ustunda) */
export function buildModuleKeyboard(modules: { name: string; emoji: string }[]): Keyboard {
  const kb = new Keyboard();
  for (let i = 0; i < modules.length; i += 2) {
    kb.text(moduleLabel(modules[i]));
    if (modules[i + 1]) kb.text(moduleLabel(modules[i + 1]));
    kb.row();
  }
  return kb.text(BTN_BACK).text(BTN_CANCEL).resized();
}

export const backCancelKeyboard = new Keyboard().text(BTN_BACK).text(BTN_CANCEL).resized();

/** Prioritet tugmalari bazadagi faol prioritetlardan dinamik quriladi */
export function buildPriorityKeyboard(priorities: { name: string }[]): Keyboard {
  const kb = new Keyboard();
  for (const p of priorities) kb.text(p.name).row();
  return kb.text(BTN_BACK).text(BTN_CANCEL).resized();
}

/** Takroriy? — Ha / Yo'q */
export const yesNoKeyboard = new Keyboard()
  .text(BTN_YES)
  .text(BTN_NO)
  .row()
  .text(BTN_BACK)
  .text(BTN_CANCEL)
  .resized();

/** Izoh bosqichi: bir nechta xabar yig'ilgach "Jo'natish" bosiladi */
export const submitKeyboard = new Keyboard()
  .text(BTN_SUBMIT)
  .row()
  .text(BTN_BACK)
  .text(BTN_CANCEL)
  .resized();

/* Forward oqimi — inline tugmalar (klaviatura ochilmaydi, xabar ustida turadi) */

export const FWD_CANCEL = "❌ Bekor qilish";

export function fwdTypeKeyboard(types: { key: string; name: string; emoji: string }[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const t of types) kb.text(requestTypeLabel(t), `fwd:type:${t.key}`).row();
  return kb.text(FWD_CANCEL, "fwd:cancel");
}

export function fwdSystemKeyboard(systems: { id: number; name: string }[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const s of systems) kb.text(s.name, `fwd:sys:${s.id}`).row();
  return kb.text(FWD_CANCEL, "fwd:cancel");
}

/** Modul tugmalari 2 ustunda */
export function fwdModuleKeyboard(modules: { id: number; name: string; emoji: string }[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < modules.length; i += 2) {
    kb.text(moduleLabel(modules[i]), `fwd:mod:${modules[i].id}`);
    if (modules[i + 1]) kb.text(moduleLabel(modules[i + 1]), `fwd:mod:${modules[i + 1].id}`);
    kb.row();
  }
  return kb.text(FWD_CANCEL, "fwd:cancel");
}

/** Operator oxirgi ishlatgan maktablar 2 ustunda + qo'lda yozish */
export function fwdSchoolKeyboard(schools: { id: number; name: string }[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < schools.length; i += 2) {
    kb.text(schools[i].name, `fwd:school:${schools[i].id}`);
    if (schools[i + 1]) kb.text(schools[i + 1].name, `fwd:school:${schools[i + 1].id}`);
    kb.row();
  }
  return kb.text("✏️ Boshqa nom yozish", "fwd:schoolnew").row().text(FWD_CANCEL, "fwd:cancel");
}

export function approvalKeyboard(operatorId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Tasdiqlash", `op_approve:${operatorId}`)
    .text("❌ Rad etish", `op_reject:${operatorId}`);
}
