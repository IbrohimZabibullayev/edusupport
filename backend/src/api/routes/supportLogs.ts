import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../db";
import { wrap } from "../middleware/wrap";

export const supportLogsRouter = Router();

function buildWhere(q: Record<string, unknown>): Prisma.SupportLogWhereInput {
  const where: Prisma.SupportLogWhereInput = {};
  const num = (v: unknown) => (typeof v === "string" && v && !isNaN(Number(v)) ? Number(v) : undefined);

  const systemId = num(q.systemId);
  const schoolId = num(q.schoolId);
  const moduleId = num(q.moduleId);
  const operatorId = num(q.operatorId);
  const priorityId = num(q.priorityId);
  if (systemId !== undefined) where.systemId = systemId;
  if (schoolId !== undefined) where.schoolId = schoolId;
  if (moduleId !== undefined) where.moduleId = moduleId;
  if (operatorId !== undefined) where.operatorId = operatorId;
  if (priorityId !== undefined) where.priorityId = priorityId;
  if (q.recurring === "true") where.recurring = true;
  if (q.recurring === "false") where.recurring = false;

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
    where.OR = [
      { problem: { contains: search, mode: "insensitive" } },
      { school: { name: { contains: search, mode: "insensitive" } } },
      { operator: { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }
  return where;
}

supportLogsRouter.get("/", wrap(async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
  const where = buildWhere(q);

  const [total, items] = await Promise.all([
    prisma.supportLog.count({ where }),
    prisma.supportLog.findMany({
      where,
      include: {
        system: { select: { name: true } },
        school: { select: { name: true } },
        module: { select: { name: true, emoji: true } },
        priority: { select: { name: true, color: true } },
        operator: { select: { fullName: true } },
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
    items: items.map((l) => ({
      id: l.id,
      logNumber: l.logNumber,
      system: l.system?.name ?? null,
      systemId: l.systemId,
      school: l.school.name,
      schoolId: l.schoolId,
      module: l.module.name,
      moduleEmoji: l.module.emoji,
      moduleId: l.moduleId,
      problem: l.problem,
      priority: l.priority?.name ?? null,
      priorityColor: l.priority?.color ?? null,
      priorityId: l.priorityId,
      resolveMinutes: l.resolveMinutes,
      recurring: l.recurring,
      operator: l.operator.fullName,
      operatorId: l.operatorId,
      createdAt: l.createdAt,
    })),
  });
}));

supportLogsRouter.get("/stats", wrap(async (req, res) => {
  const where = buildWhere(req.query as Record<string, unknown>);

  const [agg, byModuleRaw, byOperatorRaw, byPriorityRaw, recurringCount, modules, operators, priorities] =
    await Promise.all([
      prisma.supportLog.aggregate({ where, _count: { _all: true }, _sum: { resolveMinutes: true } }),
      prisma.supportLog.groupBy({ by: ["moduleId"], where, _count: { _all: true }, _sum: { resolveMinutes: true } }),
      prisma.supportLog.groupBy({ by: ["operatorId"], where, _count: { _all: true }, _sum: { resolveMinutes: true } }),
      prisma.supportLog.groupBy({ by: ["priorityId"], where, _count: { _all: true } }),
      prisma.supportLog.count({ where: { ...where, recurring: true } }),
      prisma.module.findMany({ select: { id: true, name: true, emoji: true } }),
      prisma.operator.findMany({ select: { id: true, fullName: true } }),
      prisma.priority.findMany({ select: { id: true, name: true, color: true } }),
    ]);

  const moduleName = (id: number) => modules.find((m) => m.id === id);
  const operatorName = (id: number) => operators.find((o) => o.id === id)?.fullName ?? `#${id}`;
  const priorityInfo = (id: number | null) => (id === null ? null : priorities.find((p) => p.id === id));

  res.json({
    total: agg._count._all,
    totalMinutes: agg._sum.resolveMinutes ?? 0,
    recurringCount,
    byModule: byModuleRaw
      .map((r) => {
        const m = moduleName(r.moduleId);
        return { id: r.moduleId, name: m?.name ?? `#${r.moduleId}`, emoji: m?.emoji ?? "", count: r._count._all, minutes: r._sum.resolveMinutes ?? 0 };
      })
      .sort((a, b) => b.count - a.count),
    byOperator: byOperatorRaw
      .map((r) => ({ id: r.operatorId, name: operatorName(r.operatorId), count: r._count._all, minutes: r._sum.resolveMinutes ?? 0 }))
      .sort((a, b) => b.count - a.count),
    byPriority: byPriorityRaw
      .map((r) => {
        const p = priorityInfo(r.priorityId);
        return { id: r.priorityId, name: p?.name ?? "—", color: p?.color ?? "#898781", count: r._count._all };
      })
      .sort((a, b) => b.count - a.count),
  });
}));
