import { Prisma } from "@prisma/client";
import { Request as ExpressRequest, Router } from "express";
import { prisma } from "../../db";
import { tashkentDayStart, tashkentWeekStart } from "../../util";
import { wrap } from "../middleware/wrap";

export const statsRouter = Router();

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function periodWhere(req: ExpressRequest): Prisma.RequestWhereInput {
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (!from && !to) return {};
  return { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } };
}

statsRouter.get("/overview", wrap(async (req, res) => {
  const where = periodWhere(req);
  const [total, byType, byModuleRaw, modules] = await Promise.all([
    prisma.request.count({ where }),
    prisma.request.groupBy({ by: ["type"], where, _count: { _all: true } }),
    prisma.request.groupBy({ by: ["moduleId"], where, _count: { _all: true } }),
    prisma.module.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  const counts = new Map(byModuleRaw.map((r) => [r.moduleId, r._count._all]));
  res.json({
    total,
    byType: Object.fromEntries(byType.map((r) => [r.type, r._count._all])),
    // Faol modullar (0 bilan ham) + so'rovi bor nofaol modullar
    byModule: modules
      .filter((m) => m.isActive || counts.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, count: counts.get(m.id) ?? 0 })),
  });
}));

// Tanlangan davrga moslashuvchi trend: hafta→7 kun, oy→30 kun, hammasi→12 hafta
statsRouter.get("/trend", wrap(async (req, res) => {
  const period = req.query.period;
  const isAll = period === "all";
  const isMonth = period === "month";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const WEEK_MS = 7 * DAY_MS;
  const count = isAll ? 12 : isMonth ? 30 : 7;
  const step = isAll ? WEEK_MS : DAY_MS;
  const start = isAll ? tashkentWeekStart(new Date(), count - 1) : tashkentDayStart(new Date(), count - 1);

  const requests = await prisma.request.findMany({
    where: { createdAt: { gte: start } },
    select: { createdAt: true },
  });

  const labelFmt = new Intl.DateTimeFormat("uz-UZ", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit" });
  const points = Array.from({ length: count }, (_, i) => ({
    label: labelFmt.format(new Date(start.getTime() + i * step)),
    total: 0,
  }));

  for (const r of requests) {
    const idx = Math.floor((r.createdAt.getTime() - start.getTime()) / step);
    if (idx < 0 || idx >= count) continue;
    points[idx].total++;
  }

  res.json({ granularity: isAll ? "week" : "day", points });
}));

statsRouter.get("/weekly", wrap(async (_req, res) => {
  const WEEKS = 12;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const start = tashkentWeekStart(new Date(), WEEKS - 1);

  const requests = await prisma.request.findMany({
    where: { createdAt: { gte: start } },
    select: { createdAt: true, type: true },
  });

  const labelFmt = new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
  });

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const weekStart = new Date(start.getTime() + i * WEEK_MS);
    return {
      weekStart: weekStart.toISOString(),
      label: labelFmt.format(weekStart),
      total: 0,
      bug: 0,
      issue: 0,
      suggestion: 0,
    };
  });

  for (const r of requests) {
    const idx = Math.floor((r.createdAt.getTime() - start.getTime()) / WEEK_MS);
    if (idx < 0 || idx >= WEEKS) continue;
    weeks[idx].total++;
    if (r.type === "BUG") weeks[idx].bug++;
    else if (r.type === "ISSUE") weeks[idx].issue++;
    else weeks[idx].suggestion++;
  }

  res.json(weeks);
}));

statsRouter.get("/schools", wrap(async (req, res) => {
  const where = periodWhere(req);
  const grouped = await prisma.request.groupBy({
    by: ["schoolId"],
    where,
    _count: { _all: true },
    orderBy: { _count: { schoolId: "desc" } },
  });
  const schools = await prisma.school.findMany({
    where: { id: { in: grouped.map((g) => g.schoolId) } },
  });
  res.json(
    grouped.map((g) => ({
      id: g.schoolId,
      name: schools.find((s) => s.id === g.schoolId)?.name ?? `#${g.schoolId}`,
      count: g._count._all,
    }))
  );
}));

statsRouter.get("/operators", wrap(async (req, res) => {
  const where = periodWhere(req);
  const grouped = await prisma.request.groupBy({
    by: ["operatorId"],
    where,
    _count: { _all: true },
    orderBy: { _count: { operatorId: "desc" } },
  });
  const operators = await prisma.operator.findMany({
    where: { id: { in: grouped.map((g) => g.operatorId) } },
  });
  res.json(
    grouped.map((g) => {
      const op = operators.find((o) => o.id === g.operatorId);
      return {
        id: g.operatorId,
        fullName: op?.fullName ?? `#${g.operatorId}`,
        status: op?.status ?? null,
        count: g._count._all,
      };
    })
  );
}));
