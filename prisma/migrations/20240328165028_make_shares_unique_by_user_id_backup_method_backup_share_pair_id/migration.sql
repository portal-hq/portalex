-- Remove duplicates and keep the oldest record.
DELETE FROM "ClientBackupShare"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT "id", ROW_NUMBER() OVER(PARTITION BY "userId", "backupMethod", "backupSharePairId" ORDER BY "createdAt" DESC) AS rnum
    FROM "ClientBackupShare"
  ) t
  WHERE t.rnum > 1
);

-- Remove duplicates and keep the oldest record.
DELETE FROM "CustodianBackupShare"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT "id", ROW_NUMBER() OVER(PARTITION BY "userId", "backupMethod", "backupSharePairId" ORDER BY "createdAt" DESC) AS rnum
    FROM "CustodianBackupShare"
  ) t
  WHERE t.rnum > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientBackupShare_userId_backupMethod_backupSharePairId_key" ON "ClientBackupShare"("userId", "backupMethod", "backupSharePairId");

-- CreateIndex
CREATE UNIQUE INDEX "CustodianBackupShare_userId_backupMethod_backupSharePairId_key" ON "CustodianBackupShare"("userId", "backupMethod", "backupSharePairId");
