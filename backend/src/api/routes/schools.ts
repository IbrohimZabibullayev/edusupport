import { Router } from "express";
import { prisma } from "../../db";
import { wrap } from "../middleware/wrap";

export const schoolsRouter = Router();

schoolsRouter.get("/", wrap(async (_req, res) => {
  const schools = await prisma.school.findMany({
    include: { _count: { select: { requests: true } } },
    orderBy: { name: "asc" },
  });
  res.json(
    schools.map((s) => ({
      id: s.id,
      name: s.name,
      requestsCount: s._count.requests,
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
