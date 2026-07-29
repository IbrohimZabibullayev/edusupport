import { Router } from "express";
import { prisma } from "../../db";
import { duplicateGroups, normalizeSchool } from "../../bot/services/schools";
import { wrap } from "../middleware/wrap";

export const schoolsRouter = Router();

/** O'xshash nomli maktablar guruhlari — birlashtirish taklifi uchun */
schoolsRouter.get("/duplicates", wrap(async (_req, res) => {
  const schools = await prisma.school.findMany({
    include: { _count: { select: { requests: true, supportLogs: true } } },
  });
  const groups = duplicateGroups(schools).map((g) =>
    g
      .map((s) => {
        const full = schools.find((x) => x.id === s.id)!;
        return {
          id: s.id,
          name: s.name,
          requestsCount: full._count.requests,
          logsCount: full._count.supportLogs,
        };
      })
      // Ko'p ma'lumotga ega yozuv birinchi — odatda shunisi saqlanadi
      .sort((a, b) => b.requestsCount + b.logsCount - (a.requestsCount + a.logsCount))
  );
  res.json(groups);
}));

/** Dublikatlarni birlashtiradi: hamma so'rov/log/mijoz xotirasi targetId ga ko'chiriladi */
schoolsRouter.post("/merge", wrap(async (req, res) => {
  const targetId = Number(req.body?.targetId);
  const sourceIds = Array.isArray(req.body?.sourceIds) ? req.body.sourceIds.map(Number) : [];
  const sources = sourceIds.filter((id: number) => Number.isInteger(id) && id !== targetId);

  if (!Number.isInteger(targetId) || sources.length === 0) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const target = await prisma.school.findUnique({ where: { id: targetId } });
  if (!target) {
    res.status(404).json({ error: "Asosiy maktab topilmadi" });
    return;
  }

  const [requests, logs] = await Promise.all([
    prisma.request.count({ where: { schoolId: { in: sources } } }),
    prisma.supportLog.count({ where: { schoolId: { in: sources } } }),
  ]);

  await prisma.$transaction([
    prisma.request.updateMany({ where: { schoolId: { in: sources } }, data: { schoolId: targetId } }),
    prisma.supportLog.updateMany({ where: { schoolId: { in: sources } }, data: { schoolId: targetId } }),
    prisma.clientSource.updateMany({ where: { schoolId: { in: sources } }, data: { schoolId: targetId } }),
    prisma.school.deleteMany({ where: { id: { in: sources } } }),
  ]);

  res.json({ ok: true, merged: sources.length, movedRequests: requests, movedLogs: logs });
}));

schoolsRouter.get("/", wrap(async (_req, res) => {
  const schools = await prisma.school.findMany({
    include: { _count: { select: { requests: true, supportLogs: true } } },
    orderBy: { name: "asc" },
  });
  res.json(
    schools.map((s) => ({
      id: s.id,
      name: s.name,
      requestsCount: s._count.requests,
      logsCount: s._count.supportLogs,
      createdAt: s.createdAt,
    }))
  );
}));

schoolsRouter.post("/", wrap(async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (name.length < 3) {
    res.status(400).json({ error: "Maktab nomi kamida 3 belgidan iborat bo'lishi kerak" });
    return;
  }
  const existing = await prisma.school.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    res.status(409).json({ error: "Bu nomdagi maktab allaqachon mavjud" });
    return;
  }
  const school = await prisma.school.create({ data: { name, nameKey: normalizeSchool(name) } });
  res.status(201).json({ id: school.id, name: school.name, requestsCount: 0, createdAt: school.createdAt });
}));

schoolsRouter.patch("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (isNaN(id) || name.length < 3) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const duplicate = await prisma.school.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
  });
  if (duplicate) {
    res.status(409).json({ error: "Bu nomdagi maktab allaqachon mavjud" });
    return;
  }
  try {
    const school = await prisma.school.update({ where: { id }, data: { name, nameKey: normalizeSchool(name) } });
    res.json({ id: school.id, name: school.name });
  } catch {
    res.status(404).json({ error: "Maktab topilmadi" });
  }
}));

schoolsRouter.delete("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const school = await prisma.school.findUnique({ where: { id } });
  if (!school) {
    res.status(404).json({ error: "Maktab topilmadi" });
    return;
  }
  // Maktabga bog'liq so'rovlar (va ularning biriktirmalari) hamda support loglar ham o'chiriladi
  const reqIds = (await prisma.request.findMany({ where: { schoolId: id }, select: { id: true } })).map((r) => r.id);
  await prisma.$transaction([
    prisma.requestAttachment.deleteMany({ where: { requestId: { in: reqIds } } }),
    prisma.request.deleteMany({ where: { schoolId: id } }),
    prisma.supportLog.deleteMany({ where: { schoolId: id } }),
    prisma.school.delete({ where: { id } }),
  ]);
  res.json({ ok: true, deletedRequests: reqIds.length });
}));
