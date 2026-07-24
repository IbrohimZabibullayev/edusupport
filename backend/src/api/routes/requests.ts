import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../db";
import { ticketId } from "../../util";
import { wrap } from "../middleware/wrap";

export const requestsRouter = Router();

requestsRouter.get("/", wrap(async (req, res) => {
  const q = req.query;
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));

  const where: Prisma.RequestWhereInput = {};

  if (typeof q.type === "string" && q.type.trim()) where.type = q.type.trim();
  if (q.done === "true") where.done = true;
  if (q.done === "false") where.done = false;
  if (q.systemId && !isNaN(Number(q.systemId))) where.systemId = Number(q.systemId);
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
        system: { select: { name: true } },
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
      systemId: r.systemId,
      system: r.system?.name ?? null,
      moduleId: r.moduleId,
      module: r.module.name,
      moduleEmoji: r.module.emoji,
      school: r.school.name,
      schoolId: r.schoolId,
      operator: r.operator.fullName,
      operatorId: r.operatorId,
      description: r.description,
      done: r.done,
      doneAt: r.doneAt,
      attachments: r.attachments,
      createdAt: r.createdAt,
    })),
  });
}));

// Paneldan so'rov statusini o'zgartirish (bajarildi / qayta ochish)
requestsRouter.patch("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const done = req.body?.done;
  if (typeof done !== "boolean") {
    res.status(400).json({ error: "done maydoni true/false bo'lishi kerak" });
    return;
  }
  try {
    const r = await prisma.request.update({
      where: { id },
      data: { done, doneAt: done ? new Date() : null },
    });
    res.json({ id: r.id, done: r.done, doneAt: r.doneAt });
  } catch {
    res.status(404).json({ error: "So'rov topilmadi" });
  }
}));
