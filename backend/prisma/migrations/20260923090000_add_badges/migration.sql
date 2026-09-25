
-- CreateEnum
CREATE TYPE "BadgeCode" AS ENUM ('FIRST_WIN', 'TEN_WINS', 'FIFTY_MATCHES', 'WIN_STREAK_3', 'TOURNAMENT_FINALIST', 'TOURNAMENT_CHAMPION', 'GIANT_SLAYER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bestWinStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentWinStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" "BadgeCode" NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_code_key" ON "UserBadge"("userId", "code");

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

