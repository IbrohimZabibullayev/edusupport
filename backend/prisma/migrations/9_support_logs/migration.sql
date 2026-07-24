-- CreateTable Priority
CREATE TABLE "Priority" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#eb6834',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Priority_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Priority_key_key" ON "Priority"("key");

-- CreateTable SupportLog
CREATE TABLE "SupportLog" (
    "id" SERIAL NOT NULL,
    "logNumber" SERIAL NOT NULL,
    "systemId" INTEGER,
    "schoolId" INTEGER NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "problem" TEXT NOT NULL,
    "priorityId" INTEGER,
    "resolveMinutes" INTEGER NOT NULL DEFAULT 0,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "operatorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportLog_logNumber_key" ON "SupportLog"("logNumber");
CREATE INDEX "SupportLog_createdAt_idx" ON "SupportLog"("createdAt");
CREATE INDEX "SupportLog_moduleId_idx" ON "SupportLog"("moduleId");

-- AddForeignKey
ALTER TABLE "SupportLog" ADD CONSTRAINT "SupportLog_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportLog" ADD CONSTRAINT "SupportLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportLog" ADD CONSTRAINT "SupportLog_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportLog" ADD CONSTRAINT "SupportLog_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "Priority"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportLog" ADD CONSTRAINT "SupportLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Standart prioritetlar
INSERT INTO "Priority" ("key", "name", "color", "sortOrder") VALUES
  ('P1', 'P1-Shoshilinch', '#d64545', 1),
  ('P2', 'P2-Yuqori', '#eb6834', 2),
  ('P3', 'P3-O''rta', '#2a78d6', 3),
  ('P4', 'P4-Past', '#898781', 4);
