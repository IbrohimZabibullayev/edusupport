-- Guruhdagi so'nggi xabarlar: "girgitton, shu xabarlarni so'rov qil" uchun.
-- Telegram boti o'tmishdagi xabarlarni so'rab ololmaydi — faqat kelgan paytda
-- ko'radi. Shuning uchun qisqa muddatga saqlab turamiz.
CREATE TABLE "GroupMessage" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "threadId" INTEGER,
    "messageId" INTEGER NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromUsername" TEXT,
    "forwardFrom" TEXT,
    "text" TEXT,
    "mediaKind" TEXT,
    "mediaFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroupMessage_chatId_messageId_key" ON "GroupMessage"("chatId", "messageId");
CREATE INDEX "GroupMessage_chatId_threadId_createdAt_idx" ON "GroupMessage"("chatId", "threadId", "createdAt");
