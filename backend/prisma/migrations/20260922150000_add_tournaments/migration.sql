
-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentTieStatus" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "legNumber" INTEGER,
ADD COLUMN     "tableId" TEXT,
ADD COLUMN     "tournamentTieId" TEXT;

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "currentTournamentTieId" TEXT;

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" "MatchFormat" NOT NULL,
    "twoLegged" BOOLEAN NOT NULL DEFAULT false,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "totalRounds" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentEntry" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT,
    "eliminatedRound" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTie" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "entryAId" TEXT,
    "entryBId" TEXT,
    "status" "TournamentTieStatus" NOT NULL DEFAULT 'PENDING',
    "winnerEntryId" TEXT,
    "pointsAwarded" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentTie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentEntry_tournamentId_seed_key" ON "TournamentEntry"("tournamentId", "seed");

-- CreateIndex
CREATE INDEX "TournamentTie_tournamentId_status_idx" ON "TournamentTie"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTie_tournamentId_round_slot_key" ON "TournamentTie"("tournamentId", "round", "slot");

-- CreateIndex
CREATE INDEX "Match_tournamentTieId_idx" ON "Match"("tournamentTieId");

-- CreateIndex
CREATE UNIQUE INDEX "Table_currentTournamentTieId_key" ON "Table"("currentTournamentTieId");

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_currentTournamentTieId_fkey" FOREIGN KEY ("currentTournamentTieId") REFERENCES "TournamentTie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentTieId_fkey" FOREIGN KEY ("tournamentTieId") REFERENCES "TournamentTie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTie" ADD CONSTRAINT "TournamentTie_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTie" ADD CONSTRAINT "TournamentTie_entryAId_fkey" FOREIGN KEY ("entryAId") REFERENCES "TournamentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTie" ADD CONSTRAINT "TournamentTie_entryBId_fkey" FOREIGN KEY ("entryBId") REFERENCES "TournamentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTie" ADD CONSTRAINT "TournamentTie_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "TournamentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

