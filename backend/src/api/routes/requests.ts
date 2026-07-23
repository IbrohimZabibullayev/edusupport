import { Prisma, RequestType } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../db";
import { ticketId } from "../../util";
import { wrap } from "../middleware/wrap";

export const requestsRouter = Router();

const TYPES = new Set<string>(["BUG", "ISSUE", "SUGGESTION"]);

requestsRouter.get("/", wrap(async (req, res) => {
  const q = req.query;
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));

  const where: Prisma.RequestWhereInput = {};

  if (typeof q.type === "string" && TYPES.has(q.type)) where.type = q.type as RequestType;
  if (q.moduleId && !isNaN(Number(q.moduleId))) where.moduleId = Number(q.moduleId);
  if (q.schoolId && !isNaN(Number(q.schoolId))) where.schoolId = Number(q.schoolId);
  if (q.operatorId && !isNaN(Number(q.operatorId))) where.operatorId = Number(q.operatorId);

  const from = typeof q.from === "string" && q.from ? new Date(q.from) : undefined;
  const to = typeof q.to === "string" && q.to ? new Date(q.to) : undefined;
  if ((from && !isNaN(+from)) || (to && !isNaN(+to))) {
    where.createdAt = {
      ...(from && !isNaN(+from) && { gte: from }),
      ...(to && !isNaN(+to) && { lte: to }),
    };
  }

  if (typeof q.search === "string" && q.search.trim()) {
    const search = q.search.trim();
    const ticketMatch = search.match(/^ES-?(\d+)$/i);
    if (ticketMatch) {
      where.ticketNumber = Number(ticketMatch[1]);
    } else {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { school: { name: { contains: search, mode: "insensitive" } } },
        { operator: { fullName: { contains: search, mode: "insensitive" } } },
        { module: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
  }

  const [total, items] = await Promise.all([
    prisma.request.count({ where }),
    prisma.request.findMany({
      where,
      include: {
        school: { select: { name: true } },
        operator: { select: { fullName: true } },
        module: { select: { name: true, emoji: true } },
        attachments: { select: { id: true, kind: true, caption: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    total,
    page,
    pageSize,
    items: items.map((r) => ({
      id: r.id,
      ticket: ticketId(r.ticketNumber),
      type: r.type,
      moduleId: r.moduleId,
      module: r.module.name,
      moduleEmoji: r.module.emoji,
      school: r.school.name,
      schoolId: r.schoolId,
      operator: r.operator.fullName,
      operatorId: r.operatorId,
      description: r.description,
      attachments: r.attachments,
      createdAt: r.createdAt,
    })),
  });
}));
