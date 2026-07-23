# EduSupport

Ta'lim ERP kompaniyasi uchun support-tracking tizimi:

- **`backend/`** — Telegram bot (grammY, polling) + REST API (Express) + Prisma/PostgreSQL. Bitta Node protsess, Railway'ga bitta servis sifatida deploy qilinadi.
- **`frontend/`** — Admin panel (React + Vite + Tailwind + Recharts). Vercel'ga deploy qilinadi.

Operatorlar bot orqali so'rov (bug / muammo-savol / taklif) kiritadi, buglar dev guruhga avtomatik yo'naltiriladi, admin panelda statistika ko'rinadi.

---

## 1. Botni BotFather'da yaratish

1. Telegram'da [@BotFather](https://t.me/BotFather) ga yozing → `/newbot`.
2. Bot nomini va username'ini kiriting (masalan `edusupport_bot`).
3. BotFather bergan **tokenni** saqlab qo'ying — bu `BOT_TOKEN`.
4. Ixtiyoriy: `/setcommands` orqali buyruqlarni qo'shing:
   ```
   start - Ishni boshlash / ro'yxatdan o'tish
   new - Yangi so'rov kiritish
   report - Hisobot olish (admin)
   ```

## 2. Dev guruhni ulash

Eng oson yo'l — **`/setgroup` buyrug'i** (env sozlash shart emas):

1. Dev jamoa guruhini oching (yoki yarating) va botni guruhga qo'shing.
2. Guruhda `/setgroup` yozing (avval botda `/admin` orqali admin bo'lgan bo'lishingiz kerak).
3. Bot "✅ saqlandi" deydi — endi buglar shu guruhga tushadi. Guruh o'zgarsa yangi guruhda yana `/setgroup` yozasiz.

Takliflar chati uchun xuddi shunday `/setbacklog` ishlatiladi (belgilanmasa takliflar adminlarga boradi).

> `.env` dagi `DEV_GROUP_ID`/`BACKLOG_CHAT_ID` zaxira usul sifatida qoladi: bazada qiymat bo'lmasa env'dan olinadi. Chat ID kerak bo'lsa guruhda `/chatid` yozing.

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

Login'dan tashqari hamma endpoint `Authorization: Bearer <token>` talab qiladi.
