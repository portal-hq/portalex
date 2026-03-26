-- CreateTable
CREATE TABLE "noah_webhook_events" (
    "id" TEXT NOT NULL,
    "noahEnvironment" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "noah_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "noah_webhook_events_noahEnvironment_createdAt_idx" ON "noah_webhook_events"("noahEnvironment", "createdAt");
