/*
  Warnings:

  - A unique constraint covering the columns `[clientApiKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `clientApiKey` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- Delete users without clientApiKey (only 2 on staging).
DELETE FROM "User" WHERE "clientApiKey" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "clientApiKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_clientApiKey_key" ON "User"("clientApiKey");
