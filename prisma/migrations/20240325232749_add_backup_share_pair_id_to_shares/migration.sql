-- DropIndex
DROP INDEX "ClientBackupShare_userId_backupMethod_key";

-- DropIndex
DROP INDEX "CustodianBackupShare_userId_backupMethod_key";

-- AlterTable
ALTER TABLE "ClientBackupShare" ADD COLUMN     "backupSharePairId" TEXT;

-- AlterTable
ALTER TABLE "CustodianBackupShare" ADD COLUMN     "backupSharePairId" TEXT;
