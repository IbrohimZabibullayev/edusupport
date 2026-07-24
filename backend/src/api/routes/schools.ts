import { Router } from "express";
import { prisma } from "../../db";
import { wrap } from "../middleware/wrap";

export const schoolsRouter = Router();

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
  const school = await prisma.school.create({ data: { name } });
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
    const school = await prisma.school.update({ where: { id }, data: { name } });
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
