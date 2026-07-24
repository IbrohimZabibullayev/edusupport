-- So'rov statusi: guruhda "bajarildi" deb belgilash uchun
ALTER TABLE "Request" ADD COLUMN "done" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Request" ADD COLUMN "doneAt" TIMESTAMP(3);

-- Botning guruhga yuborgan karta xabari (reply orqali topish uchun)
ALTER TABLE "Request" ADD COLUMN "cardChatId" TEXT;
ALTER TABLE "Request" ADD COLUMN "cardMessageId" INTEGER;
