import { Api, GrammyError, InlineKeyboard } from "grammy";
import { InputMediaPhoto, InputMediaVideo } from "grammy/types";

export interface CardMedia {
  kind: string;
  fileId: string;
}

/** Telegram media izohining chegarasi (ko'rinadigan matn bo'yicha) */
const CAPTION_LIMIT = 1024;

/** Izoh qo'shib yuborish mumkin bo'lgan turlar (video_note izohni qabul qilmaydi) */
const CAPTIONABLE = new Set(["photo", "video", "animation", "document", "audio", "voice"]);
/** Albomga birga tushadigan turlar */
const ALBUMABLE = new Set(["photo", "video"]);

/** HTML teglari Telegram hisobiga kirmaydi — ko'rinadigan uzunlikni o'lchaymiz */
function visibleLength(html: string): number {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;|&gt;|&amp;|&quot;/g, "x").length;
}

/** Bo'lim o'chirilgan yoki yopilgan bo'lsa Telegram shunday xato qaytaradi */
export function isThreadError(err: unknown): boolean {
  return err instanceof GrammyError && /thread not found|TOPIC_CLOSED|TOPIC_DELETED/i.test(err.description);
}

async function sendOne(
  api: Api,
  chatId: string | number,
  m: CardMedia,
  opts: { caption?: string; threadId?: number; keyboard?: InlineKeyboard }
) {
  const common = {
    caption: opts.caption,
    parse_mode: "HTML" as const,
    message_thread_id: opts.threadId,
    reply_markup: opts.keyboard,
  };
  switch (m.kind) {
    case "photo":
      return api.sendPhoto(chatId, m.fileId, common);
    case "video":
      return api.sendVideo(chatId, m.fileId, common);
    case "animation":
      return api.sendAnimation(chatId, m.fileId, common);
    case "audio":
      return api.sendAudio(chatId, m.fileId, common);
    case "voice":
      return api.sendVoice(chatId, m.fileId, common);
    case "video_note":
      return api.sendVideoNote(chatId, m.fileId, {
        message_thread_id: opts.threadId,
        reply_markup: opts.keyboard,
      });
    default:
      return api.sendDocument(chatId, m.fileId, common);
  }
}

/**
 * So'rov kartasini guruhga yuboradi.
 *
 * Matn va media bitta xabar bo'lishi kerak: birinchi media izoh (caption) sifatida
 * kartani ko'taradi va tugmalar ham o'shanda turadi. Qolgan fayllar keyin albom
 * bo'lib boradi.
 *
 * Bitta xabar bo'la olmaydigan hollarda (media yo'q, izoh 1024 belgidan uzun,
 * yoki birinchi fayl izohni qabul qilmaydi) matn alohida yuboriladi — Telegram
 * cheklovi shunday.
 *
 * Qaytadi: tahrirlanadigan karta xabari va u izohmi yoki matnmi.
 */
export async function sendCard(
  api: Api,
  chatId: string | number,
  text: string,
  media: CardMedia[],
  threadId?: number,
  keyboard?: InlineKeyboard
): Promise<{ chatId: number; messageId: number; isCaption: boolean }> {
  const asCaption =
    media.length > 0 && CAPTIONABLE.has(media[0].kind) && visibleLength(text) <= CAPTION_LIMIT;

  try {
    let card: { chat: { id: number }; message_id: number };
    let rest: CardMedia[];

    if (asCaption) {
      card = await sendOne(api, chatId, media[0], { caption: text, threadId, keyboard });
      rest = media.slice(1);
    } else {
      card = await api.sendMessage(chatId, text, {
        parse_mode: "HTML",
        message_thread_id: threadId,
        reply_markup: keyboard,
      });
      rest = media;
    }

    await sendRest(api, chatId, rest, threadId);
    return { chatId: card.chat.id, messageId: card.message_id, isCaption: asCaption };
  } catch (err) {
    if (threadId !== undefined && isThreadError(err)) {
      console.warn(`Bo'lim (${threadId}) topilmadi/yopiq — ${chatId} guruhida General'ga yuboriladi`);
      return sendCard(api, chatId, text, media, undefined, keyboard);
    }
    throw err;
  }
}

/** Kartadan keyingi qolgan fayllar: rasm/video albom bo'lib, qolgani bittalab */
async function sendRest(api: Api, chatId: string | number, rest: CardMedia[], threadId?: number): Promise<void> {
  if (rest.length === 0) return;

  const album = rest.filter((m) => ALBUMABLE.has(m.kind));
  const single = rest.filter((m) => !ALBUMABLE.has(m.kind));

  // Albomda eng ko'pi 10 ta element bo'lishi mumkin
  for (let i = 0; i < album.length; i += 10) {
    const chunk = album.slice(i, i + 10);
    try {
      if (chunk.length === 1) {
        await sendOne(api, chatId, chunk[0], { threadId });
      } else {
        const group = chunk.map<InputMediaPhoto | InputMediaVideo>((m) =>
          m.kind === "video" ? { type: "video", media: m.fileId } : { type: "photo", media: m.fileId }
        );
        await api.sendMediaGroup(chatId, group, { message_thread_id: threadId });
      }
    } catch (err) {
      console.error("Albom yuborilmadi:", err);
    }
  }

  for (const m of single) {
    try {
      await sendOne(api, chatId, m, { threadId });
    } catch (err) {
      console.error(`Fayl (${m.kind}) yuborilmadi:`, err);
    }
  }
}
