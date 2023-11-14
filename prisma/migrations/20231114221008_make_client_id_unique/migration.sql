-- Example data:
-- INSERT INTO "User"
--     (walletId, exchangeUserId, cipherText, clientApiKey, clientId, backupShare, username, apiSecret, apiKey, address, pushToken)
-- VALUES
--     ('walletId1', 1, 'cipherText1', 'clientApiKey1', 'clientId1', 'backupShare1', 'username1', 'apiSecret1', 'apiKey1', 'address1', 'pushToken1'),
--     ('walletId2', 1, 'cipherText2', 'clientApiKey2', 'clientId1', 'backupShare2', 'username1', 'apiSecret2', 'apiKey2', 'address2', 'pushToken2'),
--     ('walletId3', 2, 'cipherText3', 'clientApiKey3', 'clientId2', 'backupShare3', 'username2', 'apiSecret3', 'apiKey3', 'address3', 'pushToken3'),
--     ('walletId4', 2, 'cipherText4', 'clientApiKey4', 'clientId2', 'backupShare4', 'username2', 'apiSecret4', 'apiKey4', 'address4', 'pushToken4');

-- Find all users that have either duplicate clientId, duplicate exchangeUserId, or duplicate username, and delete all but one of them (the one with the lowest id).
DELETE FROM "User"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "User"
    GROUP BY clientId
    HAVING COUNT(*) > 1
)
AND clientId IN (
    SELECT clientId
    FROM "User"
    GROUP BY clientId
    HAVING COUNT(*) > 1
);

DELETE FROM "User"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "User"
    GROUP BY exchangeUserId
    HAVING COUNT(*) > 1
)
AND exchangeUserId IN (
    SELECT exchangeUserId
    FROM "User"
    GROUP BY exchangeUserId
    HAVING COUNT(*) > 1
);

DELETE FROM "User"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "User"
    GROUP BY username
    HAVING COUNT(*) > 1
)
AND username IN (
    SELECT username
    FROM "User"
    GROUP BY username
    HAVING COUNT(*) > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clientId_key" ON "User"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "User_exchangeUserId_key" ON "User"("exchangeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
