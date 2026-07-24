-- CreateTable
CREATE TABLE "TopicKeyword" (
    "id" SERIAL NOT NULL,
    "type" "RequestType" NOT NULL,
    "keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopicKeyword_type_keyword_key" ON "TopicKeyword"("type", "keyword");

-- Standart kalit so'zlar (avvalgi kodda qattiq yozilgan qiymatlar)
INSERT INTO "TopicKeyword" ("type", "keyword") VALUES
  ('BUG', 'bug'),
  ('BUG', 'баг'),
  ('ISSUE', 'savol'),
  ('ISSUE', 'muammo'),
  ('ISSUE', 'aniqlash'),
  ('ISSUE', 'савол'),
  ('ISSUE', 'муаммо'),
  ('SUGGESTION', 'taklif'),
  ('SUGGESTION', 'feature'),
  ('SUGGESTION', 'g''oya'),
  ('SUGGESTION', 'таклиф'),
  ('SUGGESTION', 'фича');
