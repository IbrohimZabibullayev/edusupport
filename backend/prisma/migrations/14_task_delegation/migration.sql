-- Vazifaga sozlanadigan eslatma vaqti va topshiruvchi
ALTER TABLE "OperatorTask" ADD COLUMN "remindLeadMin" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "OperatorTask" ADD COLUMN "assignedByName" TEXT;
