-- Maktab nomining normalizatsiya qilingan ko'rinishi (dublikat topish uchun).
-- Unique EMAS: mavjud bazada ikkita yozuv bir xil kalitga tushishi mumkin,
-- ularni panel orqali birlashtiriladi.
ALTER TABLE "School" ADD COLUMN "nameKey" TEXT;
CREATE INDEX "School_nameKey_idx" ON "School"("nameKey");

-- So'rov qaysi mijoz chatidan forward qilinganini eslab qolamiz
ALTER TABLE "Request" ADD COLUMN "clientKey" TEXT;

-- Mijoz chati → maktab xotirasi
CREATE TABLE "ClientSource" (
  "id"           SERIAL NOT NULL,
  "key"          TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "schoolId"     INTEGER NOT NULL,
  "lastTypeKey"  TEXT,
  "lastModuleId" INTEGER,
  "useCount"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientSource_key_key" ON "ClientSource"("key");
ALTER TABLE "ClientSource" ADD CONSTRAINT "ClientSource_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Matndan tur/modul taxmin qilish uchun kalit so'zlar
CREATE TABLE "GuessKeyword" (
  "id"      SERIAL NOT NULL,
  "kind"    TEXT NOT NULL,
  "target"  TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  CONSTRAINT "GuessKeyword_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuessKeyword_kind_target_keyword_key" ON "GuessKeyword"("kind", "target", "keyword");
CREATE INDEX "GuessKeyword_kind_idx" ON "GuessKeyword"("kind");
