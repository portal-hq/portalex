-- Example data:
-- INSERT INTO "User"
--     ("walletId", "exchangeUserId", "cipherText", "clientApiKey", "clientId", "backupShare", "username", "apiSecret", "apiKey", "address", "pushToken")
-- VALUES
--     -- Duplicate "clientId"
--     ('walletId1', 1, 'cipherText1', 'clientApiKey1', 'clientId1', 'backupShare1', 'username1', 'apiSecret1', 'apiKey1', 'address1', 'pushToken1'), -- id: 1
--     ('walletId2', 2, 'cipherText2', 'clientApiKey2', 'clientId1', 'backupShare2', 'username2', 'apiSecret2', 'apiKey2', 'address2', 'pushToken2'), -- id: 2
--     -- Duplicate "exchangeUserId"
--     ('walletId3', 3, 'cipherText3', 'clientApiKey3', 'clientId3', 'backupShare3', 'username3', 'apiSecret3', 'apiKey3', 'address3', 'pushToken3'), -- id: 3
--     ('walletId4', 3, 'cipherText4', 'clientApiKey4', 'clientId4', 'backupShare4', 'username4', 'apiSecret4', 'apiKey4', 'address4', 'pushToken4'), -- id: 4
--     -- Duplicate "username"
--     ('walletId5', 5, 'cipherText5', 'clientApiKey5', 'clientId5', 'backupShare5', 'username5', 'apiSecret5', 'apiKey5', 'address5', 'pushToken5'), -- id: 5
--     ('walletId6', 6, 'cipherText6', 'clientApiKey6', 'clientId6', 'backupShare6', 'username5', 'apiSecret6', 'apiKey6', 'address6', 'pushToken6'); -- id: 6
-- After the migration, the following IDs should be kept: 1, 3, 5
-- After the migration, the following IDs should be deleted: 2, 4, 6

-- Find all users that have either duplicate "clientId", duplicate "exchangeUserId", or duplicate "username", and delete all but one of them (the one with the lowest id).
DELETE FROM "User"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "User"
    GROUP BY "clientId"
    HAVING COUNT(*) > 1
)
AND "clientId" IN (
    SELECT "clientId"
    FROM "User"
    GROUP BY "clientId"
    HAVING COUNT(*) > 1
);

DELETE FROM "User"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "User"
    GROUP BY "exchangeUserId"
    HAVING COUNT(*) > 1
)
AND "exchangeUserId" IN (
    SELECT "exchangeUserId"
    FROM "User"
    GROUP BY "exchangeUserId"
    HAVING COUNT(*) > 1
);

DELETE FROM "User"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "User"
    GROUP BY "username"
    HAVING COUNT(*) > 1
)
AND "username" IN (
    SELECT "username"
    FROM "User"
    GROUP BY "username"
    HAVING COUNT(*) > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clientId_key" ON "User"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "User_exchangeUserId_key" ON "User"("exchangeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
