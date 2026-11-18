-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "anchor" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "evidence" TEXT NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL,
    "reverseOf" TEXT,
    "actorId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EventDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "requestKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "rulesKey" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "postedAt" DATETIME,
    "postedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SettlementDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Wallet" (
    "subjectId" TEXT NOT NULL PRIMARY KEY,
    "money" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "before" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "settlementId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Event_requestKey_key" ON "Event"("requestKey");

-- CreateIndex
CREATE INDEX "Event_subjectId_periodStart_idx" ON "Event"("subjectId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "EventDecision_requestKey_key" ON "EventDecision"("requestKey");

-- CreateIndex
CREATE INDEX "EventDecision_eventId_idx" ON "EventDecision"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_subjectId_periodStart_revision_rulesKey_key" ON "Settlement"("subjectId", "periodStart", "revision", "rulesKey");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementDecision_settlementId_actorId_key" ON "SettlementDecision"("settlementId", "actorId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletEntry_settlementId_asset_key" ON "WalletEntry"("settlementId", "asset");


CREATE UNIQUE INDEX "Settlement_posted_period" ON "Settlement"("subjectId", "periodStart") WHERE "postedAt" IS NOT NULL;
