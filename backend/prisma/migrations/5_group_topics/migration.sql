-- CreateTable
CREATE TABLE "GroupTopic" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "threadId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupTopic_chatId_type_key" ON "GroupTopic"("chatId", "type");
