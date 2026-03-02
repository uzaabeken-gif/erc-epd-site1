-- AlterTable
ALTER TABLE "Advertisement" ADD COLUMN "mediaPath" TEXT;
ALTER TABLE "Advertisement" ADD COLUMN "mediaType" TEXT;

-- CreateTable
CREATE TABLE "ContactInfo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "workHours" TEXT NOT NULL,
    "suppliersText" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
