-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "walletId" TEXT NOT NULL,
    "exchangeUserId" INTEGER NOT NULL,
    "clientApiKey" TEXT,
    "username" TEXT NOT NULL,
    "apiSecret" TEXT,
    "apiKey" TEXT,
    "address" TEXT,
    "pushToken" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_balance" (
    "id" SERIAL NOT NULL,
    "cachedBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "exchange_balance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
