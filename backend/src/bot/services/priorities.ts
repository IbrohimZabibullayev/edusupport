import { Priority } from "@prisma/client";
import { prisma } from "../../db";

export function getActivePriorities(): Promise<Priority[]> {
  return prisma.priority.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}
