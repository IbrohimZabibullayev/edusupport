-- Botning o'z suhbat javoblarini belgilaymiz: faqat shularga qilingan reply
-- suhbat davomi hisoblanadi. Kartaga yoki eslatmaga reply qilib hamkasbni tag
-- qilganda bot aralashib ketmasligi uchun.
ALTER TABLE "GroupMessage" ADD COLUMN "isAssistant" BOOLEAN NOT NULL DEFAULT false;
