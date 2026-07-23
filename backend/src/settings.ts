import { config } from "./config";
import { prisma } from "./db";

export const SETTING_DEV_GROUP = "devGroupId";
export const SETTING_BACKLOG_CHAT = "backlogChatId";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Bazadagi qiymat ustuvor, bo'lmasa .env dagi zaxira qiymat */
export async function getDevGroupId(): Promise<string> {
  return (await getSetting(SETTING_DEV_GROUP)) ?? config.devGroupId;
}

export async function getBacklogChatId(): Promise<string> {
  return (await getSetting(SETTING_BACKLOG_CHAT)) ?? config.backlogChatId;
}
