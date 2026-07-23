import { Router } from "express";
import { prisma } from "../../db";
import { wrap } from "../middleware/wrap";

export const systemsRouter = Router();

systemsRouter.get("/", wrap(async (_req, res) => {
  const systems = await prisma.system.findMany({
    include: { _count: { select: { requests: true } } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  res.json(
    systems.map((s) => ({
      id: s.id,
      name: s.name,
      isActive: s.isActive,
      sortOrder: s.sortOrder,
      groupConnected: Boolean(s.groupChatId),
      requestsCount: s._count.requests,
      createdAt: s.createdAt,
    }))
  );
}));

systemsRouter.post("/", wrap(async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (name.length < 2) {
    res.status(400).json({ error: "Tizim nomi kamida 2 belgidan iborat bo'lishi kerak" });
    return;
  }
  const existing = await prisma.system.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    res.status(409).json({ error: "Bu nomdagi tizim allaqachon mavjud" });
    return;
  }
  const maxOrder = await prisma.system.aggregate({ _max: { sortOrder: true } });
  const system = await prisma.system.create({
    data: { name, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  res.status(201).json({
    id: system.id,
    name: system.name,
    isActive: system.isActive,
    sortOrder: system.sortOrder,
    groupConnected: false,
    requestsCount: 0,
    createdAt: system.createdAt,
  });
}));

systemsRouter.patch("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }

  const body = req.body ?? {};
  const data: { name?: string; isActive?: boolean; sortOrder?: number } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2) {
      res.status(400).json({ error: "Tizim nomi kamida 2 belgidan iborat bo'lishi kerak" });
      return;
    }
    const duplicate = await prisma.system.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
    });
    if (duplicate) {
      res.status(409).json({ error: "Bu nomdagi tizim allaqachon mavjud" });
      return;
    }
    data.name = name;
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.sortOrder !== undefined && !isNaN(Number(body.sortOrder))) data.sortOrder = Number(body.sortOrder);

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "O'zgartirish uchun maydon berilmagan" });
    return;
  }

  try {
    const system = await prisma.system.update({ where: { id }, data });
    res.json({ id: system.id, name: system.name, isActive: system.isActive, sortOrder: system.sortOrder });
  } catch {
    res.status(404).json({ error: "Tizim topilmadi" });
  }
}));
