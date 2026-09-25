-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('ONE_V_ONE', 'TWO_V_TWO');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'DECLINED', 'ACCEPTED', 'PENDING_VALIDATION', 'COMPLETED', 'DISPUTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "format" "MatchFormat" NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "teamAPlayer1Id" TEXT NOT NULL,
    "teamAPlayer2Id" TEXT,
    "teamBPlayer1Id" TEXT NOT NULL,
    "teamBPlayer2Id" TEXT,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "submittedById" TEXT,
    "validatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "validationExpiresAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_teamAPlayer1Id_idx" ON "Match"("teamAPlayer1Id");

-- CreateIndex
CREATE INDEX "Match_teamAPlayer2Id_idx" ON "Match"("teamAPlayer2Id");

-- CreateIndex
CREATE INDEX "Match_teamBPlayer1Id_idx" ON "Match"("teamBPlayer1Id");

-- CreateIndex
CREATE INDEX "Match_teamBPlayer2Id_idx" ON "Match"("teamBPlayer2Id");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamAPlayer1Id_fkey" FOREIGN KEY ("teamAPlayer1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamAPlayer2Id_fkey" FOREIGN KEY ("teamAPlayer2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamBPlayer1Id_fkey" FOREIGN KEY ("teamBPlayer1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamBPlayer2Id_fkey" FOREIGN KEY ("teamBPlayer2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
