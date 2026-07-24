-- So'rov turini enum'dan matnga o'tkazamiz (qiymatlar aynan saqlanadi: BUG/ISSUE/SUGGESTION)
ALTER TABLE "Request" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
ALTER TABLE "TopicKeyword" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
ALTER TABLE "GroupTopic" ALTER COLUMN "type" TYPE TEXT USING "type"::text;

-- Endi enum kerak emas
DROP TYPE "RequestType";

-- So'rov turlari jadvali (admin panelda boshqariladi)
CREATE TABLE "RequestType" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#2a78d6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequestType_key_key" ON "RequestType"("key");

-- Mavjud 3 tur (avvalgi kodda qattiq yozilgan qiymatlar)
INSERT INTO "RequestType" ("key", "name", "emoji", "color", "sortOrder") VALUES
  ('BUG', 'Bug', '🐞', '#2a78d6', 1),
  ('ISSUE', 'Muammo-savol', '❓', '#eb6834', 2),
  ('SUGGESTION', 'Taklif', '💡', '#1baf7a', 3);
