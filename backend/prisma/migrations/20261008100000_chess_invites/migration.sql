-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CHESS_INVITE';
ALTER TYPE "NotificationType" ADD VALUE 'CHESS_INVITE_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'CHESS_INVITE_DECLINED';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "chessGameId" TEXT;

-- CreateIndex
CREATE INDEX "Message_chessGameId_idx" ON "Message"("chessGameId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chessGameId_fkey" FOREIGN KEY ("chessGameId") REFERENCES "ChessGame"("id") ON DELETE SET NULL ON UPDATE CASCADE;
