import { System } from "@prisma/client";
import { prisma } from "../../db";

export function getActiveSystems(): Promise<System[]> {
  return prisma.system.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}
