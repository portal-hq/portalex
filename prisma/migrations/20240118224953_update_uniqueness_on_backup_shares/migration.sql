/*
  Warnings:

  - The `backupMethod` column on the `ClientBackupShare` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `backupMethod` column on the `CustodianBackupShare` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[userId,backupMethod]` on the table `ClientBackupShare` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,backupMethod]` on the table `CustodianBackupShare` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ClientBackupShare_userId_key";

-- DropIndex
DROP INDEX "CustodianBackupShare_userId_key";

-- AlterTable
ALTER TABLE "ClientBackupShare" DROP COLUMN "backupMethod",
ADD COLUMN     "backupMethod" TEXT NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "CustodianBackupShare" DROP COLUMN "backupMethod",
ADD COLUMN     "backupMethod" TEXT NOT NULL DEFAULT 'UNKNOWN';

-- DropEnum
DROP TYPE "BackupMethod";

-- CreateIndex
CREATE UNIQUE INDEX "ClientBackupShare_userId_backupMethod_key" ON "ClientBackupShare"("userId", "backupMethod");

-- CreateIndex
CREATE UNIQUE INDEX "CustodianBackupShare_userId_backupMethod_key" ON "CustodianBackupShare"("userId", "backupMethod");
