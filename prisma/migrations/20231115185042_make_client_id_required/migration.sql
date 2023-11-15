/*
  Warnings:

  - Made the column `clientId` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- Delete all user records with a null clientId
DELETE FROM "User" WHERE "clientId" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "clientId" SET NOT NULL;
