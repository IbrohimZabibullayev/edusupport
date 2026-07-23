import { StorageAdapter } from "grammy";
import { prisma } from "../db";

/** grammY sessiyalarini PostgreSQL'da saqlaydi — server restart bo'lsa ham wizard holati yo'qolmaydi */
export class PrismaStorage<T> implements StorageAdapter<T> {
  async read(key: string): Promise<T | undefined> {
    const row = await prisma.botSession.findUnique({ where: { key } });
    return row ? (JSON.parse(row.value) as T) : undefined;
  }

  async write(key: string, value: T): Promise<void> {
    const data = JSON.stringify(value);
    await prisma.botSession.upsert({
      where: { key },
      create: { key, value: data },
      update: { value: data },
    });
  }

  async delete(key: string): Promise<void> {
    await prisma.botSession.deleteMany({ where: { key } });
  }
}
