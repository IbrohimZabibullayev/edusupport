import { useEffect, useState } from "react";
import { API_URL, getToken } from "../lib/api";
import { AttachmentInfo } from "../lib/types";

const KIND_LABELS: Record<string, string> = {
  photo: "Rasm",
  video: "Video",
  voice: "Ovozli xabar",
  audio: "Audio",
  video_note: "Video xabar",
  animation: "GIF",
  document: "Fayl",
};

/**
 * Fayl bizning serverda saqlanmaydi — file_id orqali backend Telegram'dan
 * oqizib beradi. Bu komponent uni JWT bilan yuklab, turiga qarab ko'rsatadi.
 */
export function AttachmentView({ attachment }: { attachment: AttachmentInfo }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/attachments/${attachment.id}/file`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  const label = KIND_LABELS[attachment.kind] ?? attachment.kind;

  return (
    <div className="rounded-lg border border-black/10 bg-surface p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      {error ? (
        <p className="text-sm text-danger">Faylni yuklab bo'lmadi (eskirgan bo'lishi mumkin)</p>
      ) : !url ? (
        <p className="text-sm text-muted">Yuklanmoqda…</p>
      ) : attachment.kind === "photo" ? (
        <img src={url} alt={label} className="max-h-72 w-auto rounded-lg" />
      ) : attachment.kind === "video" || attachment.kind === "video_note" || attachment.kind === "animation" ? (
        <video src={url} controls className="max-h-72 w-full rounded-lg" />
      ) : attachment.kind === "voice" || attachment.kind === "audio" ? (
        <audio src={url} controls className="w-full" />
      ) : (
        <a href={url} download className="text-sm font-medium text-accent underline">
          Faylni yuklab olish
        </a>
      )}
      {attachment.caption && <p className="mt-2 text-sm text-ink-2">{attachment.caption}</p>}
    </div>
  );
}
