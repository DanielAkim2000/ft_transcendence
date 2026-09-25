-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('FREE', 'BUSY');

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TableStatus" NOT NULL DEFAULT 'FREE',
    "occupiedAt" TIMESTAMP(3),
    "occupiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Table_name_key" ON "Table"("name");

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_occupiedById_fkey" FOREIGN KEY ("occupiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
