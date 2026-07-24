import { Router } from "express";
import { prisma } from "../../db";
import { wrap } from "../middleware/wrap";

export const prioritiesRouter = Router();

function slugKey(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "P";
}

async function uniqueKey(name: string): Promise<string> {
  const base = slugKey(name);
  let key = base;
  let n = 2;
  while (await prisma.priority.findUnique({ where: { key } })) {
    key = `${base}_${n++}`;
  }
  return key;
}

prioritiesRouter.get("/", wrap(async (_req, res) => {
  const [rows, counts] = await Promise.all([
    prisma.priority.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.supportLog.groupBy({ by: ["priorityId"], _count: { _all: true } }),
  ]);
  const countMap = new Map(counts.map((c) => [c.priorityId, c._count._all]));
  res.json(
    rows.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      color: p.color,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      logsCount: countMap.get(p.id) ?? 0,
    }))
  );
}));

prioritiesRouter.post("/", wrap(async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const color = typeof req.body?.color === "string" ? req.body.color.trim() : "#eb6834";
  if (name.length < 2) {
    res.status(400).json({ error: "Prioritet nomi kamida 2 belgidan iborat bo'lishi kerak" });
    return;
  }
  const duplicate = await prisma.priority.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (duplicate) {
    res.status(409).json({ error: "Bu nomdagi prioritet allaqachon mavjud" });
    return;
  }
  const [key, maxOrder] = await Promise.all([
    uniqueKey(name),
    prisma.priority.aggregate({ _max: { sortOrder: true } }),
  ]);
  const p = await prisma.priority.create({
    data: { key, name, color, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  res.status(201).json({ id: p.id, key: p.key, name: p.name, color: p.color, isActive: p.isActive, sortOrder: p.sortOrder, logsCount: 0 });
}));

prioritiesRouter.patch("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const body = req.body ?? {};
  const data: { name?: string; color?: string; isActive?: boolean; sortOrder?: number } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2) {
      res.status(400).json({ error: "Prioritet nomi kamida 2 belgidan iborat bo'lishi kerak" });
      return;
    }
    const duplicate = await prisma.priority.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
    });
    if (duplicate) {
      res.status(409).json({ error: "Bu nomdagi prioritet allaqachon mavjud" });
      return;
    }
    data.name = name;
  }
  if (body.color !== undefined && typeof body.color === "string") data.color = body.color.trim();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.sortOrder !== undefined && !isNaN(Number(body.sortOrder))) data.sortOrder = Number(body.sortOrder);

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "O'zgartirish uchun maydon berilmagan" });
    return;
  }

  try {
    const p = await prisma.priority.update({ where: { id }, data });
    res.json({ id: p.id, key: p.key, name: p.name, color: p.color, isActive: p.isActive, sortOrder: p.sortOrder });
  } catch {
    res.status(404).json({ error: "Prioritet topilmadi" });
  }
}));

prioritiesRouter.delete("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const used = await prisma.supportLog.count({ where: { priorityId: id } });
  if (used > 0) {
    res.status(409).json({ error: `Bu prioritetda ${used} ta log bor — o'chirib bo'lmaydi. Faolsizlantiring.` });
    return;
  }
  try {
    await prisma.priority.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Prioritet topilmadi" });
  }
}));
