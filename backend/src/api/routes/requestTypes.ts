import { Router } from "express";
import { prisma } from "../../db";
import { invalidateTopicKeywordCache } from "../../bot/services/topics";
import { wrap } from "../middleware/wrap";

export const requestTypesRouter = Router();

/** Nomdan barqaror key hosil qiladi (lotin harflari; bo'sh bo'lsa TYPE) */
function slugKey(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "TYPE";
}

async function uniqueKey(name: string): Promise<string> {
  const base = slugKey(name);
  let key = base;
  let n = 2;
  while (await prisma.requestType.findUnique({ where: { key } })) {
    key = `${base}_${n++}`;
  }
  return key;
}

requestTypesRouter.get("/", wrap(async (_req, res) => {
  const [types, counts] = await Promise.all([
    prisma.requestType.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.request.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);
  const countMap = new Map(counts.map((c) => [c.type, c._count._all]));
  res.json(
    types.map((t) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      emoji: t.emoji,
      color: t.color,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
      requestsCount: countMap.get(t.key) ?? 0,
    }))
  );
}));

requestTypesRouter.post("/", wrap(async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const emoji = typeof req.body?.emoji === "string" ? req.body.emoji.trim() : "";
  const color = typeof req.body?.color === "string" ? req.body.color.trim() : "#2a78d6";
  if (name.length < 2) {
    res.status(400).json({ error: "Tur nomi kamida 2 belgidan iborat bo'lishi kerak" });
    return;
  }
  const duplicate = await prisma.requestType.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (duplicate) {
    res.status(409).json({ error: "Bu nomdagi tur allaqachon mavjud" });
    return;
  }
  const [key, maxOrder] = await Promise.all([
    uniqueKey(name),
    prisma.requestType.aggregate({ _max: { sortOrder: true } }),
  ]);
  const type = await prisma.requestType.create({
    data: { key, name, emoji, color, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  res.status(201).json({
    id: type.id,
    key: type.key,
    name: type.name,
    emoji: type.emoji,
    color: type.color,
    isActive: type.isActive,
    sortOrder: type.sortOrder,
    requestsCount: 0,
  });
}));

requestTypesRouter.patch("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }

  const body = req.body ?? {};
  const data: { name?: string; emoji?: string; color?: string; isActive?: boolean; sortOrder?: number } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2) {
      res.status(400).json({ error: "Tur nomi kamida 2 belgidan iborat bo'lishi kerak" });
      return;
    }
    const duplicate = await prisma.requestType.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
    });
    if (duplicate) {
      res.status(409).json({ error: "Bu nomdagi tur allaqachon mavjud" });
      return;
    }
    data.name = name;
  }
  if (body.emoji !== undefined && typeof body.emoji === "string") data.emoji = body.emoji.trim();
  if (body.color !== undefined && typeof body.color === "string") data.color = body.color.trim();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.sortOrder !== undefined && !isNaN(Number(body.sortOrder))) data.sortOrder = Number(body.sortOrder);

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "O'zgartirish uchun maydon berilmagan" });
    return;
  }

  try {
    const type = await prisma.requestType.update({ where: { id }, data });
    res.json({
      id: type.id,
      key: type.key,
      name: type.name,
      emoji: type.emoji,
      color: type.color,
      isActive: type.isActive,
      sortOrder: type.sortOrder,
    });
  } catch {
    res.status(404).json({ error: "Tur topilmadi" });
  }
}));

requestTypesRouter.delete("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const type = await prisma.requestType.findUnique({ where: { id } });
  if (!type) {
    res.status(404).json({ error: "Tur topilmadi" });
    return;
  }
  const used = await prisma.request.count({ where: { type: type.key } });
  if (used > 0) {
    res.status(409).json({
      error: `Bu turda ${used} ta so'rov bor — o'chirib bo'lmaydi. Buning o'rniga uni faolsizlantiring.`,
    });
    return;
  }
  // Turga bog'liq bo'lim biriktirmalari va kalit so'zlarni ham tozalaymiz
  await prisma.$transaction([
    prisma.groupTopic.deleteMany({ where: { type: type.key } }),
    prisma.topicKeyword.deleteMany({ where: { type: type.key } }),
    prisma.requestType.delete({ where: { id } }),
  ]);
  invalidateTopicKeywordCache();
  res.json({ ok: true });
}));
