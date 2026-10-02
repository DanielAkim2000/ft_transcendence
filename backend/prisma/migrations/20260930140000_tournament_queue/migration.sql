-- Tournois en file d'attente : un seul tournoi actif à la fois, les suivants attendent leur tour.
ALTER TYPE "TournamentStatus" ADD VALUE 'QUEUED';
ALTER TABLE "Tournament" ADD COLUMN "queuedAt" TIMESTAMP(3);

-- Réparation : une table ne doit rester réservée que par une rencontre en cours d'un tournoi en cours.
UPDATE "Table" t
SET "status" = 'FREE', "currentTournamentTieId" = NULL, "occupiedAt" = NULL
WHERE t."currentTournamentTieId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "TournamentTie" tt
    JOIN "Tournament" tr ON tr."id" = tt."tournamentId"
    WHERE tt."id" = t."currentTournamentTieId"
      AND tt."status" = 'IN_PROGRESS'
      AND tr."status" = 'IN_PROGRESS'
  );

-- Une table réservée par un tournoi est occupée (l'ancien code pouvait la remettre à FREE en gardant la réservation).
UPDATE "Table"
SET "status" = 'BUSY', "occupiedAt" = COALESCE("occupiedAt", NOW())
WHERE "currentTournamentTieId" IS NOT NULL AND "status" = 'FREE';
