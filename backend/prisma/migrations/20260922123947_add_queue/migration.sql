-- CreateEnum
CREATE TYPE "QueueEntryStatus" AS ENUM ('WAITING', 'CALLED', 'EXPIRED', 'CANCELLED', 'DONE');

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "teammateId" TEXT,
    "status" "QueueEntryStatus" NOT NULL DEFAULT 'WAITING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueEntry_tableId_status_joinedAt_idx" ON "QueueEntry"("tableId", "status", "joinedAt");

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_teammateId_fkey" FOREIGN KEY ("teammateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un utilisateur ne peut avoir qu'une seule entrée active (en tant que
-- demandeur) à la fois. Index partiel : pas représentable dans schema.prisma,
-- voir commentaire sur le modèle QueueEntry.
CREATE UNIQUE INDEX "QueueEntry_requester_active_key" ON "QueueEntry" ("requesterId") WHERE "status" IN ('WAITING', 'CALLED');
