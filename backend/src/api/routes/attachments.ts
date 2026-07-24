import { GrammyError } from "grammy";
import { Router } from "express";
import { bot } from "../../bot/bot";
import { config } from "../../config";
import { prisma } from "../../db";
import { wrap } from "../middleware/wrap";

export const attachmentsRouter = Router();

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  pdf: "application/pdf",
};

/**
 * Fayl bizning tizimda saqlanmaydi — bazadagi file_id orqali Telegram'dan
 * olinadi va panelga oqizib beriladi (BOT_TOKEN tashqariga chiqmaydi).
 */
attachmentsRouter.get("/:id/file", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const attachment = await prisma.requestAttachment.findUnique({ where: { id } });
  if (!attachment) {
    res.status(404).json({ error: "Fayl topilmadi" });
    return;
  }

  let file;
  try {
    file = await bot.api.getFile(attachment.fileId);
  } catch (err) {
    // file_id botga bog'liq: boshqa bot (masalan lokal dev bot) yuklagan yoki muddati o'tgan
    // faylni bu bot ololmaydi — panelni buzmaslik uchun toza 404 qaytaramiz (stack trace emas)
    if (err instanceof GrammyError && err.error_code === 400) {
      res.status(404).json({ error: "Fayl mavjud emas (boshqa bot yuklagan yoki muddati o'tgan)" });
      return;
    }
    throw err;
  }
  if (!file.file_path) {
    res.status(502).json({ error: "Telegram fayl yo'lini qaytarmadi" });
    return;
  }

  const tgRes = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`);
  if (!tgRes.ok) {
    res.status(502).json({ error: "Telegramdan faylni olib bo'lmadi" });
    return;
  }

  const ext = file.file_path.split(".").pop()?.toLowerCase() ?? "";
  res.setHeader(
    "Content-Type",
    MIME_BY_EXT[ext] ?? tgRes.headers.get("content-type") ?? "application/octet-stream"
  );
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(Buffer.from(await tgRes.arrayBuffer()));
}));
