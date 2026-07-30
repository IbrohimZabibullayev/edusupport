import { Operator } from "@prisma/client";
import { Api } from "grammy";
import { prisma } from "../../db";
import { RequestDraft } from "../types";
import { draftDescription } from "./content";
import { routeRequest } from "./notify";

/**
 * Qoralamadan so'rov yaratadi va guruhga yo'naltiradi.
 * /new wizard ham, forward oqimi ham shu funksiyadan foydalanadi.
 *
 * Qaytadigan `delivery` — so'rov haqiqatan qayerga tushgani. Operatorga
 * "guruhga yuborildi" deb aytishdan oldin shuni tekshirish kerak.
 */
export async function createRequestFromDraft(api: Api, op: Operator, draft: RequestDraft) {
  const attachments = draft.attachments ?? [];
  const request = await prisma.request.create({
    data: {
      type: draft.type as string,
      // -1 — "tizim yo'q" sentineli (forward oqimida savol o'tkazib yuborilgan)
      systemId: draft.systemId && draft.systemId > 0 ? draft.systemId : null,
      moduleId: draft.moduleId as number,
      schoolId: draft.schoolId as number,
      operatorId: op.id,
      clientKey: draft.clientKey ?? null,
      description: draftDescription(draft.descTexts ?? [], attachments),
      attachments: {
        create: attachments.map((a) => ({ kind: a.kind, fileId: a.fileId, caption: a.caption ?? null })),
      },
    },
    include: { school: true, module: true, system: true },
  });

  const delivery = await routeRequest(
    api,
    request.id,
    attachments.map((a) => ({ chatId: a.chatId, messageId: a.messageId }))
  );

  return { ...request, delivery };
}
