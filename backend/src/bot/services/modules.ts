import { Module } from "@prisma/client";
import { prisma } from "../../db";

export function moduleLabel(m: Pick<Module, "name" | "emoji">): string {
  return m.emoji ? `${m.emoji} ${m.name}` : m.name;
}

export function getActiveModules(): Promise<Module[]> {
  return prisma.module.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}
