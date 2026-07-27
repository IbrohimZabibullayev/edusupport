import { Message } from "grammy/types";
import { DraftAttachment } from "../types";

/** Xabardagi media turi va file_id — yo'q bo'lsa null (matnli xabar) */
export function extractMedia(msg: Message): { kind: string; fileId: string } | null {
  if (msg.photo?.length) return { kind: "photo", fileId: msg.photo[msg.photo.length - 1].file_id };
  if (msg.video) return { kind: "video", fileId: msg.video.file_id };
  if (msg.voice) return { kind: "voice", fileId: msg.voice.file_id };
  if (msg.audio) return { kind: "audio", fileId: msg.audio.file_id };
  if (msg.video_note) return { kind: "video_note", fileId: msg.video_note.file_id };
  if (msg.animation) return { kind: "animation", fileId: msg.animation.file_id };
  if (msg.document) return { kind: "document", fileId: msg.document.file_id };
  return null;
}

/** Yig'ilgan matnlar va fayl izohlaridan so'rov tavsifini quradi */
export function draftDescription(texts: string[], attachments: DraftAttachment[]): string {
  const captions = attachments.filter((a) => a.caption).map((a) => a.caption as string);
  return [...texts, ...captions].join("\n\n") || "(matnsiz — media biriktirilgan)";
}
