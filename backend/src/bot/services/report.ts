import { RequestType } from "@prisma/client";
import { prisma } from "../../db";
import { tashkentWeekStart } from "../../util";
import { TYPE_LABELS } from "../texts";
import { moduleLabel } from "./modules";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function changeLabel(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? "o'zgarishsiz" : "yangi (o'tgan davrda 0 ta)";
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "o'zgarishsiz";
  return pct > 0 ? `+${pct}% 📈` : `${pct}% 📉`;
}

async function buildReport(title: string, from: Date, to: Date, prevFrom: Date, prevTo: Date): Promise<string> {
  const where = { createdAt: { gte: from, lt: to } };

  const [total, prevTotal, byType, byModule, bySchool] = await Promise.all([
    prisma.request.count({ where }),
    prisma.request.count({ where: { createdAt: { gte: prevFrom, lt: prevTo } } }),
    prisma.request.groupBy({ by: ["type"], where, _count: { _all: true } }),
    prisma.request.groupBy({ by: ["moduleId"], where, _count: { _all: true }, orderBy: { _count: { moduleId: "desc" } }, take: 3 }),
    prisma.request.groupBy({ by: ["schoolId"], where, _count: { _all: true }, orderBy: { _count: { schoolId: "desc" } }, take: 3 }),
  ]);

  const typeCount = (t: RequestType) => byType.find((r) => r.type === t)?._count._all ?? 0;

  const [schools, modules] = await Promise.all([
    prisma.school.findMany({ where: { id: { in: bySchool.map((s) => s.schoolId) } } }),
    prisma.module.findMany({ where: { id: { in: byModule.map((m) => m.moduleId) } } }),
  ]);
  const schoolName = (id: number) => schools.find((s) => s.id === id)?.name ?? `#${id}`;
  const moduleName = (id: number) => {
    const m = modules.find((x) => x.id === id);
    return m ? moduleLabel(m) : `#${id}`;
  };

  const lines: string[] = [
    `📊 <b>${title}</b>`,
    `🗓 ${formatDate(from)} — ${formatDate(new Date(to.getTime() - DAY_MS))}`,
    "",
    `Jami so'rovlar: <b>${total}</b> (${changeLabel(total, prevTotal)})`,
    "",
    "<b>Turlari bo'yicha:</b>",
    ...(Object.keys(TYPE_LABELS) as RequestType[]).map((t) => `${TYPE_LABELS[t]}: ${typeCount(t)}`),
  ];

  if (byModule.length > 0) {
    lines.push("", "<b>Top-3 modul:</b>");
    byModule.forEach((m, i) => lines.push(`${i + 1}. ${moduleName(m.moduleId)} — ${m._count._all}`));
  }

  if (bySchool.length > 0) {
    lines.push("", "<b>Top-3 maktab:</b>");
    bySchool.forEach((s, i) => lines.push(`${i + 1}. ${schoolName(s.schoolId)} — ${s._count._all}`));
  }

  return lines.join("\n");
}

/** Dushanba yuboriladigan hisobot: o'tgan to'liq hafta (du–yak) vs undan avvalgi hafta */
export function buildWeeklyReport(now = new Date()): Promise<string> {
  const thisWeek = tashkentWeekStart(now);
  const lastWeek = tashkentWeekStart(now, 1);
  const prevWeek = tashkentWeekStart(now, 2);
  return buildReport("Haftalik hisobot", lastWeek, thisWeek, prevWeek, lastWeek);
}

/** /report uchun: so'nggi 7 kun vs undan avvalgi 7 kun */
export function buildOnDemandReport(now = new Date()): Promise<string> {
  const to = now;
  const from = new Date(now.getTime() - 7 * DAY_MS);
  const prevFrom = new Date(now.getTime() - 14 * DAY_MS);
  return buildReport("So'nggi 7 kun hisoboti", from, to, prevFrom, from);
}
