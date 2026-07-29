# EduSupport

Ta'lim ERP kompaniyasi uchun support-tracking tizimi:

- **`backend/`** — Telegram bot (grammY, polling) + REST API (Express) + Prisma/PostgreSQL. Bitta Node protsess, Railway'ga bitta servis sifatida deploy qilinadi.
- **`frontend/`** — Admin panel (React + Vite + Tailwind + Recharts). Vercel'ga deploy qilinadi.

Operatorlar bot orqali so'rov (bug / muammo-savol / taklif) kiritadi, buglar dev guruhga avtomatik yo'naltiriladi, admin panelda statistika ko'rinadi.

**So'rov kiritishning ikki yo'li bor:**

| | Qadamlar | Qachon |
|---|---|---|
| 📩 **Forward** | mijoz xabarini botga forward qilish — tamom | kundalik ish |
| ➕ **To'liq shakl** | `/new` → tizim → tur → modul → maktab → izoh → jo'natish | so'rovni o'zingiz yozganda |

### Forward: bot o'zi to'ldiradi

Operator mijozning xabarini botga forward qiladi — boshqa hech narsa qilmaydi. Bot uch narsani o'zi aniqlaydi:

| Maydon | Qayerdan |
|---|---|
| 🏫 **Maktab** | **shu mijozdan avval kelgan xabardan.** Birinchi marta so'raydi, keyin hech qachon so'ramaydi |
| 💡 **So'rov turi** | hashtagdan (`#taklif`, `#bug`) yoki matndagi so'zdan («ishlamayapti» → Bug) |
| 🧩 **Modul** | matndagi so'zdan («chek», «davomat», «shop») yoki modul nomidan |
| 🖥 **Tizim** | operatorning oxirgi so'rovidan |

Hammasi aniqlansa so'rov **hech narsa so'ralmasdan** guruhga ketadi, operatorga esa qisqa tasdiq keladi:

```
✅ ES-0021 guruhga yuborildi
💡 Taklif · 🏆 Gamifikatsiya
🏫 Najot Ta'lim
[ ✏️ Tuzatish ]
```

Xato bo'lsa «✏️ Tuzatish» bosiladi — tur/modul/maktab almashtiriladi, **guruhdagi karta ham darhol yangilanadi** va tuzatish o'sha mijozning xotirasiga yoziladi (keyingi safar to'g'ri taxmin qilinadi).

Aniqlab bo'lmagan maydon bo'lsa faqat **o'shanisi** so'raladi. Yangi mijoz uchun bu odatda bitta savol — maktab.

Bir nechta xabarni ketma-ket forward qilsa (albom ham) hammasi bitta so'rovga yig'iladi.

> Taxmin kalit so'zlari `GuessKeyword` jadvalida — birinchi ishga tushishda ~100 tasi avtomatik qo'shiladi (o'zbekcha, kirill va ruscha variantlar bilan).

### Maktab dublikatlari

Bir maktab har xil yozilib ketmasligi uchun nom **normalizatsiya qilib** taqqoslanadi:

| Yozilishi | Taqqoslash kaliti |
|---|---|
| `Najot Ta'lim` · `najot talim` · `NAJOT TAʼLIM` · `Najot  Ta'lim` | `najot talim` |

Apostrofning hamma varianti (`'` `'` `ʻ` `` ` ``) va ortiqcha probellar hisobga olinmaydi, katta-kichik harf farqi yo'q. Kalit mos kelsa — mavjud maktabga bog'lanadi, yangi yozuv ochilmaydi.

Bu tekshiruv **maktab nomi yoziladigan uchala joyda** bir xil ishlaydi: forward oqimida, `/new` to'liq shaklida va **Support log**da (`handlers/schoolPick.ts` — umumiy bosqich).

Imlo xatosi bo'lsa (`Najot Talimm`) bot **so'raydi**, o'zi qaror qilmaydi:

```
Siz yozdingiz: Najot Talimm
Bazada shunga o'xshash maktablar bor. Qaysi biri?
[ ✅ Najot Ta'lim ]
[ ✅ Najot ]
[ ➕ Yangi maktab: Najot Talimm ]
```

**Mavjud dublikatlar** admin paneldagi «Maktablar» sahifasida ko'rsatiladi: o'xshash nomlar guruhlanadi, qaysi nom qolishini tanlab «Birlashtirish» bosiladi. So'rovlar, support loglar va mijoz xotirasi saqlanadigan nomga ko'chiriladi — **tarix yo'qolmaydi**.

Bundan tashqari operatorlar **Support log** yuritadi — dasturchisiz o'zi (mijoz bilan meet qilib) hal qilgan muammolarni yozib boradi. Bu guruhga yuborilmaydi, faqat hisob-kitob uchun: qaysi modulda qancha muammo, qancha vaqt ketgani, takroriyligi va kim ishlagani. Bot menyusidagi «📋 Support log» tugmasi yoki `/log` orqali kiritiladi, admin panelda jadval + statistika ko'rinadi.

---

## 1. Botni BotFather'da yaratish

1. Telegram'da [@BotFather](https://t.me/BotFather) ga yozing → `/newbot`.
2. Bot nomini va username'ini kiriting (masalan `edusupport_bot`).
3. BotFather bergan **tokenni** saqlab qo'ying — bu `BOT_TOKEN`.
4. Ixtiyoriy: `/setcommands` orqali buyruqlarni qo'shing:
   ```
   start - Ishni boshlash / ro'yxatdan o'tish
   new - Yangi so'rov kiritish (to'liq shakl)
   log - Support log yozish
   report - Hisobot olish (admin)
   ```

> Forward yo'li shaxsiy chatda ishlaydi — unga BotFather'dagi privacy sozlamasi ta'sir qilmaydi. Privacy faqat **guruhda** muhim (pastdagi bo'limlar bo'yicha bo'limga qarang).

## 2. Dev guruhni ulash

Eng oson yo'l — **`/setgroup` buyrug'i** (env sozlash shart emas):

1. Dev jamoa guruhini oching (yoki yarating) va botni guruhga qo'shing.
2. Guruhda `/setgroup` yozing (avval botda `/admin` orqali admin bo'lgan bo'lishingiz kerak).
3. Bot "✅ saqlandi" deydi — endi buglar shu guruhga tushadi. Guruh o'zgarsa yangi guruhda yana `/setgroup` yozasiz.

Takliflar chati uchun xuddi shunday `/setbacklog` ishlatiladi (belgilanmasa takliflar adminlarga boradi).

### Forum guruhlar (bo'limlar / topics)

Agar guruh forum rejimida bo'lsa (Bugs, Features, News kabi bo'limlari bor), so'rov turlari bo'limlarga ajratiladi.

**Avtomatik aniqlash.** Telegram Bot API bo'limlar ro'yxatini bermaydi, lekin bot guruhdagi xabarlar bilan birga keladigan bo'lim nomlaridan o'zi o'rganib boradi va nomiga qarab biriktiradi. Bo'lim nomida quyidagi **kalit so'zlar**dan biri uchrasa, o'sha turdagi so'rovlar shu bo'limga tushadi (standart qiymatlar):

| Bo'lim nomida bor | So'rov turi |
|---|---|
| `bug` | 🐞 Bug |
| `savol`, `muammo`, `aniqlash` | ❓ Muammo-savol |
| `taklif`, `feature`, `g'oya` | 💡 Taklif |

Kalit so'zlar **admin panelda** («Bo'lim kalit so'zlari» sahifasi) qo'shiladi/o'chiriladi — kodni o'zgartirish shart emas. Masalan bo'lim "Xatolar" deb nomlangan bo'lsa, Bug turiga `xato` so'zini qo'shsangiz kifoya. Katta-kichik harf farqi yo'q.

> **So'rov turlari ham dinamik.** Operator so'rov kiritganda tanlaydigan turlar (Bug / Muammo-savol / Taklif) admin paneldagi **«So'rov turlari»** sahifasida boshqariladi — yangi tur qo'shish, nom/emoji/rang o'zgartirish, faolsizlantirish mumkin. Har bir yangi tur uchun «Bo'lim kalit so'zlari»da unga kalit so'z qo'shsangiz, o'sha turdagi so'rovlar mos bo'limga tushadi.

⚠️ **Avtomatika faqat yangi bo'limlarni tutadi.** Telegram botga bo'lim nomini faqat uch holatda yuboradi: bo'lim **yaratilganda**, **nomi o'zgartirilganda** va o'sha bo'limning yaratilish xabariga reply qilinganda. Bot guruhga qo'shilishidan **oldin** mavjud bo'lgan bo'limlar (Bugs, Features, News) shu sababli avtomatik biriktirilmaydi — ularning nomi botga hech qachon kelmaydi. Bunday bo'limlar uchun `/settopic` ishlating (yoki bo'lim nomini o'zgartirib qo'ying — masalan "Features" → "Features " → orqaga; nom o'zgarishi botga yetib boradi).

Shartlari: bot guruh xabarlarini ko'ra olishi kerak — botni guruhda **admin** qiling (yoki BotFather'da Group Privacy'ni o'chiring).

**Qo'lda biriktirish (`/settopic`).** Eng ishonchli usul. Nomlari yuqoridagi qolipga tushmaydigan yoki bot qo'shilishidan oldin mavjud bo'lgan bo'limlar uchun: kerakli bo'lim ichida `/settopic` yozing va so'rov turini tanlang. Qo'lda biriktirilgan bo'lim ustidan avtomatika hech qachon yozmaydi.

**Tekshirish (`/topics`).** Guruhda `/topics` yozsangiz, har bir so'rov turi qaysi bo'limga (yoki General'ga) tushayotgani ko'rinadi.

Biriktirilmagan turdagi so'rovlar General (asosiy) bo'limga tushadi. Biriktirmani olib tashlash uchun General'da `/settopic` yozib turini tanlang. Bo'lim o'chirilgan/yopilgan bo'lsa bot avtomatik General'ga yuboradi.

> `.env` dagi `DEV_GROUP_ID`/`BACKLOG_CHAT_ID` zaxira usul sifatida qoladi: bazada qiymat bo'lmasa env'dan olinadi. Chat ID kerak bo'lsa guruhda `/chatid` yozing (bo'lim ichida yozilsa topic ID ham chiqadi).

### So'rovning guruhdagi hayoti (mas'ul, muddat, bajarildi)

Har bir karta ostida tugmalar turadi — hech narsa yozish kerak emas:

| Tugma | Nima qiladi |
|---|---|
| ✅ **Bajarildi** | So'rovni yopadi, **kim bosgani** bazaga yoziladi, karta yangilanadi va **operatorga DM boradi** |
| 🙋 **Men olaman** | Bosgan odam mas'ul bo'ladi |
| 👤 **Boshqaga berish** | Guruh **adminlari** ro'yxatidan mas'ul tanlanadi va o'sha odam tag qilinadi |
| ⏰ **Muddat** | Bugun / Ertaga / 3 kun / 1 hafta |
| 🔄 **Qayta ochish** | Yopilgan so'rovni qaytaradi va guruhga xabar beradi |

**Nega tugma, kalit so'z emas?** Matn bilan qilinsa inkorni ajratib bo'lmaydi — "hali bajaril**ma**di" deb yozgan odam tiketni yopib yuborishi mumkin. Tugmada bunday xato yo'q va kim bosgani aniq bo'ladi. Eski `/bajarildi` buyrug'i (kartaga reply qilib) ishlashda davom etadi.

**Muddat eslatmasi.** Har kuni **09:00 (Asia/Tashkent)** bot muddati bugun tugaydigan va kechikkan, hali yopilmagan so'rovlarni topadi va o'sha kartaga reply qilib mas'ulni tag qiladi: «bu taskda o'zgarish bormi?» — ostida `✅ Bajarildi` va `⏰ +1 kun` tugmalari bilan. Kechikkan so'rov yopilguncha har kuni eslatiladi (kuniga bir marta).

> ℹ️ **Nega mas'ul ro'yxati faqat adminlardan?** Telegram Bot API guruhning oddiy a'zolari ro'yxatini bermaydi — faqat `getChatAdministrators` bor. Shuning uchun devlarni guruhda admin qiling, yoki ular «🙋 Men olaman» tugmasini o'zlari bossin (bu har doim ishlaydi).
>
> ℹ️ **Nega eslatma guruhda, DM'da emas?** Bot o'zi birinchi bo'lib hech kimga DM yoza olmaydi — odam avval botga `/start` bosishi kerak. Devlar buni qilmagan bo'lishi mumkin, shuning uchun eslatma guruhda tag orqali boradi (tag baribir bildirishnoma beradi). Operatorga esa DM boradi, chunki u botda ro'yxatdan o'tgan.

## 3. Lokal ishga tushirish

Talablar: Node.js 20+, PostgreSQL (lokal yoki Docker).

```bash
# PostgreSQL (Docker bilan, ixtiyoriy)
docker run -d --name edusupport-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=edusupport -p 5432:5432 postgres:16
```

### Backend

```bash
cd backend
cp .env.example .env        # qiymatlarni to'ldiring (pastga qarang)
npm install
npx prisma migrate deploy   # jadvallarni yaratadi
npm run dev                 # bot + API birga, hot-reload bilan
```

`.env` misoli:

```
BOT_TOKEN=123456:ABC-DEF...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/edusupport
ADMIN_LOGIN=admin
ADMIN_PASSWORD=kuchli-parol
JWT_SECRET=juda-uzun-tasodifiy-satr
DEV_GROUP_ID=-1001234567890
BACKLOG_CHAT_ID=
PORT=3000
```

### Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:3000
npm install
npm run dev                 # http://localhost:5173
```

### Birinchi qadamlar

1. Botga kirib `/admin` yozing → login/parol (`.env` dagi) → siz admin bo'lasiz.
2. Operator botga `/start` yozib ro'yxatdan o'tadi → sizga tasdiqlash tugmasi keladi.
3. Admin panelga `ADMIN_LOGIN`/`ADMIN_PASSWORD` bilan kiring.

## 4. Railway'ga deploy (backend)

1. Kodni GitHub'ga push qiling.
2. [Railway](https://railway.app) da **New Project → Deploy from GitHub repo** → repo'ni tanlang.
3. Service sozlamalarida **Root Directory** ni `backend` qilib qo'ying.
4. **+ New → Database → PostgreSQL** qo'shing — Railway `DATABASE_URL` o'zgaruvchisini beradi.
5. Backend servisning **Variables** bo'limida quyidagilarni kiriting:
   - `BOT_TOKEN`, `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `JWT_SECRET`, `DEV_GROUP_ID`, (`BACKLOG_CHAT_ID`)
   - `DATABASE_URL` → Postgres servisiga **Reference** qiling (`${{Postgres.DATABASE_URL}}`)
   - `PORT` ni Railway o'zi beradi, qo'lda kiritish shart emas.
6. Deploy avtomatik ketadi: `npm install` → `npm run build` → `npm start`. `start` scripti avval `prisma migrate deploy` ni bajaradi (jadvallar yaratiladi), keyin serverni ko'taradi.
7. Servisga **Public Domain** bering (Settings → Networking → Generate Domain) — bu URL frontend uchun `VITE_API_URL` bo'ladi.

> Bot polling rejimida ishlaydi — webhook va qo'shimcha sozlash kerak emas. Bitta bot tokeni bilan faqat bitta instans ishga tushiring (replikalar soni 1 bo'lsin).

## 5. Vercel'ga deploy (frontend)

1. [Vercel](https://vercel.com) da **Add New → Project** → o'sha GitHub repo'ni tanlang.
2. **Root Directory** ni `frontend` qilib qo'ying (Framework: Vite avtomatik aniqlanadi).
3. **Environment Variables** ga `VITE_API_URL` = Railway'dagi backend domeni (masalan `https://edusupport-production.up.railway.app`) kiriting.
4. Deploy bosing. SPA routing uchun qo'shimcha sozlash kerak emas (Vercel Vite'ni o'zi to'g'ri sozlaydi); agar 404 chiqsa, `frontend/vercel.json` ga rewrite qo'shing:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```

## 6. Arxitektura qisqacha

```
Operator (Telegram) ──▶ Bot (grammY, polling) ──▶ PostgreSQL (Prisma)
                              │      ▲
   Hamma so'rov ──▶ DEV guruh │      │ sessiya ham bazada (restart-safe wizard)
   (Taklif: BACKLOG bo'lsa o'sha yerga)
                                     │
Admin panel (React) ──JWT──▶ REST API (Express) ── bitta protsess bot bilan
```

- **Ticket ID**: har so'rovga `ES-XXXX` (auto-increment) beriladi.
- **Haftalik hisobot**: har dushanba 09:00 (Asia/Tashkent) hamma adminlarga bot yuboradi.
- **Rollar**: operator (bot orqali ro'yxatdan o'tadi, admin tasdiqlaydi) va admin (`/admin` buyrug'i yoki panel).
- **Xavfsizlik**: hech qanday token/parol kodda yo'q — hammasi env orqali; API JWT bilan himoyalangan; parol xabarini bot darhol o'chiradi.

## 7. API qisqacha

| Endpoint | Tavsif |
|---|---|
| `POST /api/auth/login` | `{login, password}` → `{token}` (JWT, 7 kun) |
| `GET /api/stats/overview?from=&to=` | jami, turi/moduli bo'yicha |
| `GET /api/stats/weekly` | oxirgi 12 hafta trend |
| `GET /api/stats/schools?from=&to=` | maktab kesimida |
| `GET /api/stats/operators?from=&to=` | operator kesimida |
| `GET /api/requests?page=&pageSize=&type=&module=&schoolId=&operatorId=&from=&to=&search=` | so'rovlar ro'yxati |
| `GET /api/operators` · `PATCH /api/operators/:id` | ro'yxat · status o'zgartirish |
| `GET /api/schools` · `POST /api/schools` · `PATCH /api/schools/:id` | maktablar CRUD |
| `GET /api/modules` · `POST /api/modules` · `PATCH /api/modules/:id` | modullar CRUD (bot tugmalari shu ro'yxatdan chiqadi) |
| `GET /api/systems` · `POST /api/systems` · `PATCH /api/systems/:id` | tizimlar CRUD |
| `GET /api/request-types` · `POST` · `PATCH /:id` · `DELETE /:id` | so'rov turlari CRUD (bot tugmalari shu ro'yxatdan) |
| `GET /api/priorities` · `POST` · `PATCH /:id` · `DELETE /:id` | support log prioritetlari CRUD |
| `GET /api/support-logs?page=&pageSize=&systemId=&moduleId=&operatorId=&priorityId=&recurring=&from=&to=&search=` | support log ro'yxati |
| `GET /api/support-logs/stats?...` | support log statistikasi (jami, vaqt, modul/operator/prioritet kesimida) |
| `GET /api/topic-keywords` · `POST /api/topic-keywords` · `DELETE /api/topic-keywords/:id` | forum bo'lim kalit so'zlari (avto-aniqlash) |

Login'dan tashqari hamma endpoint `Authorization: Bearer <token>` talab qiladi.
