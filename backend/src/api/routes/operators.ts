import { OperatorStatus } from "@prisma/client";
import { Router } from "express";
import { bot } from "../../bot/bot";
import { mainMenu } from "../../bot/keyboards";
import { prisma } from "../../db";
import { wrap } from "../middleware/wrap";

export const operatorsRouter = Router();

operatorsRouter.get("/", wrap(async (_req, res) => {
  const operators = await prisma.operator.findMany({
    include: { _count: { select: { requests: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    operators.map((o) => ({
      id: o.id,
      fullName: o.fullName,
      phone: o.phone,
      username: o.username,
      status: o.status,
      isAdmin: o.isAdmin,
      requestsCount: o._count.requests,
      createdAt: o.createdAt,
    }))
  );
}));

const STATUS_MESSAGES: Partial<Record<OperatorStatus, string>> = {
  APPROVED: "🎉 Tabriklaymiz! Admin sizni tasdiqladi. Endi so'rov kiritishingiz mumkin.",
  REJECTED: "❌ Afsuski, so'rovingiz rad etildi.",
  BLOCKED: "🚫 Sizning akkauntingiz bloklandi.",
};

operatorsRouter.patch("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body ?? {};
  const allowed: OperatorStatus[] = ["APPROVED", "REJECTED", "BLOCKED", "PENDING"];
  if (isNaN(id) || !allowed.includes(status)) {
    res.status(400).json({ error: "Noto'g'ri so'rov: status APPROVED/REJECTED/BLOCKED/PENDING bo'lishi kerak" });
    return;
  }

  const existing = await prisma.operator.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Operator topilmadi" });
    return;
  }

  const operator = await prisma.operator.update({ where: { id }, data: { status } });

  // Statusi o'zgargan operatorga bot orqali xabar beramiz (xato bo'lsa ham API muvaffaqiyatli qaytadi)
  const message = STATUS_MESSAGES[status as OperatorStatus];
  if (message && existing.status !== status) {
    try {
      await bot.api.sendMessage(operator.telegramId, message, {
        reply_markup: status === "APPROVED" ? mainMenu : undefined,
      });
    } catch (err) {
      console.error("Operatorga status xabari yuborilmadi:", err);
    }
  }

  res.json({ id: operator.id, status: operator.status });
}));
