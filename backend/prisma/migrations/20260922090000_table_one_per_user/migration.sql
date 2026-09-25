-- Un utilisateur ne peut occuper qu'une seule table à la fois.
-- Index partiel : pas représentable dans schema.prisma, voir commentaire sur le modèle Table.
CREATE UNIQUE INDEX "Table_occupiedById_busy_key" ON "Table" ("occupiedById") WHERE "status" = 'BUSY';
