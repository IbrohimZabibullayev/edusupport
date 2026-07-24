import { Router } from "express";
import { prisma } from "../../db";
import { invalidateTopicKeywordCache } from "../../bot/services/topics";
import { wrap } from "../middleware/wrap";

export const topicKeywordsRouter = Router();

topicKeywordsRouter.get("/", wrap(async (_req, res) => {
  const rows = await prisma.topicKeyword.findMany({
    orderBy: [{ type: "asc" }, { keyword: "asc" }],
  });
  res.json(rows.map((r) => ({ id: r.id, type: r.type, keyword: r.keyword })));
}));

topicKeywordsRouter.post("/", wrap(async (req, res) => {
  const type = typeof req.body?.type === "string" ? req.body.type : "";
  const keyword = typeof req.body?.keyword === "string" ? req.body.keyword.trim().toLowerCase() : "";
  const typeExists = type ? await prisma.requestType.findUnique({ where: { key: type } }) : null;
  if (!typeExists) {
    res.status(400).json({ error: "Noto'g'ri so'rov turi" });
    return;
  }
  if (keyword.length < 2) {
    res.status(400).json({ error: "Kalit so'z kamida 2 belgidan iborat bo'lishi kerak" });
    return;
  }
  const existing = await prisma.topicKeyword.findUnique({
    where: { type_keyword: { type, keyword } },
  });
  if (existing) {
    res.status(409).json({ error: "Bu kalit so'z shu tur uchun allaqachon mavjud" });
    return;
  }
  const row = await prisma.topicKeyword.create({ data: { type, keyword } });
  invalidateTopicKeywordCache();
  res.status(201).json({ id: row.id, type: row.type, keyword: row.keyword });
}));

topicKeywordsRouter.delete("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  try {
    await prisma.topicKeyword.delete({ where: { id } });
    invalidateTopicKeywordCache();
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Kalit so'z topilmadi" });
  }
}));
