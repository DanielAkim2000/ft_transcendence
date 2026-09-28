-- Refonte de la file : on passe d'un demandeur seul à des groupes (1 ou 2 joueurs)
-- qui occupent les 2 côtés d'une table. Les anciennes entrées sont supprimées.

-- Anciennes structures
DROP INDEX IF EXISTS "Table_occupiedById_busy_key";
DROP INDEX IF EXISTS "QueueEntry_requester_active_key";
DROP TABLE "QueueEntry";
DROP TYPE "QueueEntryStatus";

ALTER TABLE "Table" DROP CONSTRAINT "Table_occupiedById_fkey";
ALTER TABLE "Table" DROP COLUMN "occupiedById";
UPDATE "Table" SET "status" = 'FREE', "occupiedAt" = NULL WHERE "currentTournamentTieId" IS NULL;

-- Nouvelles colonnes de Table
ALTER TABLE "Table" ADD COLUMN "format" "MatchFormat";
ALTER TABLE "Table" ADD COLUMN "endRequestedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "QueueGroupStatus" AS ENUM ('INVITING', 'WAITING', 'CALLED', 'ON_TABLE', 'DONE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "QueueGroup" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "format" "MatchFormat" NOT NULL,
    "status" "QueueGroupStatus" NOT NULL DEFAULT 'INVITING',
    "slot" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRequester" BOOLEAN NOT NULL DEFAULT false,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "QueueGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableReleaseVote" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableReleaseVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueGroup_tableId_status_joinedAt_idx" ON "QueueGroup"("tableId", "status", "joinedAt");
CREATE INDEX "QueueGroupMember_userId_idx" ON "QueueGroupMember"("userId");
CREATE UNIQUE INDEX "QueueGroupMember_groupId_userId_key" ON "QueueGroupMember"("groupId", "userId");
CREATE UNIQUE INDEX "TableReleaseVote_tableId_userId_key" ON "TableReleaseVote"("tableId", "userId");

-- AddForeignKey
ALTER TABLE "QueueGroup" ADD CONSTRAINT "QueueGroup_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QueueGroupMember" ADD CONSTRAINT "QueueGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QueueGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QueueGroupMember" ADD CONSTRAINT "QueueGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableReleaseVote" ADD CONSTRAINT "TableReleaseVote_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableReleaseVote" ADD CONSTRAINT "TableReleaseVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un côté de table (0 ou 1) n'est occupé que par un seul groupe à la fois.
-- Index partiel : pas représentable dans schema.prisma, voir commentaire sur le modèle Table.
CREATE UNIQUE INDEX "QueueGroup_table_slot_on_table_key" ON "QueueGroup" ("tableId", "slot") WHERE "status" = 'ON_TABLE';

-- Un utilisateur ne peut appartenir qu'à un seul groupe actif à la fois.
CREATE UNIQUE INDEX "QueueGroupMember_user_active_key" ON "QueueGroupMember" ("userId") WHERE "active";
