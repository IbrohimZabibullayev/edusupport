import { session } from "grammy";
import { MyContext, SessionData } from "./types";
import { PrismaStorage } from "./storage";

const storage = new PrismaStorage<SessionData>();

/**
 * Sessiya kaliti: shaxsiy chatda chat ID (eski yozuvlar saqlanib qolsin),
 * guruhda esa chat+foydalanuvchi — bir guruhdagi ikki odam bir-birining
 * suhbatiga tushib qolmasligi uchun.
 */
export function sessionKey(ctx: { chat?: { id: number; type: string }; from?: { id: number } }): string | undefined {
  if (!ctx.chat) return undefined;
  if (ctx.chat.type === "private") return String(ctx.chat.id);
  return ctx.from ? `${ctx.chat.id}:${ctx.from.id}` : undefined;
}

export const sessionMiddleware = session({
  initial: (): SessionData => ({ step: "idle" }),
  storage,
  getSessionKey: sessionKey,
});

/**
 * Sessiyani qo'lda saqlaydi.
 *
 * grammY sessiyani yangilanish (update) qayta ishlanib bo'lgach yozadi. Agar
 * ish setTimeout ichida — tsikl tugagandan keyin bajarilsa, o'zgarishlar
 * yo'qoladi. Forward qilib hech nima yozmaganda tasdiq tugmasi "eskirgan"
 * deyishining sababi shu edi.
 */
export async function persistSession(ctx: MyContext): Promise<void> {
  const key = sessionKey(ctx);
  if (!key) return;
  try {
    await storage.write(key, ctx.session);
  } catch (err) {
    console.error("Sessiya saqlanmadi:", err);
  }
}
