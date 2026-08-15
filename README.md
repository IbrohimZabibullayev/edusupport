# EduSupport

Ta'lim ERP kompaniyasi uchun support-tracking tizimi:

- **`backend/`** — Telegram bot (grammY, polling) + REST API (Express) + Prisma/PostgreSQL. Bitta Node protsess, Railway'ga bitta servis sifatida deploy qilinadi.
- **`frontend/`** — Admin panel (React + Vite + Tailwind + Recharts). Vercel'ga deploy qilinadi.

Operatorlar bot orqali so'rov (bug / muammo-savol / taklif) kiritadi, buglar dev guruhga avtomatik yo'naltiriladi, admin panelda statistika ko'rinadi.

## 🤖 Assistent rejimi (asosiy usul)

AI kaliti berilgan bo'lsa (`GOOGLE_API_KEY` yoki `ANTHROPIC_API_KEY`) bot **tugmasiz** ishlaydi: operator oddiy xabar yozadi, bot o'zi tushunib kerakli ishni bajaradi.

```
👤 eduschoolda Farobiy Schoolda moliyada o'qituvchi maoshini
   chiqarishda muammo bo'lyabti

🤖 Tayyorladim: Farobiy School, Moliya moduli, Bug.
   ━━━━━━━━━━━━━━━━
   🐞 Bug
   🖥 Tizim: EduSchool
   🧩 Modul: Moliya (to'lovlar)
   🏫 Maktab: Farobiy School
   💬 O'qituvchi maoshini chiqarishda xatolik
   ━━━━━━━━━━━━━━━━
   [ ✅ Guruhga yuborish ]  [ ❌ Bekor qilish ]
```

Bir gapdan tizim, maktab, modul va so'rov turi ajratib olinadi.

**Guruhga tasdiqsiz hech narsa ketmaydi.** Assistent so'rovni faqat *tayyorlaydi* — aynan nima yuborilishini ko'rasiz va tugmani bosgandan keyingina dasturchilarga tushadi. Noto'g'ri tushunilgan xabar guruhni bezovta qilmaydi.

### Forward: yig'adi → so'raydi → xulosa yozadi

```
📨 "Assalomu alaykum akalar yaxshimisizlar"
📨 "CRM dagi ma'lumotlar EduTizimga ba'zilari o'tib ba'zilari o'tmayapti"
📨 "04.07.2026 14:43 da 91-496-7177 raqamli lid o'tkazilgan, 18 soat o'tdi"

💬 bu Najot Ta'limdan, lidlar moduli

🤖 Tayyorladim: Najot Ta'lim, Lidlar (CRM), Bug —
   CRM'dan Edu Tizimga lidlar to'liq o'tmayapti. Tasdiqlaysizmi?
```

Ketma-ket forwardlar **birga yig'iladi** (oxirgisidan 4 soniya kutiladi yoki siz izoh yozguningizcha), keyin assistent hammasidan bitta **xulosa** yozadi. Salomlashuv tushib qoladi, lekin telefon, sana va ID kabi aniq ma'lumotlar aynan saqlanadi. Kartada xulosa ham, mijozning asl matni ham bo'ladi.

### Noaniq bo'lsa — so'raydi, to'qimaydi

| Holat | Bot nima qiladi |
|---|---|
| «moliya bilan bog'liq bir gap bor edi» | so'rovmi yoki support logmi — so'raydi |
| «hal qilib berdim» (vaqt aytilmagan) | «qancha vaqt ketdi va takroriymi?» deb so'raydi |
| maktab bazada yo'q | yangi ochmaydi — avval ruxsat so'raydi |
| bir nechta o'xshash maktab | qaysi biri ekanini so'raydi |

Ketgan vaqt, takroriylik yoki maktab nomi **hech qachon to'qilmaydi**.

**Nimalar qila oladi:**

| Yozasiz | Bajaradi |
|---|---|
| «Najot Ta'limda jurnal ochilmayapti» | so'rov tayyorlaydi → tasdiqdan keyin guruhga |
| «o'zim tuzatdim, 25 daqiqa ketdi» | support log yozadi (guruhga ketmaydi) |
| «bugun 14:00 da meetingim bor, 5 daqiqa oldin eslat» | vazifa qo'yadi va eslatadi |
| «Feruzaga ertaga 10:00 ga hisobotni topshir» | topshiriq beradi va unga xabar yuboradi |
| «qilinmagan vazifalar nechta?» | hisobot beradi |
| «shu hafta kim nechta so'rov qilgan?» | operatorlar kesimida statistika |
| «Muhammadjonga yoz: ochiq so'rovlaringizni yoping» | o'sha odamga shaxsiy xabar yuboradi |
| «guruhga yoz: ertaga 10 da yig'ilish» | dasturchilar guruhiga xabar yozadi |

### Xabar tarqatish

Bot guruhlarda a'zo va operatorlarning chat ID'lari bazada — shuning uchun u odamlarga ham, guruhga ham yoza oladi:

```
👤 Muhammadjon bilan Husniddinga eslatma yubor:
   bugungi ochiq ticketlarni yoping

🤖 Tayyorladim. Kimga: Muhammadjon Tursunov, Husniddin Hamidov
   «Assalomu alaykum. Bugungi ochiq ticketlaringizni yoping.»
   [ ✅ Yuborish ]  [ ❌ Bekor qilish ]
```

Bu ham tasdiqsiz ketmaydi — kimga va nima yuborilishini ko'rasiz. Yuborilgach bot nechta odamga yetganini aytadi; kimdir botni bloklagan bo'lsa buni ham yashirmaydi.

**Hamma operatorlarga tarqatishni faqat admin qila oladi.** Oddiy operator kerakli odamlarni nomma-nom aytishi kerak.

### Guruhda ham javob beradi

Guruh chatida bot faqat chaqirilganda aralashadi — uch yo'l bilan:

- **`girgitton`** deb yozilsa (nomi bilan chaqirish)
- **@username** bilan tag qilinsa
- botning **suhbat javobiga** reply qilinsa

Uchinchisi ataylab tor: **karta, muddat eslatmasi va «BAJARILDI» bildirishnomasi suhbat hisoblanmaydi.** Ularga odamlar hamkasbini tag qilish uchun reply qiladi («@Iqboljon shuni ko'rib qo'y»), bot esa o'zicha «nima kerakligini aniqroq yozing» deb aralashib ketardi. Endi bunday joyda bot umuman uyg'onmaydi.

Uyg'ongan taqdirda ham har gapga matn bilan javob bermaydi: «rahmat», «ok bo'ldi», xayrlashuv yoki gap boshqa odamga qaratilgan bo'lsa — **matn o'rniga reaksiya** qo'yadi (👍). Guruh ortiqcha xabar bilan to'lmaydi.

```
👤 girgitton nechta bajarilmagan so'rov bor?

🤖 Hozircha 8 ta bajarilmagan so'rov bor:
   • ES-0834 — Bug, Najot Ta'lim, Moliya
   • ES-0833 — Bug, Najot Ta'lim, Moliya
   ...
```

Boshqa guruh xabarlariga javob bermaydi. Suhbat tarixi har bir odam uchun alohida saqlanadi (sessiya kaliti `chat:user`) — shuning uchun bot «qaysi maktab?» deb so'raganda javobingizni bog'lay oladi. Ro'yxatdan o'tmagan odamga bot avval shaxsiy chatda `/start` qilishni aytadi.

#### Bir necha xabarni bitta so'rovga yig'ish

Guruhda muammo odatda bo'lak-bo'lak keladi: biri skrinshot tashlaydi, ikkinchisi mijoz matnini forward qiladi, uchinchisi mas'ullarni tag qiladi. Bularning hech biri bot orqali o'tmagan.

Bot guruhdagi xabarlarni **48 soat eslab turadi** (`GroupMessage`), shuning uchun keyin shunchaki ayta qolasiz:

```
👤 girgitton yuqoridagi xabarlarni Najot Ta'lim uchun so'rov qilib saqlab qo'y,
   mas'ullar tag qilinganlar, bajarilmaguncha eslatib tur

🤖 [skrinshot bilan birga]
   Najot Ta'lim, Moliya bo'yicha BUG so'rovi tayyor — tasdiqlaysizmi?
   ━━━━━━━━━━━━━━━━
   🐞 Bug · 🧩 Moliya · 🏫 Najot Ta'lim
   💬 Ota-onalar ilovadan to'lov qila olmayapti — Payme/Click chiqmayapti...
   🙋 Mas'ul: @Abduraxmonov_Dostonbek, @xolmatov_dev
   ⏰ Muddat: 15/08/2026 — bajarilgunicha eslatib turaman
   📎 1 ta fayl
   ━━━━━━━━━━━━━━━━
   [ ✅ Guruhga yuborish ]  [ ❌ Bekor qilish ]
```

Xabar raqamini yozish, reply qilish yoki nechtaligini sanash shart emas — bot oxirgi 15 ta xabarni ko'radi va mavzuga tegishlilarini o'zi tanlaydi. Rasm/video o'sha xabarlardan olinadi, tag qilinganlar mas'ul bo'ladi, muddat qo'yilsa har kuni eslatib turiladi.

> Buning ishlashi uchun **bot guruhda admin bo'lishi** kerak — aks holda Telegram unga oddiy guruh xabarlarini bermaydi. `/guruh` buni tekshiradi.

#### Mavjud so'rovlarga muddat va mas'ul

Yaratilgan so'rovlarni ham bitta gap bilan boshqarasiz — bittasini ham, hammasini ham:

```
👤 barcha bajarilmagan tasklarga ertaga kechki 18:00 gacha muddat belgila
   va mas'ul qilib @Abduraxmonov_Dostonbek @IqboljonUnical ni qo'y

🤖 11 ta bajarilmagan so'rovga muddat va mas'ul tayyorlandi — tasdiqlaysizmi?
   ━━━━━━━━━━━━━━━━
   📌 11 ta bajarilmagan so'rov
   ⏰ Muddat: 15/08/2026 — bajarilgunicha eslatib turaman
   🙋 Mas'ul: @Abduraxmonov_Dostonbek, @IqboljonUnical

   ES-0930, ES-0931, ES-0932, ...
   ━━━━━━━━━━━━━━━━
   [ ✅ Belgilash ]  [ ❌ Bekor qilish ]
```

Maktab, modul yoki tur bo'yicha toraytirsa ham bo'ladi («Moliya bo'yicha ochiq so'rovlarni Dostonbekka ber»). Tasdiqlangach guruhdagi kartalar ham yangilanadi. Bir yo'la 60 tadan ko'p bo'lsa bot toraytirishni so'raydi.

> «Vazifa» so'zi ikki xil ma'noda ishlatilgani uchun bot ikkalasini ham tekshiradi: **so'rovlar** (dasturchilarga yuborilgan) va **shaxsiy eslatmalar** (meeting, qo'ng'iroq). Shaxsiy ro'yxat bo'sh bo'lsa «hech narsa yo'q» demaydi — so'rovlarni ham qaraydi.

`/yangi` — suhbatni tozalash. Suhbat 30 daqiqa jimlikdan keyin o'zi tozalanadi.

`/guruh` — bot qaysi guruhni ko'rayotganini ko'rsatadi va unga yoza olishini tekshiradi:

```
🔍 Guruh sozlamasi

📥 Umumiy guruh: -1001234567890
🖥 Edu Tizim: yo'q
🖥 EduSchool: yo'q

➡️ Xabarlar shu yerga ketadi: Dasturchilar guruhi
✅ Bog'lanish bor: Devs
👀 Guruh xabarlarini ko'ryapman (xotirada 34 ta).
```

So'rov kartasi ham aynan shu manzilga tushadi. Tartib: takliflar uchun alohida chat (agar belgilangan bo'lsa) → so'rovning o'z tizimi guruhi → umumiy guruh → yagona sozlangan tizim guruhi. Hech biri topilmasa so'rov yo'qolmasligi uchun adminlarga yuboriladi.

Sozlangani yetarli emas — bot guruhda turgani ham tekshiriladi. Bot chiqarilgan yoki guruh superguruhga aylanib ID o'zgargan bo'lsa shu yerda ko'rinadi. Oxirgi qator bot guruh xabarlarini ko'ra olayotganini aytadi; admin bo'lmasa «yuqoridagi xabarlarni so'rov qil» ishlamaydi va shu yerda ogohlantiriladi.

### Qaysi AI — kalitga qarab o'zi tanlanadi

Bot ikki provayder bilan ishlaydi. `.env` ga qaysi kalit qo'yilsa, o'sha ishlaydi:

```bash
# Google AI Studio — https://aistudio.google.com/apikey
GOOGLE_API_KEY=AIza...

# yoki Anthropic — https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Modelni almashtirish (ixtiyoriy)
AI_MODEL=
```

Ikkalasi berilsa **Google ustun** turadi. Hech biri berilmasa assistent o'chadi va bot eski tugmali rejimda ishlayveradi — boshqa hech narsa buzilmaydi. Bot ishga tushganda qaysi AI ulanganini logga yozadi:

```
🤖 Assistent: google · gemini-2.5-flash
```

Sukutdagi modellar: Google — `gemini-2.5-flash`, Anthropic — `claude-sonnet-5`. Kalitingizga qaysi modellar ochiqligini ko'rish uchun:

```bash
cd backend && npm run models
```

Ro'yxatdan birini tanlab `AI_MODEL` ga yozasiz — kodga tegish shart emas.

**Provayder almashtirilganda ochiq suhbatlar buzilmaydi.** Ikkalasining xabar formati butunlay boshqacha, shuning uchun suhbat tarixi sessiyada neytral ko'rinishda saqlanadi (`src/ai/types.ts`) va har chaqiruvda kerakli formatga o'giriladi. Tanilmagan formatdagi eski tarix uchraса tashlab yuboriladi — suhbat yangidan boshlanadi, bu xatolikdan yaxshiroq.

Anthropic yo'lida **prompt keshlash yoqilgan** — tizim prompti va amal sxemalari (~2900 token) har chaqiruvda 0.1x narxda o'qiladi, bu xarajatni ~3 baravar kamaytiradi. Sonnet 5 `effort: low` tanlangani o'lchov bilan asoslangan: 10 ta qiyin holatda Sonnet 5 low — 10/10 (~$76/oy), Haiku 4.5 — 9/10 (~$57/oy), eng oddiy holatda so'rov yaratmagan.

### Tugmali rejim (zaxira)

| | Qadamlar | Qachon |
|---|---|---|
| 📩 **Forward** | mijoz xabarini botga forward qilish — tamom | kundalik ish |
| ➕ **To'liq shakl** | `/new` → tizim → tur → modul → maktab → izoh → jo'natish | so'rovni o'zingiz yozganda |

### Forward: yig'ib olib, keyin so'raydi

```
1. Mijoz xabar(lar)ini forward qilasiz
2. Bot: "Yana qo'shimcha bormi?"   → yana forward yoki o'zingiz yozasiz
                                     tugagach [▶️ Davom etish]
3. Bot: "Bu Najot Ta'limmi?"       → tasdiq
4. Bot: "Qaysi tizim?"             → tanlash
5. Bot: "Qaysi modul?"             → tanlash
6. ✅ Yuborildi                     [✏️ Tuzatish]
```

**Nega avval yig'iladi?** Operator ko'pincha bir necha xabarni ketma-ket tashlaydi va oxirida o'zi ham izoh qo'shadi. Savollar oxirida berilgani uchun taxminlar **to'liq matn** asosida ishlaydi.

**So'rov turi so'ralmaydi** — matndan aniqlanadi: hashtag (`#taklif`, `#bug`) eng kuchli signal, keyin kalit so'zlar («ishlamayapti» → Bug, «qo'shsak» → Taklif). Aniqlab bo'lmasagina so'raladi.

**Maktab har safar tasdiqlatiladi.** Shu mijozdan avval xabar kelgan bo'lsa bot taxminni ko'rsatadi (`Bu Najot Ta'limmi?`), aks holda oxirgi ishlatilgan maktablar ro'yxatini beradi. Forward manbasi yashirin bo'lsa taxmin bo'lmaydi — shuning uchun tasdiq har doim so'raladi.

Yuborilgandan keyin «✏️ Tuzatish» bilan tur/modul/maktabni almashtirish mumkin — **guruhdagi karta ham darhol yangilanadi** va tuzatish o'sha mijozning xotirasiga yoziladi.

> Yarim tashlab ketilgan qoralama 5 daqiqadan keyin «eskirgan» hisoblanadi — yangi forward unga qo'shilmay, yangi so'rov boshlaydi.

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

Tartibi: **tizim → modul → markaz → muammo → prioritet → ketgan vaqt → takroriymi**.

Uchinchi bo'lim — **📝 Mening rejam**: operator o'ziga vazifa qo'yadi (meeting, qo'ng'iroq), kim bilanligini va vaqtini yozadi, bot esa **belgilangan vaqtdan 5 daqiqa oldin** shaxsiy eslatma yuboradi. Tasklar faqat egasiga ko'rinadi. `/tasks` buyrug'i bilan ham ochiladi.

```
📝 Mening rejam
Bugun
• 14:00  Shartnoma muhokamasi — Najot Ta'lim direktori
• 17:30  Qo'ng'iroq — Orbita
Ertaga
• 10:00  Demo — yangi mijoz
[ ➕ Yangi task ]
```

Vaqt erkin yoziladi: `14:30`, `ertaga 9:00`, `indinga 11:15`, `05.08 15:00`, `05.08.2026 15:00`. Faqat soat yozilsa va u o'tib ketgan bo'lsa — ertangi kun deb olinadi.

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
| 👤 **Boshqaga berish** | Bot tugmani bosgan odamni tag qilib «kimga berasiz?» deb so'raydi; u shu xabarga **reply qilib mas'ulni tag qiladi** |
| ⏰ **Muddat** | Bugun / Ertaga / 3 kun / 1 hafta |
| 🔄 **Qayta ochish** | Yopilgan so'rovni qaytaradi va guruhga xabar beradi |

**Nega tugma, kalit so'z emas?** Matn bilan qilinsa inkorni ajratib bo'lmaydi — "hali bajaril**ma**di" deb yozgan odam tiketni yopib yuborishi mumkin. Tugmada bunday xato yo'q va kim bosgani aniq bo'ladi. Eski `/bajarildi` buyrug'i (kartaga reply qilib) ishlashda davom etadi.

**Muddat eslatmasi.** Har kuni **09:00 (Asia/Tashkent)** bot muddati bugun tugaydigan va kechikkan, hali yopilmagan so'rovlarni topadi va o'sha kartaga reply qilib mas'ulni tag qiladi: «bu taskda o'zgarish bormi?» — ostida `✅ Bajarildi` va `⏰ +1 kun` tugmalari bilan. Kechikkan so'rov yopilguncha har kuni eslatiladi (kuniga bir marta).

> ℹ️ **Nega mas'ul ro'yxatdan tanlanmaydi?** Telegram Bot API guruhning oddiy a'zolari ro'yxatini bermaydi — faqat adminlarni ko'ra oladi. Shuning uchun ro'yxat tuzilmaydi: bot «kimga berasiz?» deb so'raydi, odam esa reply qilib mas'ulni o'zi tag qiladi. `@username` bilan ham, usernamesiz odamni tanlab ham ishlaydi.
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

# Assistent rejimi uchun (ixtiyoriy — berilmasa bot tugmali rejimda ishlaydi).
# Bittasi yetarli; ikkalasi berilsa Google ustun turadi.
GOOGLE_API_KEY=AIza...
ANTHROPIC_API_KEY=
# Modelni almashtirish (ixtiyoriy). Ro'yxat uchun: npm run models
AI_MODEL=
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
