-- CreateEnum
CREATE TYPE "ChessColor" AS ENUM ('WHITE', 'BLACK');

-- CreateEnum
CREATE TYPE "ChessGameStatus" AS ENUM ('PENDING', 'DECLINED', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "ChessResult" AS ENUM ('WHITE_WIN', 'BLACK_WIN', 'DRAW', 'ABORTED');

-- CreateEnum
CREATE TYPE "ChessEndReason" AS ENUM ('CHECKMATE', 'RESIGNATION', 'TIMEOUT', 'STALEMATE', 'AGREEMENT', 'INSUFFICIENT_MATERIAL', 'THREEFOLD_REPETITION', 'FIFTY_MOVE_RULE', 'ABANDONED', 'ABORTED');

-- CreateTable
CREATE TABLE "ChessProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "peakRating" INTEGER NOT NULL DEFAULT 1200,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChessGame" (
    "id" TEXT NOT NULL,
    "status" "ChessGameStatus" NOT NULL DEFAULT 'PENDING',
    "challengerId" TEXT NOT NULL,
    "whitePlayerId" TEXT NOT NULL,
    "blackPlayerId" TEXT NOT NULL,
    "fen" TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    "turn" "ChessColor" NOT NULL DEFAULT 'WHITE',
    "moveCount" INTEGER NOT NULL DEFAULT 0,
    "positionHistory" TEXT[],
    "timeControlMs" INTEGER,
    "incrementMs" INTEGER NOT NULL DEFAULT 0,
    "whiteTimeMs" INTEGER,
    "blackTimeMs" INTEGER,
    "lastMoveAt" TIMESTAMP(3),
    "drawOfferedById" TEXT,
    "result" "ChessResult",
    "endReason" "ChessEndReason",
    "winnerId" TEXT,
    "pgn" TEXT,
    "rated" BOOLEAN NOT NULL DEFAULT true,
    "whiteRatingBefore" INTEGER,
    "blackRatingBefore" INTEGER,
    "whiteRatingDelta" INTEGER,
    "blackRatingDelta" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ChessGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChessMove" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ply" INTEGER NOT NULL,
    "color" "ChessColor" NOT NULL,
    "playerId" TEXT NOT NULL,
    "san" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "promotion" TEXT,
    "fenAfter" TEXT NOT NULL,
    "timeSpentMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChessMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChessProfile_userId_key" ON "ChessProfile"("userId");

-- CreateIndex
CREATE INDEX "ChessProfile_rating_idx" ON "ChessProfile"("rating");

-- CreateIndex
CREATE INDEX "ChessGame_whitePlayerId_status_idx" ON "ChessGame"("whitePlayerId", "status");

-- CreateIndex
CREATE INDEX "ChessGame_blackPlayerId_status_idx" ON "ChessGame"("blackPlayerId", "status");

-- CreateIndex
CREATE INDEX "ChessGame_status_updatedAt_idx" ON "ChessGame"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ChessGame_endedAt_idx" ON "ChessGame"("endedAt");

-- CreateIndex
CREATE INDEX "ChessMove_gameId_ply_idx" ON "ChessMove"("gameId", "ply");

-- CreateIndex
CREATE INDEX "ChessMove_playerId_idx" ON "ChessMove"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "ChessMove_gameId_ply_key" ON "ChessMove"("gameId", "ply");

-- AddForeignKey
ALTER TABLE "ChessProfile" ADD CONSTRAINT "ChessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChessGame" ADD CONSTRAINT "ChessGame_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChessGame" ADD CONSTRAINT "ChessGame_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChessGame" ADD CONSTRAINT "ChessGame_drawOfferedById_fkey" FOREIGN KEY ("drawOfferedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChessGame" ADD CONSTRAINT "ChessGame_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChessMove" ADD CONSTRAINT "ChessMove_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "ChessGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChessMove" ADD CONSTRAINT "ChessMove_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
