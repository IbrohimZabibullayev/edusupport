import { Router } from "express";
import { prisma } from "../../db";
import { wrap } from "../middleware/wrap";

export const modulesRouter = Router();

modulesRouter.get("/", wrap(async (_req, res) => {
  const modules = await prisma.module.findMany({
    include: { _count: { select: { requests: true } } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  res.json(
    modules.map((m) => ({
      id: m.id,
      name: m.name,
      emoji: m.emoji,
      isActive: m.isActive,
      sortOrder: m.sortOrder,
      requestsCount: m._count.requests,
      createdAt: m.createdAt,
    }))
  );
}));

modulesRouter.post("/", wrap(async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const emoji = typeof req.body?.emoji === "string" ? req.body.emoji.trim() : "";
  if (name.length < 2) {
    res.status(400).json({ error: "Modul nomi kamida 2 belgidan iborat bo'lishi kerak" });
    return;
  }
  const existing = await prisma.module.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    res.status(409).json({ error: "Bu nomdagi modul allaqachon mavjud" });
    return;
  }
  const maxOrder = await prisma.module.aggregate({ _max: { sortOrder: true } });
  const module = await prisma.module.create({
    data: { name, emoji, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  res.status(201).json({
    id: module.id,
    name: module.name,
    emoji: module.emoji,
    isActive: module.isActive,
    sortOrder: module.sortOrder,
    requestsCount: 0,
    createdAt: module.createdAt,
  });
}));

modulesRouter.patch("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }

  const body = req.body ?? {};
  const data: { name?: string; emoji?: string; isActive?: boolean; sortOrder?: number } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2) {
      res.status(400).json({ error: "Modul nomi kamida 2 belgidan iborat bo'lishi kerak" });
      return;
    }
    const duplicate = await prisma.module.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
    });
    if (duplicate) {
      res.status(409).json({ error: "Bu nomdagi modul allaqachon mavjud" });
      return;
    }
    data.name = name;
  }
  if (body.emoji !== undefined && typeof body.emoji === "string") data.emoji = body.emoji.trim();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.sortOrder !== undefined && !isNaN(Number(body.sortOrder))) data.sortOrder = Number(body.sortOrder);

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "O'zgartirish uchun maydon berilmagan" });
    return;
  }

  try {
    const module = await prisma.module.update({ where: { id }, data });
    res.json({
      id: module.id,
      name: module.name,
      emoji: module.emoji,
      isActive: module.isActive,
      sortOrder: module.sortOrder,
    });
  } catch {
    res.status(404).json({ error: "Modul topilmadi" });
  }
}));
