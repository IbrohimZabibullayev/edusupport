-- Bir so'rovga bir necha mas'ul: asosiysi assignee* ustunlarida qoladi
-- (eslatma va tag o'shanga bog'langan), qolganlari vergul bilan shu yerda.
-- Guruhda odatda ikki-uch kishi tag qilinadi, ular yo'qolib ketmasligi kerak.
ALTER TABLE "Request" ADD COLUMN "assigneeExtra" TEXT;
