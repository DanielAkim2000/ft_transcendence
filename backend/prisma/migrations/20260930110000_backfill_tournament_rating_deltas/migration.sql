-- Rattrapage : les points de tournoi des rencontres déjà terminées sont
-- inscrits sur la manche décisive (la dernière jouée) de chaque rencontre.
UPDATE "Match" m
SET "ratingDeltas" = (
  SELECT jsonb_object_agg(p.uid, t."pointsAwarded")
  FROM "TournamentTie" t
  JOIN "TournamentEntry" e ON e."id" = t."winnerEntryId"
  CROSS JOIN LATERAL (VALUES (e."player1Id"), (e."player2Id")) AS p(uid)
  WHERE t."id" = m."tournamentTieId" AND p.uid IS NOT NULL
)
FROM (
  SELECT DISTINCT ON ("tournamentTieId") "id"
  FROM "Match"
  WHERE "tournamentTieId" IS NOT NULL AND "status" = 'COMPLETED'
  ORDER BY "tournamentTieId", "legNumber" DESC, "updatedAt" DESC
) last_leg
WHERE m."id" = last_leg."id"
  AND m."ratingDeltas" IS NULL
  AND EXISTS (
    SELECT 1 FROM "TournamentTie" t
    WHERE t."id" = m."tournamentTieId"
      AND t."status" = 'DONE' AND t."pointsAwarded" IS NOT NULL
  );
