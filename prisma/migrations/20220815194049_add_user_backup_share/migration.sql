-- AlterTable
ALTER TABLE "User" ADD COLUMN     "backupShare" TEXT,
ALTER COLUMN "walletId" DROP NOT NULL;
