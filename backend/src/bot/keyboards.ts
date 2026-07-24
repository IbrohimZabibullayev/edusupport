import { InlineKeyboard, Keyboard } from "grammy";
import { moduleLabel } from "./services/modules";
import { requestTypeLabel } from "./services/requestTypes";
import { BTN_BACK, BTN_CANCEL, BTN_NEW_REQUEST, BTN_SUBMIT } from "./texts";

export const mainMenu = new Keyboard().text(BTN_NEW_REQUEST).resized().persistent();

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

/** Izoh bosqichi: bir nechta xabar yig'ilgach "Jo'natish" bosiladi */
export const submitKeyboard = new Keyboard()
  .text(BTN_SUBMIT)
  .row()
  .text(BTN_BACK)
  .text(BTN_CANCEL)
  .resized();

export function approvalKeyboard(operatorId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Tasdiqlash", `op_approve:${operatorId}`)
    .text("❌ Rad etish", `op_reject:${operatorId}`);
}
