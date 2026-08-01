-- Operatorning shaxsiy rejasi (meeting, qo'ng'iroq va h.k.)
CREATE TABLE "OperatorTask" (
  "id"         SERIAL NOT NULL,
  "operatorId" INTEGER NOT NULL,
  "title"      TEXT NOT NULL,
  "withWhom"   TEXT,
  "dueAt"      TIMESTAMP(3) NOT NULL,
  "done"       BOOLEAN NOT NULL DEFAULT false,
  "doneAt"     TIMESTAMP(3),
  "remindedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperatorTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperatorTask_operatorId_dueAt_idx" ON "OperatorTask"("operatorId", "dueAt");
CREATE INDEX "OperatorTask_dueAt_idx" ON "OperatorTask"("dueAt");

ALTER TABLE "OperatorTask" ADD CONSTRAINT "OperatorTask_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
