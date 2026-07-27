-- Kim "bajarildi" tugmasini bosgani
ALTER TABLE "Request" ADD COLUMN "doneByTgId" TEXT;
ALTER TABLE "Request" ADD COLUMN "doneByName" TEXT;

-- Mas'ul odam (guruhdagi dev — botda ro'yxatdan o'tmagan bo'lishi mumkin) va muddat
ALTER TABLE "Request" ADD COLUMN "assigneeTgId" TEXT;
ALTER TABLE "Request" ADD COLUMN "assigneeName" TEXT;
ALTER TABLE "Request" ADD COLUMN "assigneeUsername" TEXT;
ALTER TABLE "Request" ADD COLUMN "deadline" TIMESTAMP(3);
ALTER TABLE "Request" ADD COLUMN "remindedAt" TIMESTAMP(3);

CREATE INDEX "Request_deadline_idx" ON "Request"("deadline");
