/*
  Warnings:

  - You are about to drop the column `backupShare` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `cipherText` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BackupMethod" AS ENUM ('CUSTOM', 'GDRIVE', 'ICLOUD', 'PASSWORD', 'PASSKEY', 'UNKNOWN');

-- CreateTable
CREATE TABLE "ClientBackupShare" (
    "backupMethod" "BackupMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL,
    "cipherText" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "ClientBackupShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodianBackupShare" (
    "backupMethod" "BackupMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL,
    "share" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "CustodianBackupShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientBackupShare_userId_key" ON "ClientBackupShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CustodianBackupShare_userId_key" ON "CustodianBackupShare"("userId");

-- AddForeignKey
ALTER TABLE "ClientBackupShare" ADD CONSTRAINT "ClientBackupShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodianBackupShare" ADD CONSTRAINT "CustodianBackupShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add all User.backupShare to CustodianBackupShare.
INSERT INTO "CustodianBackupShare" ("backupMethod", "createdAt", "id", "share", "userId")
SELECT 'UNKNOWN', NOW(), "id", "backupShare", "id" FROM "User";

-- Add all User.cipherText to ClientBackupShare.
INSERT INTO "ClientBackupShare" ("backupMethod", "createdAt", "id", "cipherText", "userId")
SELECT 'UNKNOWN', NOW(), "id", "cipherText", "id" FROM "User";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "backupShare",
DROP COLUMN "cipherText";
