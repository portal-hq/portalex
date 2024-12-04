-- CreateTable
CREATE TABLE "AlertWebhookEvent" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" JSONB NOT NULL,
    "id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertWebhookEvent_pkey" PRIMARY KEY ("id")
);
