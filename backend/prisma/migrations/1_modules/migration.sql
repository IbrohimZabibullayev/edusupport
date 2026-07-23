-- Eski enum-modul davridagi so'rovlar yangi moduleId bilan mos kelmaydi — tozalaymiz
-- (yangi bazada bu jadval bo'sh bo'ladi, hech narsa o'chmaydi)
DELETE FROM "Request";

-- DropIndex
DROP INDEX "Request_module_idx";

-- AlterTable
ALTER TABLE "Request" DROP COLUMN "module",
ADD COLUMN     "moduleId" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "Module";

-- CreateTable
CREATE TABLE "Module" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Module_name_key" ON "Module"("name");

-- CreateIndex
CREATE INDEX "Request_moduleId_idx" ON "Request"("moduleId");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

