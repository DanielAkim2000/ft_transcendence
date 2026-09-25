-- La queue n'a plus la notion de coequipier : inscription solo uniquement.
ALTER TABLE "QueueEntry" DROP CONSTRAINT "QueueEntry_teammateId_fkey";
ALTER TABLE "QueueEntry" DROP COLUMN "teammateId";
