import { Prisma } from "@prisma/client";
import { Request as ExpressRequest, Router } from "express";
import { prisma } from "../../db";
import { tashkentDayStart, tashkentMonthStart, tashkentWeekStart } from "../../util";
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

// Modul kesimida: qanchasi guruhga so'rov qilingan, qanchasi support logga yozilgan
statsRouter.get("/modules-combined", wrap(async (req, res) => {
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const dateFilter = from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {};

  const [reqByModule, logByModule, modules] = await Promise.all([
    prisma.request.groupBy({ by: ["moduleId"], where: dateFilter, _count: { _all: true } }),
    prisma.supportLog.groupBy({ by: ["moduleId"], where: dateFilter, _count: { _all: true } }),
    prisma.module.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  const reqMap = new Map(reqByModule.map((r) => [r.moduleId, r._count._all]));
  const logMap = new Map(logByModule.map((r) => [r.moduleId, r._count._all]));

  res.json(
    modules
      .filter((m) => m.isActive || reqMap.has(m.id) || logMap.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        requests: reqMap.get(m.id) ?? 0,
        logs: logMap.get(m.id) ?? 0,
      }))
      .filter((m) => m.requests > 0 || m.logs > 0)
  );
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

/* ---------- Yuklama: davr solishtiruvi (kunlik / haftalik / oylik) ---------- */

type Granularity = "day" | "week" | "month";

/** Bucket chegaralari: joriy davr oxirgi bo'ladi */
function buildBuckets(g: Granularity, count: number): { start: Date; end: Date; label: string }[] {
  const now = new Date();
  const dayFmt = new Intl.DateTimeFormat("uz-UZ", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit" });
  const monthFmt = new Intl.DateTimeFormat("uz-UZ", { timeZone: "Asia/Tashkent", month: "short", year: "2-digit" });

  const starts: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    if (g === "day") starts.push(tashkentDayStart(now, i));
    else if (g === "week") starts.push(tashkentWeekStart(now, i));
    else starts.push(tashkentMonthStart(now, i));
  }
  return starts.map((start, i) => {
    const next = starts[i + 1];
    let end: Date;
    if (next) end = next;
    else if (g === "day") end = new Date(tashkentDayStart(now, -1).getTime());
    else if (g === "week") end = new Date(tashkentWeekStart(now, -1).getTime());
    else end = tashkentMonthStart(now, -1);
    return { start, end, label: g === "month" ? monthFmt.format(start) : dayFmt.format(start) };
  });
}

const BUCKET_COUNT: Record<Granularity, number> = { day: 14, week: 12, month: 12 };

interface Totals {
  requests: number;
  logs: number;
  minutes: number;
  recurring: number;
  activeDays: number;
}

const emptyTotals = (): Totals => ({ requests: 0, logs: 0, minutes: 0, recurring: 0, activeDays: 0 });

/**
 * Kunlik / haftalik / oylik ko'rsatkichlar bir joyda:
 * joriy davr, oldingi davr (solishtirish uchun), tarixiy qator va operator kesimi.
 *
 * "Ishlagan kun" — operator hech bo'lmasa bitta yozuv kiritgan kun (Asia/Tashkent).
 * Kunlik o'rtacha shunga bo'linadi: dam olgan kunlar ko'rsatkichni pasaytirmasin.
 */
statsRouter.get("/workload", wrap(async (req, res) => {
  const g: Granularity =
    req.query.granularity === "week" || req.query.granularity === "month"
      ? (req.query.granularity as Granularity)
      : "day";

  const buckets = buildBuckets(g, BUCKET_COUNT[g]);
  const windowStart = buckets[0].start;
  const current = buckets[buckets.length - 1];
  const previous = buckets[buckets.length - 2];

  const [operators, requests, logs] = await Promise.all([
    prisma.operator.findMany({
      where: { status: "APPROVED" },
      select: { id: true, fullName: true, username: true },
    }),
    prisma.request.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { operatorId: true, createdAt: true },
    }),
    prisma.supportLog.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { operatorId: true, createdAt: true, resolveMinutes: true, recurring: true },
    }),
  ]);

  const bucketOf = (at: Date) => {
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (at >= buckets[i].start && at < buckets[i].end) return i;
    }
    return -1;
  };

  const series = buckets.map((b) => ({ label: b.label, requests: 0, logs: 0, minutes: 0 }));
  const inPeriod = (i: number, at: Date) => at >= buckets[i].start && at < buckets[i].end;

  // Operator kesimi: joriy va oldingi davr alohida
  const perOperator = new Map<number, { cur: Totals; prev: Totals; curDays: Set<number>; name: string; username: string | null }>();
  const ensure = (id: number) => {
    if (!perOperator.has(id)) {
      const o = operators.find((x) => x.id === id);
      perOperator.set(id, {
        cur: emptyTotals(),
        prev: emptyTotals(),
        curDays: new Set(),
        name: o?.fullName ?? `#${id}`,
        username: o?.username ?? null,
      });
    }
    return perOperator.get(id)!;
  };
  for (const o of operators) ensure(o.id);

  for (const r of requests) {
    const i = bucketOf(r.createdAt);
    if (i >= 0) series[i].requests++;
    const s = ensure(r.operatorId);
    if (previous && inPeriod(buckets.length - 2, r.createdAt)) s.prev.requests++;
    if (inPeriod(buckets.length - 1, r.createdAt)) {
      s.cur.requests++;
      s.curDays.add(tashkentDayStart(r.createdAt).getTime());
    }
  }
  for (const l of logs) {
    const i = bucketOf(l.createdAt);
    if (i >= 0) {
      series[i].logs++;
      series[i].minutes += l.resolveMinutes;
    }
    const s = ensure(l.operatorId);
    if (previous && inPeriod(buckets.length - 2, l.createdAt)) {
      s.prev.logs++;
      s.prev.minutes += l.resolveMinutes;
    }
    if (inPeriod(buckets.length - 1, l.createdAt)) {
      s.cur.logs++;
      s.cur.minutes += l.resolveMinutes;
      if (l.recurring) s.cur.recurring++;
      s.curDays.add(tashkentDayStart(l.createdAt).getTime());
    }
  }

  const sumOf = (i: number): Totals => ({
    requests: series[i]?.requests ?? 0,
    logs: series[i]?.logs ?? 0,
    minutes: series[i]?.minutes ?? 0,
    recurring: 0,
    activeDays: 0,
  });

  const curTotals = sumOf(buckets.length - 1);
  const prevTotals = sumOf(buckets.length - 2);
  // Jamoa bo'yicha ishlagan kunlar — operatorlarnikining birlashmasi emas, kunlar soni
  const allCurDays = new Set<number>();
  for (const s of perOperator.values()) for (const d of s.curDays) allCurDays.add(d);
  curTotals.activeDays = allCurDays.size;

  res.json({
    granularity: g,
    currentLabel: current.label,
    previousLabel: previous?.label ?? null,
    current: curTotals,
    previous: prevTotals,
    series,
    operators: [...perOperator.entries()]
      .map(([id, s]) => ({
        id,
        fullName: s.name,
        username: s.username,
        requests: s.cur.requests,
        logs: s.cur.logs,
        minutes: s.cur.minutes,
        recurring: s.cur.recurring,
        activeDays: s.curDays.size,
        avgMinutesPerDay: s.curDays.size > 0 ? Math.round(s.cur.minutes / s.curDays.size) : 0,
        avgLogMinutes: s.cur.logs > 0 ? Math.round(s.cur.minutes / s.cur.logs) : 0,
        prevRequests: s.prev.requests,
        prevLogs: s.prev.logs,
        prevMinutes: s.prev.minutes,
      }))
      .sort((a, b) => b.requests + b.logs - (a.requests + a.logs) || b.minutes - a.minutes),
  });
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
