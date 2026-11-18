CREATE TABLE "RecordType" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "money" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RecordType_code_key" ON "RecordType"("code");
CREATE UNIQUE INDEX "RecordType_name_key" ON "RecordType"("name");
