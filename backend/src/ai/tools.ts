import { Operator } from "@prisma/client";
import { Api } from "grammy";
import { prisma } from "../db";
import {
  formatMinutes,
  formatTashkentDate,
  formatTashkentTime,
  parseWhenTashkent,
  tashkentDayStart,
  tashkentMonthStart,
  tashkentWeekStart,
  ticketId,
} from "../util";
import { createRequestFromDraft } from "../bot/services/createRequest";
import { getActiveModules } from "../bot/services/modules";
import { getActiveRequestTypes } from "../bot/services/requestTypes";
import { createSchool, schoolCandidates } from "../bot/services/schools";
import { getActiveSystems } from "../bot/services/systems";
import { getDevGroupId } from "../settings";
import { DraftAttachment } from "../bot/types";

/**
 * Assistent chaqira oladigan amallar.
 *
 * Muhim qoida: nomlar (maktab, modul, tizim) matn ko'rinishida keladi va
 * shu yerda bazaga solishtiriladi. Nom aniq bo'lmasa amal bajarilmaydi —
 * o'rniga "aniqlashtirish kerak" javobi qaytadi va assistent foydalanuvchidan
 * so'raydi. Shu tufayli maktab dublikatlari AI orqali ham ochilib ketmaydi.
 */

/**
 * Tasdiq kutayotgan so'rov. Assistent so'rovni o'zi guruhga yubormaydi —
 * avval shu qoralamani tayyorlaydi, operator tugmani bosgandan keyingina
 * haqiqiy so'rov yaratiladi va guruhga ketadi.
 */
export interface PendingRequest {
  kind: "request";
  schoolId: number;
  schoolName: string;
  moduleId: number;
  moduleName: string;
  systemId?: number;
  systemName?: string;
  type: string;
  typeLabel: string;
  description: string;
  attachments: DraftAttachment[];
}

/**
 * Tasdiq kutayotgan xabar. Odamlarga va guruhga yozish — orqaga qaytmaydigan
 * amal, shuning uchun so'rov kabi avval ko'rsatiladi va tugma bilan yuboriladi.
 */
export interface PendingMessage {
  kind: "message";
  targets: { chatId: string; label: string }[];
  text: string;
}

export type Pending = PendingRequest | PendingMessage;

export interface ToolContext {
  api: Api;
  operator: Operator;
  /** Forward qilingan/yuborilgan fayllar — so'rovga biriktiriladi */
  attachments: DraftAttachment[];
  /** Assistent yaratgan so'rovlar — javobda ko'rsatish uchun */
  created: string[];
  /**
   * Tasdiq kutayotgan amallar. Bitta navbatda model bir necha marta amal
   * chaqirishi mumkin (masalan uch xodimga uchta xabar) — shuning uchun ro'yxat.
   * Ilgari bitta maydon edi va har yangisi eskisini o'chirib yuborardi.
   */
  pendings: Pending[];
}

type ToolResult = Record<string, unknown>;

export const AI_TOOLS = [
  {
    name: "create_request",
    description:
      "Dasturchilar guruhiga yuboriladigan so'rovni TAYYORLAYDI (hali yubormaydi). " +
      "Operator hal qilinmagan muammo yoki taklifni aytganda ishlatiladi. " +
      "Tayyorlangach bot operatorga ko'rsatib tasdiq so'raydi va faqat o'shandan keyin yuboradi — " +
      "shuning uchun sen 'yubordim' dema, 'tayyorladim, tasdiqlang' de. " +
      "Maktab nomi majburiy; tizim/modul/tur aytilmagan bo'lsa matndan taxmin qil.",
    input_schema: {
      type: "object" as const,
      properties: {
        school: { type: "string", description: "Maktab/o'quv markazi nomi, foydalanuvchi yozganidek" },
        description: {
          type: "string",
          description:
            "Muammoning XULOSASI — dasturchi o'qib darrov tushunadigan qilib. Forward qilingan bir necha xabar " +
            "bo'lsa hammasini birlashtirib bitta aniq bayon yoz. Raqam, sana, telefon, ID kabi aniq " +
            "ma'lumotlarni aynan ko'chir — ular dasturchiga kerak.",
        },
        client_message: {
          type: "string",
          description:
            "Mijozning ASL matni (forward qilingan bo'lsa). O'zgartirmasdan ko'chir — kartada xulosadan " +
            "keyin alohida ko'rsatiladi. Mijoz xabari bo'lmasa tashlab ket.",
        },
        system: { type: "string", description: "Tizim nomi (masalan Edu Tizim yoki EduSchool). Bilmasang tashlab ket." },
        module: { type: "string", description: "Modul nomi (Moliya, Jurnal, Lidlar...). Bilmasang tashlab ket." },
        type: { type: "string", description: "So'rov turi kaliti: BUG, SUGGESTION yoki ISSUE. Bilmasang tashlab ket." },
        create_school: {
          type: "boolean",
          description: "Faqat foydalanuvchi yangi maktab ochishga rozi bo'lgandan keyin true qil.",
        },
        school_id: { type: "number", description: "Aniqlashtirishdan keyin tanlangan maktab ID si." },
      },
      required: ["school", "description"],
    },
  },
  {
    name: "create_support_log",
    description: "Support log yozadi — operator o'zi hal qilgan murojaatni qayd etadi (guruhga yuborilmaydi).",
    input_schema: {
      type: "object" as const,
      properties: {
        school: { type: "string", description: "Maktab nomi" },
        module: { type: "string", description: "Modul nomi" },
        problem: { type: "string", description: "Muammo va yechim tavsifi" },
        minutes: {
          type: "number",
          description: "Ketgan vaqt (daqiqada). Operator aytmagan bo'lsa TAXMIN QILMA — bo'sh qoldir, bot so'ratadi.",
        },
        system: { type: "string", description: "Tizim nomi, bilinsa" },
        recurring: {
          type: "boolean",
          description: "Takroriy murojaatmi. Operator aytmagan bo'lsa bo'sh qoldir — bot so'ratadi.",
        },
        school_id: { type: "number", description: "Aniqlashtirishdan keyin tanlangan maktab ID si" },
        create_school: { type: "boolean", description: "Yangi maktab ochishga ruxsat berilgan bo'lsa true" },
      },
      required: ["school", "module", "problem", "minutes"],
    },
  },
  {
    name: "create_task",
    description:
      "Shaxsiy reja/vazifa qo'yadi va vaqtidan oldin eslatma yuboradi. " +
      "Boshqa xodimga topshiriq berish uchun for_person ni to'ldir.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Nima qilish kerak" },
        when: {
          type: "string",
          description: "Vaqt: '14:30', 'ertaga 9:00', 'indinga 11:15', '05.08 15:00' ko'rinishida",
        },
        with_whom: { type: "string", description: "Kim bilan (meeting bo'lsa)" },
        remind_minutes: { type: "number", description: "Necha daqiqa oldin eslatilsin (standart 5)" },
        for_person: { type: "string", description: "Boshqa operator ismi — unga topshiriq berilsa" },
      },
      required: ["title", "when"],
    },
  },
  {
    name: "list_tasks",
    description:
      "SHAXSIY eslatmalar ro'yxati (meeting, qo'ng'iroq — operator o'ziga qo'ygan). " +
      "Bu dasturchilarga yuborilgan so'rovlar EMAS — ular uchun list_requests ishlatiladi. " +
      "Operator «vazifa/task» desa ko'pincha bajarilmagan so'rovlarni nazarda tutadi, shuning uchun " +
      "bu ro'yxat bo'sh chiqsa list_requests ni ham tekshir.",
    input_schema: {
      type: "object" as const,
      properties: {
        filter: { type: "string", description: "open (bajarilmagan), done (bajarilgan), all", enum: ["open", "done", "all"] },
        person: { type: "string", description: "Operator ismi. Bo'sh bo'lsa — so'rayotgan odamning o'ziniki." },
        everyone: { type: "boolean", description: "Hamma operatorlar bo'yicha umumiy hisobot kerak bo'lsa true" },
      },
      required: [],
    },
  },
  {
    name: "finish_task",
    description: "Vazifani bajarildi deb belgilaydi.",
    input_schema: {
      type: "object" as const,
      properties: { task_id: { type: "number", description: "list_tasks bergan ID" } },
      required: ["task_id"],
    },
  },
  {
    name: "list_requests",
    description: "So'rovlar holati: bajarilmagan/bajarilgan so'rovlar, kim ustida ishlayotgani.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "open yoki done", enum: ["open", "done"] },
        school: { type: "string", description: "Faqat shu maktabniki" },
        period: { type: "string", description: "today, week, month yoki all", enum: ["today", "week", "month", "all"] },
      },
      required: [],
    },
  },
  {
    name: "send_message",
    description:
      "Operatorlarga shaxsiy xabar va/yoki dasturchilar guruhiga xabar TAYYORLAYDI (hali yubormaydi). " +
      "Eslatma tarqatish uchun ishlatiladi: «falon tasklaringiz qolib ketti» kabi. " +
      "Bot operatorga ko'rsatib tasdiq so'raydi, faqat o'shandan keyin yuboriladi — «yubordim» dema. " +
      "Har kimga o'ziga tegishli ma'lumot kerak bo'lsa (masalan har birining o'z ticketlari), " +
      "har bir odam uchun alohida chaqir.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Yuboriladigan xabar matni — tayyor ko'rinishda" },
        to_operators: {
          type: "array",
          items: { type: "string" },
          description: "Kimga: operator ismlari. Bitta odamga bo'lsa bitta ism.",
        },
        to_all_operators: { type: "boolean", description: "Hamma operatorlarga (faqat admin qila oladi)" },
        to_group: { type: "boolean", description: "Dasturchilar guruhiga yozilsinmi" },
        system: { type: "string", description: "to_group bilan: qaysi tizim guruhi. Bo'sh bo'lsa umumiy guruh." },
      },
      required: ["text"],
    },
  },
  {
    name: "stats",
    description: "Raqamli hisobot: davr bo'yicha nechta so'rov, nechta support log, qancha vaqt ketgani.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: { type: "string", description: "today, week yoki month", enum: ["today", "week", "month"] },
        person: { type: "string", description: "Bitta operator bo'yicha kerak bo'lsa ismi" },
      },
      required: [],
    },
  },
];

/* ---------- Nomlarni bazaga solishtirish ---------- */

/** Maktabni nomdan topadi; aniq bo'lmasa aniqlashtirish talab qiladi */
async function resolveSchool(
  input: { school: string; school_id?: number; create_school?: boolean },
  op: Operator
): Promise<{ id: number } | { needs_clarification: string; message: string; options?: unknown }> {
  if (input.school_id) {
    const s = await prisma.school.findUnique({ where: { id: input.school_id } });
    if (s) return { id: s.id };
  }
  const found = await schoolCandidates(input.school);
  if (found.length === 1) return { id: found[0].id };
  if (found.length > 1) {
    return {
      needs_clarification: "school",
      message: `"${input.school}" uchun bir nechta variant bor. Foydalanuvchidan qaysi biri ekanini so'ra.`,
      options: found.map((s) => ({ id: s.id, name: s.name })),
    };
  }
  if (input.create_school) {
    const s = await createSchool(input.school, op.id);
    return { id: s.id };
  }
  return {
    needs_clarification: "school_new",
    message:
      `"${input.school}" bazada topilmadi. Foydalanuvchidan so'ra: yangi maktab qilib qo'shaymi? ` +
      `Rozi bo'lsa create_school=true bilan qayta chaqir.`,
  };
}

function isClarification(r: { id: number } | { needs_clarification: string }): r is { needs_clarification: string } {
  return "needs_clarification" in r;
}

/** Nomi bo'yicha eng mos yozuvni topadi (modul, tizim, tur) */
function pickByName<T extends { name: string }>(items: T[], name?: string): T | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return (
    items.find((i) => i.name.toLowerCase() === n) ??
    items.find((i) => i.name.toLowerCase().includes(n) || n.includes(i.name.toLowerCase()))
  );
}

async function findOperator(name: string): Promise<Operator | null> {
  const all = await prisma.operator.findMany({ where: { status: "APPROVED" } });
  const n = name.trim().toLowerCase();
  return (
    all.find((o) => o.fullName.toLowerCase() === n) ??
    all.find((o) => o.fullName.toLowerCase().includes(n)) ??
    all.find((o) => n.includes(o.fullName.toLowerCase().split(" ")[0])) ??
    null
  );
}

function periodStart(period?: string): Date | undefined {
  const now = new Date();
  if (period === "today") return tashkentDayStart(now, 0);
  if (period === "week") return tashkentWeekStart(now, 0);
  if (period === "month") return tashkentMonthStart(now, 0);
  return undefined;
}

/* ---------- Amallar ---------- */

export async function runTool(name: string, input: any, ctx: ToolContext): Promise<ToolResult> {
  switch (name) {
    case "create_request":
      return createRequest(input, ctx);
    case "create_support_log":
      return createSupportLog(input, ctx);
    case "create_task":
      return createTask(input, ctx);
    case "list_tasks":
      return listTasks(input, ctx);
    case "finish_task":
      return finishTask(input, ctx);
    case "list_requests":
      return listRequests(input);
    case "send_message":
      return prepareMessage(input, ctx);
    case "stats":
      return stats(input);
    default:
      return { error: `Noma'lum amal: ${name}` };
  }
}

/**
 * So'rovni tayyorlaydi, lekin YUBORMAYDI. Guruhga ketishidan oldin operator
 * ko'rib tasdiqlashi kerak — noto'g'ri tushunilgan xabar darhol dasturchilarga
 * tushib qolmasligi uchun.
 */
async function createRequest(input: any, ctx: ToolContext): Promise<ToolResult> {
  const school = await resolveSchool(input, ctx.operator);
  if (isClarification(school)) return school;

  const [systems, modules, types] = await Promise.all([
    getActiveSystems(),
    getActiveModules(),
    getActiveRequestTypes(),
  ]);

  const mod = pickByName(modules, input.module);
  if (!mod) {
    return {
      needs_clarification: "module",
      message: "Qaysi modul ekani aniq emas — foydalanuvchidan so'ra.",
      options: modules.map((m) => m.name),
    };
  }

  const sys = pickByName(systems, input.system);
  const type = types.find((t) => t.key === String(input.type ?? "").toUpperCase()) ?? types[0];
  const summary = String(input.description ?? "").trim();
  if (summary.length < 5) {
    return { needs_clarification: "description", message: "Muammo tavsifi juda qisqa — batafsilroq so'ra." };
  }
  // Xulosa kartada asosiy matn, mijozning asl xabari esa uning ostida turadi
  const original = String(input.client_message ?? "").trim();
  const description = original && original !== summary ? `${summary}\n\n— Mijoz xabari —\n${original}` : summary;

  const schoolName = (await prisma.school.findUnique({ where: { id: school.id } }))!.name;
  ctx.pendings.push({
    kind: "request",
    schoolId: school.id,
    schoolName,
    moduleId: mod.id,
    moduleName: mod.name,
    systemId: sys?.id,
    systemName: sys?.name,
    type: type.key,
    typeLabel: `${type.emoji} ${type.name}`.trim(),
    description,
    attachments: ctx.attachments,
  });

  return {
    prepared: true,
    school: schoolName,
    module: mod.name,
    system: sys?.name ?? null,
    type: type.key,
    note:
      "So'rov tayyorlandi, lekin HALI YUBORILMADI. Bot operatorga ko'rsatib tasdiq so'raydi. " +
      "Javobingda bir qatorda nima tayyorlaganingni ayt (maktab, modul, tur) va tasdiqlashini so'ra. " +
      "'Yubordim' yoki 'guruhga tushdi' deb YOZMA.",
  };
}

/**
 * Guruh chatini topadi.
 *
 * Guruh ikki joyda sozlangan bo'lishi mumkin: umumiy (Setting.devGroupId) yoki
 * tizimga biriktirilgan (System.groupChatId) — /setgroup da qaysi variant
 * tanlanganiga qarab. Faqat bittasini qarash "guruh sozlanmagan" degan noto'g'ri
 * xulosaga olib kelardi.
 */
async function resolveGroupChat(
  systemName?: string
): Promise<{ chatId: string; label: string } | { needs_clarification: string; message: string; options?: unknown }> {
  const systems = await getActiveSystems();

  if (systemName) {
    const sys = pickByName(systems, systemName);
    if (sys?.groupChatId) return { chatId: sys.groupChatId, label: `${sys.name} guruhi` };
  }

  const dev = await getDevGroupId();
  if (dev) return { chatId: dev, label: "Dasturchilar guruhi" };

  // Umumiy guruh yo'q — tizimlarga biriktirilganlarini qaraymiz
  const withGroup = systems.filter((s) => s.groupChatId);
  if (withGroup.length === 1) {
    return { chatId: withGroup[0].groupChatId!, label: `${withGroup[0].name} guruhi` };
  }
  if (withGroup.length > 1) {
    return {
      needs_clarification: "group",
      message: "Bir nechta guruh bor — foydalanuvchidan qaysi tizim guruhiga yuborishni so'ra.",
      options: withGroup.map((s) => s.name),
    };
  }

  return { needs_clarification: "group", message: "Guruh sozlanmagan — guruh ichida /setgroup yozish kerak." };
}

/**
 * Xabarni tayyorlaydi, lekin YUBORMAYDI. Odamlarga yozish orqaga qaytmaydi,
 * shuning uchun operator ko'rib tugmani bosgandan keyin ketadi.
 */
async function prepareMessage(input: any, ctx: ToolContext): Promise<ToolResult> {
  const text = String(input.text ?? "").trim();
  if (text.length < 3) {
    return { needs_clarification: "text", message: "Xabar matni bo'sh — nima yozilishini so'ra." };
  }

  const targets: { chatId: string; label: string }[] = [];
  const notFound: string[] = [];

  if (input.to_all_operators) {
    if (!ctx.operator.isAdmin) {
      return { error: "Hammaga tarqatishni faqat admin qila oladi. Kerakli odamlarni nomma-nom ayting." };
    }
    const all = await prisma.operator.findMany({ where: { status: "APPROVED" } });
    for (const o of all) targets.push({ chatId: o.telegramId, label: o.fullName });
  }

  for (const name of (input.to_operators ?? []) as string[]) {
    const target = await findOperator(String(name));
    if (!target) {
      notFound.push(String(name));
      continue;
    }
    if (!targets.some((t) => t.chatId === target.telegramId)) {
      targets.push({ chatId: target.telegramId, label: target.fullName });
    }
  }

  if (notFound.length > 0) {
    const all = await prisma.operator.findMany({ where: { status: "APPROVED" }, select: { fullName: true } });
    return {
      needs_clarification: "person",
      message: `Bu xodim(lar) topilmadi: ${notFound.join(", ")}. Foydalanuvchidan aniqlashtir.`,
      options: all.map((o) => o.fullName),
    };
  }

  if (input.to_group) {
    const group = await resolveGroupChat(input.system ? String(input.system) : undefined);
    if ("needs_clarification" in group) return group;
    targets.push(group);
  }

  if (targets.length === 0) {
    return { needs_clarification: "targets", message: "Kimga yuborilishi aniq emas — foydalanuvchidan so'ra." };
  }

  ctx.pendings.push({ kind: "message", targets, text });
  return {
    prepared: true,
    to: targets.map((t) => t.label),
    note:
      "Xabar tayyorlandi, HALI YUBORILMADI. Bot operatorga ko'rsatib tasdiq so'raydi. " +
      "Javobingda kimga yuborilishini ayt va tasdiqlashini so'ra. 'Yubordim' deb YOZMA.",
  };
}

/** Tasdiqdan keyin xabarni haqiqatan yuboradi */
export async function submitPendingMessage(api: Api, pending: PendingMessage) {
  let sent = 0;
  const failed: string[] = [];
  for (const t of pending.targets) {
    try {
      await api.sendMessage(t.chatId, pending.text);
      sent++;
    } catch (err) {
      // Odam botni bloklagan yoki hech qachon /start qilmagan bo'lishi mumkin
      console.error(`Xabar ${t.label} ga yuborilmadi:`, err);
      failed.push(t.label);
    }
  }
  return { sent, failed };
}

/** Tasdiqdan keyin haqiqiy so'rovni yaratadi va guruhga yo'naltiradi */
export async function submitPending(api: Api, op: Operator, pending: PendingRequest) {
  const request = await createRequestFromDraft(api, op, {
    schoolId: pending.schoolId,
    moduleId: pending.moduleId,
    systemId: pending.systemId,
    type: pending.type,
    descTexts: [pending.description],
    attachments: pending.attachments,
  });
  return { ticketNumber: request.ticketNumber, delivery: request.delivery };
}

async function createSupportLog(input: any, ctx: ToolContext): Promise<ToolResult> {
  const school = await resolveSchool(input, ctx.operator);
  if (isClarification(school)) return school;

  const [systems, modules] = await Promise.all([getActiveSystems(), getActiveModules()]);
  const mod = pickByName(modules, input.module);
  if (!mod) {
    return {
      needs_clarification: "module",
      message: "Modul aniqlanmadi. Foydalanuvchidan so'ra.",
      options: modules.map((m) => m.name),
    };
  }
  // Yetishmagan maydonlarni birga so'raymiz — ketma-ket savol bermaslik uchun
  const minutes = Number(input.minutes);
  const missing: string[] = [];
  if (!Number.isFinite(minutes) || minutes <= 0) missing.push("qancha vaqt ketgani");
  if (typeof input.recurring !== "boolean") missing.push("bu takroriy murojaatmi (ha/yo'q)");
  if (missing.length > 0) {
    return {
      needs_clarification: "log_fields",
      missing,
      message:
        `Support log uchun quyidagilar yetishmayapti: ${missing.join(" va ")}. ` +
        "Hammasini BITTA xabarda so'ra, keyin javobini olib qayta chaqir.",
    };
  }

  const log = await prisma.supportLog.create({
    data: {
      schoolId: school.id,
      moduleId: mod.id,
      systemId: pickByName(systems, input.system)?.id ?? null,
      problem: String(input.problem ?? ""),
      resolveMinutes: Math.round(minutes),
      recurring: Boolean(input.recurring),
      operatorId: ctx.operator.id,
    },
    include: { school: true, module: true },
  });

  return {
    ok: true,
    id: log.id,
    school: log.school.name,
    module: log.module.name,
    minutes: log.resolveMinutes,
    spent: formatMinutes(log.resolveMinutes),
  };
}

async function createTask(input: any, ctx: ToolContext): Promise<ToolResult> {
  const due = parseWhenTashkent(String(input.when ?? ""));
  if (!due) {
    return {
      needs_clarification: "when",
      message: "Vaqtni tushunmadim. Foydalanuvchidan aniq vaqt so'ra (masalan 14:30 yoki ertaga 9:00).",
    };
  }

  let owner = ctx.operator;
  let assignedByName: string | null = null;
  if (input.for_person) {
    const target = await findOperator(String(input.for_person));
    if (!target) {
      const all = await prisma.operator.findMany({ where: { status: "APPROVED" }, select: { fullName: true } });
      return {
        needs_clarification: "person",
        message: `"${input.for_person}" degan xodim topilmadi. Foydalanuvchidan aniqlashtir.`,
        options: all.map((o) => o.fullName),
      };
    }
    owner = target;
    assignedByName = ctx.operator.fullName;
  }

  const lead = Number(input.remind_minutes);
  const task = await prisma.operatorTask.create({
    data: {
      operatorId: owner.id,
      title: String(input.title ?? ""),
      withWhom: input.with_whom ? String(input.with_whom) : null,
      dueAt: due,
      remindLeadMin: Number.isFinite(lead) && lead > 0 ? Math.round(lead) : 5,
      assignedByName,
    },
  });

  // Topshiriq boshqaga berilgan bo'lsa darhol xabar beramiz
  if (assignedByName) {
    try {
      await ctx.api.sendMessage(
        owner.telegramId,
        [
          `📌 <b>Sizga topshiriq</b> — ${assignedByName}`,
          "",
          `📝 ${task.title}`,
          ...(task.withWhom ? [`👥 ${task.withWhom}`] : []),
          `🕒 ${formatTashkentDate(due)} ${formatTashkentTime(due)}`,
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error("Topshiriq xabari yuborilmadi:", err);
    }
  }

  return {
    ok: true,
    id: task.id,
    title: task.title,
    for: owner.fullName,
    due: `${formatTashkentDate(due)} ${formatTashkentTime(due)}`,
    remind_minutes: task.remindLeadMin,
  };
}

async function listTasks(input: any, ctx: ToolContext): Promise<ToolResult> {
  const where: any = {};
  if (input.everyone) {
    // hamma operatorlar
  } else if (input.person) {
    const target = await findOperator(String(input.person));
    if (!target) return { needs_clarification: "person", message: `"${input.person}" topilmadi.` };
    where.operatorId = target.id;
  } else {
    where.operatorId = ctx.operator.id;
  }

  const filter = String(input.filter ?? "open");
  if (filter === "open") where.done = false;
  if (filter === "done") where.done = true;

  const tasks = await prisma.operatorTask.findMany({
    where,
    include: { operator: { select: { fullName: true } } },
    orderBy: [{ done: "asc" }, { dueAt: "asc" }],
    take: 40,
  });

  const now = new Date();
  // Bo'sh chiqsa — operator so'rovlarni nazarda tutgan bo'lishi mumkin.
  // Xulosa chiqarishdan oldin buni tekshirish kerakligini modelga aytamiz.
  const openRequests = tasks.length === 0 ? await prisma.request.count({ where: { done: false } }) : 0;

  return {
    count: tasks.length,
    overdue: tasks.filter((t) => !t.done && t.dueAt < now).length,
    ...(tasks.length === 0
      ? {
          note:
            `Shaxsiy eslatmalar yo'q. Lekin bazada ${openRequests} ta bajarilmagan SO'ROV bor. ` +
            "Operator ehtimol o'shalarni so'ragan — list_requests bilan tekshirib, javobda ikkalasini ham ayt.",
        }
      : {}),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      with_whom: t.withWhom,
      owner: t.operator.fullName,
      assigned_by: t.assignedByName,
      due: `${formatTashkentDate(t.dueAt)} ${formatTashkentTime(t.dueAt)}`,
      done: t.done,
      overdue: !t.done && t.dueAt < now,
    })),
  };
}

async function finishTask(input: any, ctx: ToolContext): Promise<ToolResult> {
  const task = await prisma.operatorTask.findUnique({ where: { id: Number(input.task_id) } });
  if (!task) return { error: "Task topilmadi" };
  if (task.operatorId !== ctx.operator.id) return { error: "Bu task boshqa xodimniki — yopa olmaysiz." };
  await prisma.operatorTask.update({
    where: { id: task.id },
    data: { done: true, doneAt: new Date() },
  });
  return { ok: true, title: task.title };
}

async function listRequests(input: any): Promise<ToolResult> {
  const where: any = {};
  where.done = String(input.status ?? "open") === "done";
  const from = periodStart(input.period);
  if (from) where.createdAt = { gte: from };
  if (input.school) {
    const found = await schoolCandidates(String(input.school), 1);
    if (found.length === 0) return { count: 0, requests: [], note: "Bunday maktab topilmadi." };
    where.schoolId = found[0].id;
  }

  const requests = await prisma.request.findMany({
    where,
    include: { school: true, module: true, operator: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return {
    count: requests.length,
    requests: requests.map((r) => ({
      ticket: ticketId(r.ticketNumber),
      type: r.type,
      school: r.school.name,
      module: r.module.name,
      operator: r.operator.fullName,
      assignee: r.assigneeName ?? r.assigneeUsername ?? null,
      deadline: r.deadline ? formatTashkentDate(r.deadline) : null,
      done_by: r.doneByName ?? null,
      created: formatTashkentDate(r.createdAt),
    })),
  };
}

async function stats(input: any): Promise<ToolResult> {
  const from = periodStart(input.period) ?? tashkentWeekStart(new Date(), 0);
  const where: any = { createdAt: { gte: from } };

  if (input.person) {
    const target = await findOperator(String(input.person));
    if (!target) return { needs_clarification: "person", message: `"${input.person}" topilmadi.` };
    where.operatorId = target.id;
  }

  const [requests, logs, operators] = await Promise.all([
    prisma.request.groupBy({ by: ["operatorId"], where, _count: { _all: true } }),
    prisma.supportLog.groupBy({ by: ["operatorId"], where, _count: { _all: true }, _sum: { resolveMinutes: true } }),
    prisma.operator.findMany({ where: { status: "APPROVED" }, select: { id: true, fullName: true } }),
  ]);

  const rows = operators
    .map((o) => {
      const r = requests.find((x) => x.operatorId === o.id);
      const l = logs.find((x) => x.operatorId === o.id);
      const minutes = l?._sum.resolveMinutes ?? 0;
      return {
        operator: o.fullName,
        requests: r?._count._all ?? 0,
        logs: l?._count._all ?? 0,
        spent: formatMinutes(minutes),
        minutes,
      };
    })
    .filter((x) => x.requests > 0 || x.logs > 0)
    .sort((a, b) => b.requests + b.logs - (a.requests + a.logs));

  return {
    period: String(input.period ?? "week"),
    from: formatTashkentDate(from),
    total_requests: requests.reduce((s, x) => s + x._count._all, 0),
    total_logs: logs.reduce((s, x) => s + x._count._all, 0),
    total_spent: formatMinutes(logs.reduce((s, x) => s + (x._sum.resolveMinutes ?? 0), 0)),
    by_operator: rows,
  };
}
