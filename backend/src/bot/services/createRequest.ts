import { Operator } from "@prisma/client";
import { Api } from "grammy";
import { prisma } from "../../db";
import { RequestDraft } from "../types";
import { draftDescription } from "./content";
import { routeRequest } from "./notify";

/**
 * Qoralamadan so'rov yaratadi va guruhga yo'naltiradi.
 * /new wizard ham, forward oqimi ham shu funksiyadan foydalanadi.
 */
export async function createRequestFromDraft(api: Api, op: Operator, draft: RequestDraft) {
  const attachments = draft.attachments ?? [];
  const request = await prisma.request.create({
    data: {
      type: draft.type as string,
      systemId: draft.systemId ?? null,
      moduleId: draft.moduleId as number,
      schoolId: draft.schoolId as number,
      operatorId: op.id,
      description: draftDescription(draft.descTexts ?? [], attachments),
      attachments: {
        create: attachments.map((a) => ({ kind: a.kind, fileId: a.fileId, caption: a.caption ?? null })),
      },
    },
    include: { school: true, module: true, system: true },
  });

  await routeRequest(
    api,
    request.id,
    attachments.map((a) => ({ chatId: a.chatId, messageId: a.messageId }))
  );

  return request;
}
