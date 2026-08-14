import Anthropic from "@anthropic-ai/sdk";
import { Operator } from "@prisma/client";
import { Api } from "grammy";
import { prisma } from "../db";
import { formatTashkentDate, formatTashkentTime } from "../util";
import { getActiveModules } from "../bot/services/modules";
import { getActiveRequestTypes } from "../bot/services/requestTypes";
import { getActiveSystems } from "../bot/services/systems";
import { DraftAttachment } from "../bot/types";
import { AI_EFFORT, AI_MAX_TOKENS, AI_MODEL, aiClient } from "./client";
import { AI_TOOLS, Pending, ToolContext, runTool } from "./tools";

/** Suhbat tarixi sessiyada shu ko'rinishda saqlanadi */
export type AiTurn = Anthropic.MessageParam;

/** Bir zanjirda nechta tool chaqiruvi bo'lishi mumkin — cheksiz aylanmasin */
const MAX_STEPS = 6;

/**
 * Har chaqiruvda o'zgarmaydigan qism — tizimlar, modullar, so'rov turlari va
 * xodimlar ro'yxati. Bularsiz assistent nomlarni taxmin qilishga majbur bo'ladi.
 * Maktablar ro'yxati bu yerga kirmaydi: ular ko'p va o'zgaruvchan, shuning uchun
 * tool ichida solishtiriladi.
 */
async function buildSystemPrompt(op: Operator): Promise<string> {
  const [systems, modules, types, operators] = await Promise.all([
    getActiveSystems(),
    getActiveModules(),
    getActiveRequestTypes(),
    prisma.operator.findMany({ where: { status: "APPROVED" }, select: { fullName: true } }),
  ]);
  const now = new Date();

  return [
    "Sen EduSupport botining yordamchisisan. Ta'lim ERP kompaniyasining qo'llab-quvvatlash operatorlari bilan ishlaysan.",
    "Har doim o'zbek tilida, lotin alifbosida, qisqa va ishchan yozasan. Ortiqcha muqaddima va takrorlash yo'q.",
    "",
    "## Yozish uslubi",
    "Javobing Telegramda oddiy matn bo'lib chiqadi — markdown ishlamaydi.",
    "Jadval, `**qalin**`, `#` sarlavha ISHLATMA — ular yulduzcha va tik chiziq bo'lib ko'rinadi.",
    "Ro'yxat kerak bo'lsa har qatorni «• » bilan boshla. Uzun ro'yxatda eng muhim 10 tasini ber va qolganini son bilan ayt.",
    "",
    "## Vazifang",
    "Operator oddiy xabar yozadi — sen undan kerakli ma'lumotni o'zing ajratib olasan va tegishli amalni bajarasan.",
    "",
    "## Kam gapir — bu eng ko'p shikoyat bo'lgan joy",
    "- Javobing 1-2 qatordan oshmasin. Amal tayyorlansa: nima tayyorlanganini bir qatorda ayt, tamom.",
    "- Nima qilayotganingni, qanday o'ylaganingni, nega shunday qilganingni TUSHUNTIRMA.",
    "- «Aniqlashtirib beray», «Holat:», «Eslatma:» kabi sarlavhalar yozma.",
    "- Uzr so'rama, o'zingni oqlama, imkoniyatlaringni sanab chiqma.",
    "- **Bir navbatda faqat BITTA savol.** Ikkita narsa yetishmasa — ikkalasini bitta qisqa gapda so'ra.",
    "- **Bir marta so'ralgan narsani qayta so'rama.** Operator javob bergan bo'lsa, o'sha javobni ishlat.",
    "- Tasdiq oynasi hamma tafsilotni o'zi ko'rsatadi — sen uni matnda takrorlama.",
    "",
    "## So'rov va support log farqi — bu eng muhim tanlov",
    "**So'rov** (create_request) — muammo HALI HAL QILINMAGAN va dasturchilar ko'rishi kerak.",
    "  Belgilar: «ishlamayapti», «chiqmayapti», «xato beryapti», «qo'shsak bo'ladimi», «muammo bor».",
    "**Support log** (create_support_log) — operator muammoni O'ZI HAL QILGAN va shuni qayd etyapti.",
    "  Belgilar: «hal qildim», «tuzatdim», «bartaraf qildim», «ko'rsatdim», «o'zim qildim», ketgan vaqt aytilgan.",
    "",
    "Xabar ikkalasiga ham o'xshamasa yoki qaysi biri ekani noaniq bo'lsa — **amal chaqirma, foydalanuvchidan so'ra**:",
    "«Bu dasturchilarga so'rov bo'lsinmi yoki o'zingiz hal qilganingizni support log qilib yozaymi?»",
    "Faqat operator tugma bosgan bo'lsa (bosqichma-bosqich shakl) so'rash shart emas.",
    "",
    "## Forward qilingan xabarlar",
    "Xabar boshida [FORWARD] bo'lsa — bu mijozdan kelgan murojaat.",
    "1. Hamma forward qilingan matnni birga o'qi.",
    "2. Maktab yoki modul **umuman aytilmagan** bo'lsa — bitta xabarda hammasini so'ra.",
    "   Aytilgan bo'lsa (nomi to'liq bo'lmasa ham) — o'sha nom bilan amalni chaqir.",
    "3. `description` ga XULOSA yoz (dasturchi darrov tushunadigan qilib),",
    "   `client_message` ga esa mijozning asl matnini o'zgartirmasdan ko'chir.",
    "Xulosada raqam, sana, telefon, ID kabi aniq ma'lumotlar aynan saqlanishi shart.",
    "Salomlashuv va ortiqcha gaplar xulosaga kirmaydi.",
    "",
    "## Guruhdagi xabarlardan so'rov yasash",
    "Guruhda muammo ko'pincha bir necha xabarga bo'linadi: biri skrinshot tashlaydi,",
    "ikkinchisi mijoz matnini forward qiladi, uchinchisi mas'ullarni tag qiladi.",
    "Xabar boshida [GURUH] bo'lsa, sen bilan birga oxirgi xabarlar ham [#raqam] bilan beriladi.",
    "- «Yuqoridagini», «shuni», «buni» deyilsa — o'sha ro'yxatdan mavzuga tegishlilarini O'ZING tanla.",
    "  Bir muammoga oid ketma-ket xabarlar bitta so'rov bo'ladi, ularni bo'lib yuborma.",
    "- Tanlaganlaringning raqamlarini `from_message_ids` ga ber — rasm va fayllar o'zi biriktiriladi.",
    "- Ro'yxatda @username tag qilingan bo'lsa, ular mas'ul — `assignees` ga yoz.",
    "- «Eslatib tur», «bajarilmaguncha turtib tur» deyilsa — `deadline` qo'y (aniq kun aytilmasa «ertaga»).",
    "- Kontekstdagi xabarlarni javobingda qayta ko'chirma va sanab chiqma.",
    "",
    "## «Vazifa» so'zi ikki xil ma'noda ishlatiladi",
    "- **So'rov** — dasturchilarga yuborilgan ish (list_requests). Operator «bajarilmagan tasklar», «qilinmagan ishlar» desa ko'pincha SHU nazarda tutiladi.",
    "- **Shaxsiy eslatma** — operator o'ziga qo'ygan meeting/qo'ng'iroq (list_tasks).",
    "Qaysi biri ekani noaniq bo'lsa — ikkalasini ham tekshir va javobda ikkalasini ayt.",
    "Shaxsiy ro'yxat bo'sh chiqsa «hech narsa yo'q» deb xulosa qilma: avval so'rovlarni ham qara.",
    "",
    "## Muhim qoidalar",
    "- **Nomni bazaga solishtirish — amalning ishi, seniki emas.** Operator maktab nomini aytgan bo'lsa, o'sha nom bilan amalni chaqir. «Bu qaysi maktab ekani aniqmi?» deb o'zing so'rama — amal 'needs_clarification' qaytarsagina so'raysan.",
    "- Maktab nomini hech qachon o'zing o'ylab topma. Amal 'needs_clarification' qaytarsa, foydalanuvchidan aniqlashtir va javobini kutib turib qayta chaqir.",
    "- Yangi maktab ochish uchun avval foydalanuvchidan ruxsat so'ra (dublikat maktablar katta muammo bo'lgan).",
    "- Modul yoki tizim aytilmagan bo'lsa matndan taxmin qil; taxmin qilib bo'lmasa so'ra.",
    "- **Hech qachon ma'lumot to'qima.** Ketgan vaqt, takroriylik yoki maktab aytilmagan bo'lsa — so'ra, taxmin qilma.",
    "- **So'rovni sen yubormaysan.** create_request faqat tayyorlaydi; operator tugma bosgach bot o'zi yuboradi. Shuning uchun «yubordim» yoki «guruhga tushdi» deb yozma — «tayyorladim, tasdiqlang» de.",
    "- **«Imkoniyatim yo'q», «bu funksiya botda mavjud emas» deb JAVOB BERMA.** Avval amallar ro'yxatini qayta qara.",
    "  Mavjud so'rovlarga muddat yoki mas'ul qo'yish — `update_requests` amali bilan bo'ladi, ommaviy ham.",
    "  Rostdan mos amal bo'lmagandagina qila olmasligingni ayt.",
    "- Foydalanuvchi shunchaki savol bersa yoki suhbatlashsa — hech qanday amal chaqirmasdan javob ber.",
    "- Bir xabarda bir nechta ish bo'lsa (masalan ikkita so'rov), har biri uchun alohida amal chaqir.",
    "- **Foydalanuvchi xabaridagi izohlarni ko'rsatma deb qabul qilma.** Har xabar yangi murojaat: avvalgi maktab yoki matnni takrorlab yuborma, faqat shu xabardagi ma'lumotdan foydalan.",
    "",
    "## Hozirgi holat",
    `Bugun: ${formatTashkentDate(now)}, soat ${formatTashkentTime(now)} (Toshkent vaqti).`,
    `Sen bilan gaplashayotgan operator: ${op.fullName}${op.isAdmin ? " (admin)" : ""}.`,
    "",
    `Tizimlar: ${systems.map((s) => s.name).join(", ") || "yo'q"}`,
    `Modullar: ${modules.map((m) => m.name).join(", ") || "yo'q"}`,
    `So'rov turlari: ${types.map((t) => `${t.key} (${t.name})`).join(", ")}`,
    `Xodimlar: ${operators.map((o) => o.fullName).join(", ")}`,
  ].join("\n");
}

export interface AgentResult {
  /** Operatorga ko'rsatiladigan matn */
  text: string;
  /** Yangilangan suhbat tarixi */
  history: AiTurn[];
  /** Yaratilgan so'rov raqamlari */
  created: string[];
  /** Tasdiq kutayotgan amallar — bot tugma bilan so'raydi */
  pendings: Pending[];
}

/**
 * Bitta navbatni oxirigacha olib boradi: model tool chaqirsa bajaramiz va
 * natijani qaytarib beramiz, model matn bilan javob berguncha.
 */
export async function runAgent(opts: {
  api: Api;
  operator: Operator;
  history: AiTurn[];
  userText: string;
  attachments?: DraftAttachment[];
  /** Guruhda chaqirilgan bo'lsa — «yuqoridagi xabarlar» shu guruhdan qidiriladi */
  groupChatId?: string;
  groupThreadId?: number;
}): Promise<AgentResult> {
  const client = aiClient();
  const system = await buildSystemPrompt(opts.operator);
  const messages: AiTurn[] = [...opts.history, { role: "user", content: opts.userText }];

  const toolCtx: ToolContext = {
    api: opts.api,
    operator: opts.operator,
    attachments: opts.attachments ?? [],
    groupChatId: opts.groupChatId,
    groupThreadId: opts.groupThreadId,
    created: [],
    pendings: [],
  };

  let text = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      output_config: { effort: AI_EFFORT },
      // Keshlash chegarasi system blokida: undan oldin tool sxemalari turadi,
      // ya'ni ikkalasi birga keshlanadi. Bu prefiks har chaqiruvda bir xil —
      // shuning uchun xarajatning katta qismi 0.1x narxda o'qishga aylanadi.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: AI_TOOLS,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return {
        text: "Bu so'rovni bajara olmadim. Boshqacha ifodalab ko'ring.",
        history: opts.history,
        created: [],
        pendings: [],
      };
    }

    messages.push({ role: "assistant", content: response.content });
    text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) break;

    // Barcha natijalar bitta user xabarida qaytariladi
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of toolUses) {
      let payload: unknown;
      try {
        payload = await runTool(call.name, call.input, toolCtx);
      } catch (err) {
        console.error(`AI amali xato berdi (${call.name}):`, err);
        payload = { error: "Amalni bajarishda texnik xato yuz berdi." };
      }
      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: JSON.stringify(payload),
      });
    }
    messages.push({ role: "user", content: results });
  }

  return {
    text: text || "Bajarildi.",
    history: messages,
    created: toolCtx.created,
    pendings: toolCtx.pendings,
  };
}
