import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  BadgeCode,
  FriendshipStatus,
  LanguagePreference,
  MatchFormat,
  MatchStatus,
  QueueGroupStatus,
  Role,
  TableStatus,
  ThemePreference,
  TournamentStatus,
  TournamentTieStatus,
} from '../src/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

// Ce script "reset & reseed" complètement les comptes de démo à chaque
// démarrage (RUN_SEED=true par défaut, cf. docker-entrypoint.sh) : on
// supprime les 10 utilisateurs de démo (les cascades du schéma nettoient
// tout ce qui leur appartient : matchs, tournois, conversations, badges,
// amitiés...) puis on reconstruit un jeu de données complet et cohérent
// (ranking, historique de matchs, tournois, badges, chat, tables/queue).
// Le but : qu'un simple `docker compose up` donne une appli qui a déjà
// l'air vivante, pas une base vide avec 3 comptes sans historique.

const SEED_PASSWORD = 'Test1234!';

// --- Constantes copiées des services (backend/src/matches/lib/elo.ts et
// backend/src/badges/lib/xp.ts) pour que rating/xp/badges simulés ici
// correspondent exactement à ce que produirait l'appli en vrai jeu.
const K_NEW_PLAYER = 40;
const K_ESTABLISHED = 20;
const NEW_PLAYER_MATCH_THRESHOLD = 10;
const XP_PER_MATCH_PLAYED = 10;
const XP_PER_MATCH_WIN_BONUS = 20;
const XP_PER_TOURNAMENT_WIN_BONUS = 50;
const GIANT_SLAYER_RATING_GAP = 150;

/** Facteur K d'Elo : 40 pour un joueur de moins de 10 matchs, 20 sinon (même règle que matches/lib/elo.ts). */
function kFactor(matchesPlayed) {
  return matchesPlayed < NEW_PLAYER_MATCH_THRESHOLD
    ? K_NEW_PLAYER
    : K_ESTABLISHED;
}
/** Probabilité de victoire attendue d'une équipe face à une autre selon la formule Elo. */
function expectedScore(teamRating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - teamRating) / 400));
}
/** Moyenne d'un tableau de nombres (notes d'une équipe). */
function avg(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const now = new Date();
/** Date située il y a `days` jours à l'heure donnée (minutes variables pour éviter des horaires identiques). */
function daysAgo(days, hour = 12) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(hour, (days * 7) % 60, 0, 0);
  return d;
}
/** Date située il y a `minutes` minutes. */
function minutesAgo(minutes) {
  return new Date(now.getTime() - minutes * 60_000);
}
/** Date située dans `minutes` minutes. */
function minutesFromNow(minutes) {
  return new Date(now.getTime() + minutes * 60_000);
}

const users = [
  {
    id: 'seed_admin',
    email: 'admin@ft.local',
    displayname: 'Admin',
    role: 'ADMIN',
  },
  {
    id: 'seed_alice',
    email: 'alice@ft.local',
    displayname: 'Alice Martin',
    role: 'USER',
  },
  {
    id: 'seed_bob',
    email: 'bob@ft.local',
    displayname: 'Bob Dupont',
    role: 'USER',
  },
  {
    id: 'seed_charlie',
    email: 'charlie@ft.local',
    displayname: 'Charlie Nguyen',
    role: 'USER',
  },
  {
    id: 'seed_diana',
    email: 'diana@ft.local',
    displayname: 'Diana Rossi',
    role: 'USER',
  },
  {
    id: 'seed_ewan',
    email: 'ewan@ft.local',
    displayname: 'Ewan Keller',
    role: 'USER',
    login42: 'ekeller',
  },
  {
    id: 'seed_fatima',
    email: 'fatima@ft.local',
    displayname: 'Fatima Haddad',
    role: 'USER',
  },
  {
    id: 'seed_gabriel',
    email: 'gabriel@ft.local',
    displayname: 'Gabriel Silva',
    role: 'USER',
  },
  {
    id: 'seed_helena',
    email: 'helena@ft.local',
    displayname: 'Helena Petrova',
    role: 'USER',
  },
  {
    id: 'seed_ivan',
    email: 'ivan@ft.local',
    displayname: 'Ivan Novak',
    role: 'USER',
  },
];

const THEMES = ['light', 'dark', 'system'];
const LANGUAGES = ['en', 'fr', 'es'];

const tables = [
  { id: 'table_a', name: 'Baby A' },
  { id: 'table_b', name: 'Baby B' },
];

// --- Moteur de simulation (rejoue exactement la logique métier réelle) ---

/** Crée les statistiques initiales simulées d'un joueur (note 1000, 0 match, 0 XP, aucun badge). */
function makeStats(id) {
  return {
    id,
    rating: 1000,
    matchesPlayed: 0,
    wins: 0,
    xp: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    badges: new Map(), // code -> Date
  };
}

const stats = {};
for (const u of users) stats[u.id] = makeStats(u.id);

/** Attribue un badge simulé au joueur à la date donnée, sans écraser un badge déjà obtenu. */
function awardBadge(user, code, at) {
  if (!user.badges.has(code)) user.badges.set(code, at);
}

/** Attribue les badges de jalons simulés (première victoire, 10 victoires, 50 matchs, série de 3). */
function checkMilestones(user, at) {
  if (user.wins >= 1) awardBadge(user, 'FIRST_WIN', at);
  if (user.wins >= 10) awardBadge(user, 'TEN_WINS', at);
  if (user.matchesPlayed >= 50) awardBadge(user, 'FIFTY_MATCHES', at);
  if (user.currentWinStreak >= 3) awardBadge(user, 'WIN_STREAK_3', at);
}

const matches: any[] = []; // lignes prêtes à insérer dans "Match"
let matchSeq = 0;
/** Génère l'identifiant suivant des matchs de démo (seed_match_1, seed_match_2, …). */
function nextMatchId() {
  matchSeq += 1;
  return `seed_match_${matchSeq}`;
}

/**
 * Simule un match complet (ladder 1v1/2v2 ou manche de tournoi) et pousse la
 * ligne "Match" correspondante. teamAIds/teamBIds = tableaux de userId
 * (longueur 1 ou 2). Le camp au score le plus haut gagne.
 */
function playMatch({
  teamAIds,
  teamBIds,
  scoreA,
  scoreB,
  at,
  format = 'ONE_V_ONE',
  isTournamentLeg = false,
  tournamentTieId = null as string | null,
  legNumber = null as number | null,
  tableId = null as string | null,
}) {
  const teamA = teamAIds.map((id) => stats[id]);
  const teamB = teamBIds.map((id) => stats[id]);
  const winnerSide = scoreA > scoreB ? 'A' : 'B';

  const ratingBefore = new Map();
  [...teamA, ...teamB].forEach((u) => ratingBefore.set(u.id, u.rating));

  const teamARating = avg(teamA.map((u) => u.rating));
  const teamBRating = avg(teamB.map((u) => u.rating));
  const expectedA = expectedScore(teamARating, teamBRating);
  const expectedB = 1 - expectedA;
  const outcomeA = winnerSide === 'A' ? 1 : 0;
  const outcomeB = 1 - outcomeA;

  // L'Elo ne s'applique jamais aux manches de tournoi : le rating y est géré
  // par un bonus fixe par tour (10 * round), appliqué par le code appelant.
  if (!isTournamentLeg) {
    teamA.forEach((u) => {
      u.rating = Math.round(
        u.rating + kFactor(u.matchesPlayed) * (outcomeA - expectedA),
      );
    });
    teamB.forEach((u) => {
      u.rating = Math.round(
        u.rating + kFactor(u.matchesPlayed) * (outcomeB - expectedB),
      );
    });
  }

  const winners = winnerSide === 'A' ? teamA : teamB;
  const losers = winnerSide === 'A' ? teamB : teamA;

  winners.forEach((u) => {
    u.matchesPlayed += 1;
    u.wins += 1;
    u.xp += XP_PER_MATCH_PLAYED + XP_PER_MATCH_WIN_BONUS;
    u.currentWinStreak += 1;
    u.bestWinStreak = Math.max(u.bestWinStreak, u.currentWinStreak);
  });
  losers.forEach((u) => {
    u.matchesPlayed += 1;
    u.xp += XP_PER_MATCH_PLAYED;
    u.currentWinStreak = 0;
  });

  if (!isTournamentLeg) {
    const loserAvgBefore = avg(losers.map((u) => ratingBefore.get(u.id)));
    const winnerAvgBefore = avg(winners.map((u) => ratingBefore.get(u.id)));
    if (loserAvgBefore - winnerAvgBefore >= GIANT_SLAYER_RATING_GAP) {
      winners.forEach((u) => awardBadge(u, 'GIANT_SLAYER', at));
    }
  }

  [...winners, ...losers].forEach((u) => checkMilestones(u, at));

  const id = nextMatchId();
  matches.push({
    id,
    format,
    status: 'COMPLETED',
    teamAPlayer1Id: teamAIds[0],
    teamAPlayer2Id: teamAIds[1] ?? null,
    teamBPlayer1Id: teamBIds[0],
    teamBPlayer2Id: teamBIds[1] ?? null,
    scoreA,
    scoreB,
    submittedById: teamAIds[0],
    validatedById: teamBIds[0],
    tournamentTieId,
    legNumber,
    tableId,
    createdAt: at,
    respondedAt: at,
    submittedAt: at,
    validationExpiresAt: null,
  });
  return { id, winnerEntrySide: winnerSide };
}

// --- Historique ladder (1v1), du plus ancien au plus récent : 23 matchs qui
// dessinent un vrai classement (Alice en forme, Bob solide, Ewan/Ivan
// débutants qui galèrent, etc.) avant même le tournoi.
const LADDER_RESULTS = [
  ['seed_alice', 'seed_ivan', 10, 3],
  ['seed_bob', 'seed_charlie', 10, 7],
  ['seed_diana', 'seed_ewan', 10, 9],
  ['seed_gabriel', 'seed_fatima', 10, 5],
  ['seed_helena', 'seed_ivan', 10, 6],
  ['seed_alice', 'seed_bob', 10, 8],
  ['seed_charlie', 'seed_diana', 10, 9],
  ['seed_gabriel', 'seed_helena', 10, 4],
  ['seed_fatima', 'seed_ewan', 10, 9],
  ['seed_alice', 'seed_charlie', 10, 2],
  ['seed_bob', 'seed_ivan', 10, 5],
  ['seed_diana', 'seed_fatima', 10, 8],
  ['seed_gabriel', 'seed_ewan', 10, 6],
  ['seed_helena', 'seed_charlie', 10, 9],
  ['seed_alice', 'seed_diana', 10, 7],
  ['seed_bob', 'seed_gabriel', 10, 9],
  ['seed_fatima', 'seed_helena', 10, 9],
  ['seed_alice', 'seed_ewan', 10, 3],
  ['seed_gabriel', 'seed_diana', 10, 8],
  ['seed_bob', 'seed_fatima', 10, 6],
  ['seed_alice', 'seed_helena', 10, 5],
  ['seed_charlie', 'seed_ivan', 10, 9],
  ['seed_alice', 'seed_gabriel', 10, 9],
];

LADDER_RESULTS.forEach(([a, b, scoreA, scoreB], index) => {
  playMatch({
    teamAIds: [a],
    teamBIds: [b],
    scoreA,
    scoreB,
    at: daysAgo(28 - index),
  });
});

// --- Tournoi 1 : 1v1, 8 joueurs, terminé (aller simple). Champion : Alice.
// Finaliste : Gabriel. Reproduit exactement le seedage de bracket réel :
// tour 1 -> demies -> finale, avec bonus de points fixes (10 * round) et
// badges TOURNAMENT_FINALIST / TOURNAMENT_CHAMPION.
const T1_ENTRY_ORDER = [
  'seed_alice',
  'seed_ivan',
  'seed_bob',
  'seed_charlie',
  'seed_diana',
  'seed_ewan',
  'seed_fatima',
  'seed_gabriel',
];
const tournament1: any = {
  id: 'seed_tournament_1',
  name: 'Coupe de la Rentrée',
  format: 'ONE_V_ONE',
  twoLegged: false,
  status: 'COMPLETED',
  totalRounds: 3,
  createdById: 'seed_admin',
  createdAt: daysAgo(6),
  startedAt: daysAgo(5),
  completedAt: daysAgo(3),
  entries: T1_ENTRY_ORDER.map((playerId, seed) => ({
    id: `seed_te1_${seed}`,
    seed,
    player1Id: playerId,
    player2Id: null,
  })),
  ties: [],
};
const t1EntryByPlayer = Object.fromEntries(
  tournament1.entries.map((e) => [e.player1Id, e]),
);

/** Simule une rencontre de tournoi 1v1 en une manche : joue le match, ajoute le bonus de points du tour (10 × tour) au vainqueur et retourne la ligne « TournamentTie » à insérer. */
function tournamentTie1v1({
  tournamentId,
  round,
  slot,
  entryA,
  entryB,
  scoreA,
  scoreB,
  at,
  tableId,
}) {
  const points = 10 * round;
  const { id: legId, winnerEntrySide } = playMatch({
    teamAIds: [entryA.player1Id],
    teamBIds: [entryB.player1Id],
    scoreA,
    scoreB,
    at,
    isTournamentLeg: true,
    tournamentTieId: `seed_tie_${tournamentId}_${round}_${slot}`,
    legNumber: 1,
    tableId,
  });
  const winnerEntry = winnerEntrySide === 'A' ? entryA : entryB;
  stats[winnerEntry.player1Id].rating += points;
  return {
    id: `seed_tie_${tournamentId}_${round}_${slot}`,
    tournamentId,
    round,
    slot,
    entryAId: entryA.id,
    entryBId: entryB.id,
    status: 'DONE',
    winnerEntryId: winnerEntry.id,
    pointsAwarded: points,
    legId,
    createdAt: at,
  };
}

// Round 1 (slots 0-3)
const t1r1s0 = tournamentTie1v1({
  tournamentId: '1',
  round: 1,
  slot: 0,
  entryA: t1EntryByPlayer['seed_alice'],
  entryB: t1EntryByPlayer['seed_ivan'],
  scoreA: 10,
  scoreB: 2,
  at: daysAgo(5),
  tableId: 'table_a',
});
const t1r1s1 = tournamentTie1v1({
  tournamentId: '1',
  round: 1,
  slot: 1,
  entryA: t1EntryByPlayer['seed_bob'],
  entryB: t1EntryByPlayer['seed_charlie'],
  scoreA: 10,
  scoreB: 6,
  at: daysAgo(5),
  tableId: 'table_b',
});
const t1r1s2 = tournamentTie1v1({
  tournamentId: '1',
  round: 1,
  slot: 2,
  entryA: t1EntryByPlayer['seed_diana'],
  entryB: t1EntryByPlayer['seed_ewan'],
  scoreA: 10,
  scoreB: 7,
  at: daysAgo(5),
  tableId: 'table_a',
});
const t1r1s3 = tournamentTie1v1({
  tournamentId: '1',
  round: 1,
  slot: 3,
  entryA: t1EntryByPlayer['seed_fatima'],
  entryB: t1EntryByPlayer['seed_gabriel'],
  scoreA: 8,
  scoreB: 10,
  at: daysAgo(5),
  tableId: 'table_b',
});
// Round 2 (demies) : gagnant slot0+slot1 -> slot0, gagnant slot2+slot3 -> slot1
const winnerEntry = (tie, a, b) => (tie.winnerEntryId === a.id ? a : b);
const t1r2s0 = tournamentTie1v1({
  tournamentId: '1',
  round: 2,
  slot: 0,
  entryA: winnerEntry(
    t1r1s0,
    t1EntryByPlayer['seed_alice'],
    t1EntryByPlayer['seed_ivan'],
  ),
  entryB: winnerEntry(
    t1r1s1,
    t1EntryByPlayer['seed_bob'],
    t1EntryByPlayer['seed_charlie'],
  ),
  scoreA: 10,
  scoreB: 7,
  at: daysAgo(4),
  tableId: 'table_a',
});
const t1r2s1 = tournamentTie1v1({
  tournamentId: '1',
  round: 2,
  slot: 1,
  entryA: winnerEntry(
    t1r1s2,
    t1EntryByPlayer['seed_diana'],
    t1EntryByPlayer['seed_ewan'],
  ),
  entryB: winnerEntry(
    t1r1s3,
    t1EntryByPlayer['seed_fatima'],
    t1EntryByPlayer['seed_gabriel'],
  ),
  scoreA: 7,
  scoreB: 10,
  at: daysAgo(4),
  tableId: 'table_b',
});
// Finale
const t1r3s0 = tournamentTie1v1({
  tournamentId: '1',
  round: 3,
  slot: 0,
  entryA: winnerEntry(
    t1r2s0,
    winnerEntry(
      t1r1s0,
      t1EntryByPlayer['seed_alice'],
      t1EntryByPlayer['seed_ivan'],
    ),
    winnerEntry(
      t1r1s1,
      t1EntryByPlayer['seed_bob'],
      t1EntryByPlayer['seed_charlie'],
    ),
  ),
  entryB: winnerEntry(
    t1r2s1,
    winnerEntry(
      t1r1s2,
      t1EntryByPlayer['seed_diana'],
      t1EntryByPlayer['seed_ewan'],
    ),
    winnerEntry(
      t1r1s3,
      t1EntryByPlayer['seed_fatima'],
      t1EntryByPlayer['seed_gabriel'],
    ),
  ),
  scoreA: 10,
  scoreB: 9,
  at: daysAgo(3),
  tableId: 'table_a',
});
stats['seed_alice'].xp += XP_PER_TOURNAMENT_WIN_BONUS;
awardBadge(stats['seed_alice'], 'TOURNAMENT_CHAMPION', daysAgo(3));
awardBadge(stats['seed_alice'], 'TOURNAMENT_FINALIST', daysAgo(3));
awardBadge(stats['seed_gabriel'], 'TOURNAMENT_FINALIST', daysAgo(3));
tournament1.ties = [t1r1s0, t1r1s1, t1r1s2, t1r1s3, t1r2s0, t1r2s1, t1r3s0];
tournament1.championEntryId = t1r3s0.winnerEntryId;

// --- Tournoi 2 : 2v2, 4 équipes, EN COURS. Une demie déjà jouée
// (Bob+Charlie qualifiés), l'autre encore à jouer (READY), la finale est une
// coquille vide (PENDING) créée d'avance comme le fait le vrai lancement.
const tournament2: any = {
  id: 'seed_tournament_2',
  name: 'Duo Masters',
  format: 'TWO_V_TWO',
  twoLegged: false,
  status: 'IN_PROGRESS',
  totalRounds: 2,
  createdById: 'seed_admin',
  createdAt: daysAgo(3),
  startedAt: daysAgo(2),
  completedAt: null,
  entries: [
    {
      id: 'seed_te2_0',
      seed: 0,
      player1Id: 'seed_bob',
      player2Id: 'seed_charlie',
    },
    {
      id: 'seed_te2_1',
      seed: 1,
      player1Id: 'seed_diana',
      player2Id: 'seed_ewan',
    },
    {
      id: 'seed_te2_2',
      seed: 2,
      player1Id: 'seed_fatima',
      player2Id: 'seed_helena',
    },
    {
      id: 'seed_te2_3',
      seed: 3,
      player1Id: 'seed_gabriel',
      player2Id: 'seed_ivan',
    },
  ],
  ties: [],
};
const { id: t2LegId, winnerEntrySide: t2WinnerSide } = playMatch({
  teamAIds: ['seed_bob', 'seed_charlie'],
  teamBIds: ['seed_diana', 'seed_ewan'],
  scoreA: 10,
  scoreB: 9,
  at: daysAgo(2),
  format: 'TWO_V_TWO',
  isTournamentLeg: true,
  tournamentTieId: 'seed_tie_2_1_0',
  legNumber: 1,
  tableId: 'table_a',
});
const t2r1s0Points = 10 * 1;
stats['seed_bob'].rating += t2r1s0Points;
stats['seed_charlie'].rating += t2r1s0Points;
tournament2.ties = [
  {
    id: 'seed_tie_2_1_0',
    tournamentId: '2',
    round: 1,
    slot: 0,
    entryAId: 'seed_te2_0',
    entryBId: 'seed_te2_1',
    status: 'DONE',
    winnerEntryId: t2WinnerSide === 'A' ? 'seed_te2_0' : 'seed_te2_1',
    pointsAwarded: t2r1s0Points,
    legId: t2LegId,
    createdAt: daysAgo(2),
  },
  {
    id: 'seed_tie_2_1_1',
    tournamentId: '2',
    round: 1,
    slot: 1,
    entryAId: 'seed_te2_2',
    entryBId: 'seed_te2_3',
    status: 'READY',
    winnerEntryId: null,
    pointsAwarded: null,
    legId: null,
    createdAt: daysAgo(2),
  },
  {
    id: 'seed_tie_2_2_0',
    tournamentId: '2',
    round: 2,
    slot: 0,
    entryAId: null,
    entryBId: null,
    status: 'PENDING',
    winnerEntryId: null,
    pointsAwarded: null,
    legId: null,
    createdAt: daysAgo(2),
  },
];

// --- Tournoi 3 : DRAFT, ouvert aux inscriptions (5 entrées : pas encore une
// puissance de 2, donc pas lançable en l'état -> montre le message d'attente
// dans l'UI admin).
const tournament3: any = {
  id: 'seed_tournament_3',
  name: 'Winter Cup',
  format: 'ONE_V_ONE',
  twoLegged: false,
  status: 'DRAFT',
  totalRounds: null,
  createdById: 'seed_admin',
  createdAt: minutesAgo(90),
  startedAt: null,
  completedAt: null,
  entries: [
    { id: 'seed_te3_0', seed: 0, player1Id: 'seed_admin', player2Id: null },
    { id: 'seed_te3_1', seed: 1, player1Id: 'seed_ivan', player2Id: null },
    { id: 'seed_te3_2', seed: 2, player1Id: 'seed_charlie', player2Id: null },
    { id: 'seed_te3_3', seed: 3, player1Id: 'seed_diana', player2Id: null },
    { id: 'seed_te3_4', seed: 4, player1Id: 'seed_ewan', player2Id: null },
  ],
  ties: [],
};

// --- Rebondissement du jour : Helena (outsider) fait tomber Alice (championne
// en pleine série de victoires) -> déclenche le badge GIANT_SLAYER.
playMatch({
  teamAIds: ['seed_helena'],
  teamBIds: ['seed_alice'],
  scoreA: 10,
  scoreB: 8,
  at: daysAgo(1),
});

// --- Quelques matchs non terminés "en ce moment" pour montrer tous les
// statuts possibles sur le Ranking (PENDING/ACCEPTED/PENDING_VALIDATION/
// DISPUTED/DECLINED) sans qu'ils touchent aux stats agrégées.
const liveMatches = [
  {
    id: nextMatchId(),
    format: 'ONE_V_ONE',
    status: 'PENDING',
    teamAPlayer1Id: 'seed_alice',
    teamAPlayer2Id: null,
    teamBPlayer1Id: 'seed_charlie',
    teamBPlayer2Id: null,
    scoreA: null,
    scoreB: null,
    submittedById: null,
    validatedById: null,
    tournamentTieId: null,
    legNumber: null,
    tableId: null,
    createdAt: minutesAgo(10),
    respondedAt: null,
    submittedAt: null,
    validationExpiresAt: null,
  },
  {
    id: nextMatchId(),
    format: 'ONE_V_ONE',
    status: 'ACCEPTED',
    teamAPlayer1Id: 'seed_bob',
    teamAPlayer2Id: null,
    teamBPlayer1Id: 'seed_gabriel',
    teamBPlayer2Id: null,
    scoreA: null,
    scoreB: null,
    submittedById: null,
    validatedById: null,
    tournamentTieId: null,
    legNumber: null,
    tableId: null,
    createdAt: minutesAgo(60),
    respondedAt: minutesAgo(50),
    submittedAt: null,
    validationExpiresAt: null,
  },
  {
    id: nextMatchId(),
    format: 'ONE_V_ONE',
    status: 'PENDING_VALIDATION',
    teamAPlayer1Id: 'seed_diana',
    teamAPlayer2Id: null,
    teamBPlayer1Id: 'seed_fatima',
    teamBPlayer2Id: null,
    scoreA: 10,
    scoreB: 7,
    submittedById: 'seed_diana',
    validatedById: null,
    tournamentTieId: null,
    legNumber: null,
    tableId: null,
    createdAt: minutesAgo(45),
    respondedAt: minutesAgo(40),
    submittedAt: minutesAgo(30),
    validationExpiresAt: minutesFromNow(60 * 24 - 30),
  },
  {
    id: nextMatchId(),
    format: 'ONE_V_ONE',
    status: 'DISPUTED',
    teamAPlayer1Id: 'seed_ewan',
    teamAPlayer2Id: null,
    teamBPlayer1Id: 'seed_helena',
    teamBPlayer2Id: null,
    scoreA: 10,
    scoreB: 9,
    submittedById: 'seed_ewan',
    validatedById: null,
    tournamentTieId: null,
    legNumber: null,
    tableId: null,
    createdAt: minutesAgo(120),
    respondedAt: minutesAgo(115),
    submittedAt: minutesAgo(90),
    validationExpiresAt: minutesFromNow(60 * 24 - 90),
  },
  {
    id: nextMatchId(),
    format: 'ONE_V_ONE',
    status: 'DECLINED',
    teamAPlayer1Id: 'seed_admin',
    teamAPlayer2Id: null,
    teamBPlayer1Id: 'seed_ivan',
    teamBPlayer2Id: null,
    scoreA: null,
    scoreB: null,
    submittedById: null,
    validatedById: null,
    tournamentTieId: null,
    legNumber: null,
    tableId: null,
    createdAt: minutesAgo(200),
    respondedAt: minutesAgo(190),
    submittedAt: null,
    validationExpiresAt: null,
  },
];
matches.push(...liveMatches);

// --- Amitiés : un petit graphe social avec des accepted + des pending dans
// les deux sens (pour que la bannière "demandes en attente" de la page
// d'accueil ait quelque chose à montrer côté Alice).
const friendships = [
  {
    id: 'seed_fr_1',
    requesterId: 'seed_alice',
    addresseeId: 'seed_bob',
    status: 'ACCEPTED',
  },
  {
    id: 'seed_fr_2',
    requesterId: 'seed_alice',
    addresseeId: 'seed_admin',
    status: 'ACCEPTED',
  },
  {
    id: 'seed_fr_3',
    requesterId: 'seed_bob',
    addresseeId: 'seed_charlie',
    status: 'ACCEPTED',
  },
  {
    id: 'seed_fr_4',
    requesterId: 'seed_helena',
    addresseeId: 'seed_ivan',
    status: 'ACCEPTED',
  },
  {
    id: 'seed_fr_5',
    requesterId: 'seed_fatima',
    addresseeId: 'seed_ewan',
    status: 'ACCEPTED',
  },
  {
    id: 'seed_fr_6',
    requesterId: 'seed_alice',
    addresseeId: 'seed_diana',
    status: 'PENDING',
  },
  {
    id: 'seed_fr_7',
    requesterId: 'seed_gabriel',
    addresseeId: 'seed_alice',
    status: 'PENDING',
  },
  {
    id: 'seed_fr_8',
    requesterId: 'seed_charlie',
    addresseeId: 'seed_diana',
    status: 'PENDING',
  },
];

// --- Conversations + messages : historique réaliste, avec un message non lu
// pour Alice (bannière "messages récents" sur l'accueil).
const conversations = [
  {
    id: 'seed_conv_1',
    userAId: 'seed_alice',
    userBId: 'seed_bob',
    userALastReadAt: minutesAgo(15),
    userBLastReadAt: minutesAgo(1),
    createdAt: daysAgo(6),
    messages: [
      {
        senderId: 'seed_alice',
        content: 'GG pour le match hier, bien joué !',
        at: minutesAgo(30),
      },
      {
        senderId: 'seed_bob',
        content: 'Merci ! Revanche demain à la pause ?',
        at: minutesAgo(20),
      },
      {
        senderId: 'seed_alice',
        content: 'Carrément, je réserve la Baby A',
        at: minutesAgo(15),
      },
      {
        senderId: 'seed_bob',
        content: "Nickel, à tout à l'heure 🏓",
        at: minutesAgo(1),
      },
    ],
  },
  {
    id: 'seed_conv_2',
    userAId: 'seed_alice',
    userBId: 'seed_admin',
    userALastReadAt: daysAgo(2),
    userBLastReadAt: daysAgo(2),
    createdAt: daysAgo(6),
    messages: [
      {
        senderId: 'seed_admin',
        content: 'Bravo pour la Coupe de la Rentrée !',
        at: daysAgo(3, 18),
      },
      {
        senderId: 'seed_alice',
        content: 'Merci, la finale contre Gabriel était serrée',
        at: daysAgo(2),
      },
    ],
  },
  {
    id: 'seed_conv_3',
    userAId: 'seed_bob',
    userBId: 'seed_charlie',
    userALastReadAt: daysAgo(1),
    userBLastReadAt: daysAgo(1),
    createdAt: daysAgo(5),
    messages: [
      {
        senderId: 'seed_charlie',
        content: 'Tu joues le Duo Masters avec moi ?',
        at: daysAgo(3),
      },
      {
        senderId: 'seed_bob',
        content: 'Direct, on va les défoncer',
        at: daysAgo(3, 9),
      },
      {
        senderId: 'seed_charlie',
        content: 'On a gagné le premier tour !',
        at: daysAgo(1),
      },
    ],
  },
  {
    id: 'seed_conv_4',
    userAId: 'seed_helena',
    userBId: 'seed_ivan',
    userALastReadAt: minutesAgo(5),
    userBLastReadAt: minutesAgo(5),
    createdAt: daysAgo(4),
    messages: [
      {
        senderId: 'seed_ivan',
        content: 'Des conseils pour progresser au babyfoot ?',
        at: minutesAgo(10),
      },
      {
        senderId: 'seed_helena',
        content: 'Travaille ta passe latérale, ça change tout',
        at: minutesAgo(5),
      },
    ],
  },
];

const blocks = [
  { id: 'seed_block_1', blockerId: 'seed_charlie', blockedId: 'seed_ivan' },
];

// --- Tables + file : Baby A a un match 1v1 en cours (bob vs charlie) avec deux
// groupes en file (diana puis ewan) ; Baby B est vide mais fatima y a été
// appelée (à confirmer).
const tableStates = [
  {
    id: 'table_a',
    status: 'BUSY',
    format: 'ONE_V_ONE',
    occupiedAt: minutesAgo(12),
  },
  { id: 'table_b', status: 'FREE', format: 'ONE_V_ONE', occupiedAt: null },
];

const queueGroups = [
  {
    id: 'seed_qg_1',
    tableId: 'table_a',
    userId: 'seed_bob',
    status: 'ON_TABLE',
    slot: 0,
    joinedAt: minutesAgo(14),
    calledAt: null,
    expiresAt: null,
  },
  {
    id: 'seed_qg_2',
    tableId: 'table_a',
    userId: 'seed_charlie',
    status: 'ON_TABLE',
    slot: 1,
    joinedAt: minutesAgo(13),
    calledAt: null,
    expiresAt: null,
  },
  {
    id: 'seed_qg_3',
    tableId: 'table_a',
    userId: 'seed_diana',
    status: 'WAITING',
    slot: null,
    joinedAt: minutesAgo(5),
    calledAt: null,
    expiresAt: null,
  },
  {
    id: 'seed_qg_4',
    tableId: 'table_a',
    userId: 'seed_ewan',
    status: 'WAITING',
    slot: null,
    joinedAt: minutesAgo(2),
    calledAt: null,
    expiresAt: null,
  },
  {
    id: 'seed_qg_5',
    tableId: 'table_b',
    userId: 'seed_fatima',
    status: 'CALLED',
    slot: null,
    joinedAt: minutesAgo(8),
    calledAt: minutesAgo(2),
    expiresAt: minutesFromNow(3),
  },
];

/** Reconstruit en une transaction tout le jeu de données de démo (utilisateurs, amis, tables, matchs, tournois, file d'attente, chat, badges), en repartant d'une base propre pour les comptes de démo. */
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    const seedUserIds = users.map((u) => u.id);

    // Tout dans une seule transaction : soit le jeu de démo est reconstruit
    // en entier, soit rien ne change.
    await prisma.$transaction(
      async (tx) => {
        // Repart d'une base propre pour tous les comptes de démo : les
        // cascades du schéma (Match, Friendship, Conversation/Message,
        // UserBadge, Tournament -> Entry/Tie -> Match, QueueGroupMember...)
        // suppriment tout ce qui en dépend.
        await tx.user.deleteMany({ where: { id: { in: seedUserIds } } });

        // Exactement deux tables : on supprime celles d'un ancien seed
        // (les matchs qui y pointaient passent à tableId NULL).
        await tx.table.deleteMany({
          where: { id: { notIn: tables.map((t) => t.id) } },
        });

        // Deux tables de baby-foot, créées si absentes puis remises à FREE
        // (le statut BUSY resterait figé sinon).
        for (const table of tables) {
          await tx.table.upsert({
            where: { id: table.id },
            create: { id: table.id, name: table.name },
            update: {
              status: TableStatus.FREE,
              format: null,
              occupiedAt: null,
              endRequestedAt: null,
              currentTournamentTieId: null,
            },
          });
        }

        await tx.user.createMany({
          data: users.map((user) => {
            const s = stats[user.id];
            return {
              id: user.id,
              email: user.email,
              displayname: user.displayname,
              role: user.role as Role,
              passwordHash,
              login42: user.login42 ?? null,
              theme: THEMES[
                Math.abs(hashCode(user.id)) % THEMES.length
              ] as ThemePreference,
              language: LANGUAGES[
                Math.abs(hashCode(user.id + 'l')) % LANGUAGES.length
              ] as LanguagePreference,
              rating: s.rating,
              matchesPlayed: s.matchesPlayed,
              wins: s.wins,
              xp: s.xp,
              currentWinStreak: s.currentWinStreak,
              bestWinStreak: s.bestWinStreak,
              avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(user.displayname)}`,
            };
          }),
        });

        await tx.friendship.createMany({
          data: friendships.map((f) => ({
            id: f.id,
            requesterId: f.requesterId,
            addresseeId: f.addresseeId,
            status: f.status as FriendshipStatus,
          })),
        });

        for (const conv of conversations) {
          await tx.conversation.create({
            data: {
              id: conv.id,
              userAId: conv.userAId,
              userBId: conv.userBId,
              userALastReadAt: conv.userALastReadAt,
              userBLastReadAt: conv.userBLastReadAt,
              createdAt: conv.createdAt,
              messages: {
                create: conv.messages.map((msg, index) => ({
                  id: `${conv.id}_msg_${index + 1}`,
                  senderId: msg.senderId,
                  content: msg.content,
                  createdAt: msg.at,
                })),
              },
            },
          });
        }

        await tx.block.createMany({ data: blocks });

        // Tournament -> Entry -> Tie doivent exister avant les manches
        // ("Match") de tournoi, qui pointent vers leur tie via FK.
        for (const tournament of [tournament1, tournament2, tournament3]) {
          await tx.tournament.create({
            data: {
              id: tournament.id,
              name: tournament.name,
              format: tournament.format as MatchFormat,
              twoLegged: tournament.twoLegged,
              status: tournament.status as TournamentStatus,
              totalRounds: tournament.totalRounds,
              createdById: tournament.createdById,
              createdAt: tournament.createdAt,
              startedAt: tournament.startedAt,
              completedAt: tournament.completedAt,
            },
          });
          await tx.tournamentEntry.createMany({
            data: tournament.entries.map((entry) => ({
              id: entry.id,
              tournamentId: tournament.id,
              seed: entry.seed,
              player1Id: entry.player1Id,
              player2Id: entry.player2Id,
            })),
          });
          await tx.tournamentTie.createMany({
            data: tournament.ties.map((tie) => ({
              id: tie.id,
              tournamentId: tournament.id,
              round: tie.round,
              slot: tie.slot,
              entryAId: tie.entryAId,
              entryBId: tie.entryBId,
              status: tie.status as TournamentTieStatus,
              winnerEntryId: tie.winnerEntryId,
              pointsAwarded: tie.pointsAwarded,
              createdAt: tie.createdAt,
            })),
          });
        }

        await tx.match.createMany({
          data: matches.map((m) => ({
            id: m.id,
            format: m.format as MatchFormat,
            status: m.status as MatchStatus,
            teamAPlayer1Id: m.teamAPlayer1Id,
            teamAPlayer2Id: m.teamAPlayer2Id,
            teamBPlayer1Id: m.teamBPlayer1Id,
            teamBPlayer2Id: m.teamBPlayer2Id,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            submittedById: m.submittedById,
            validatedById: m.validatedById,
            tournamentTieId: m.tournamentTieId,
            legNumber: m.legNumber,
            tableId: m.tableId,
            createdAt: m.createdAt,
            respondedAt: m.respondedAt,
            submittedAt: m.submittedAt,
            validationExpiresAt: m.validationExpiresAt,
          })),
        });

        await tx.userBadge.createMany({
          data: users.flatMap((user) =>
            [...stats[user.id].badges].map(([code, earnedAt]) => ({
              id: `seed_badge_${user.id}_${code}`,
              userId: user.id,
              code: code as BadgeCode,
              earnedAt,
            })),
          ),
        });

        for (const t of tableStates) {
          await tx.table.update({
            where: { id: t.id },
            data: {
              status: t.status as TableStatus,
              format: t.format as MatchFormat,
              occupiedAt: t.occupiedAt,
            },
          });
        }

        // Repart d'une file/table vide sur table_a et table_b : au-delà des
        // groupes de démo (nettoyés en cascade avec les utilisateurs plus
        // haut), on efface aussi tout résidu d'utilisation réelle de l'app
        // (parties jouées pendant les tests), sans quoi un groupe ON_TABLE
        // oublié entrerait en conflit avec l'index unique (tableId, slot).
        const tableIds = tables.map((t) => t.id);
        await tx.tableReleaseVote.deleteMany({
          where: { tableId: { in: tableIds } },
        });
        await tx.queueGroup.deleteMany({
          where: { tableId: { in: tableIds } },
        });

        for (const q of queueGroups) {
          await tx.queueGroup.create({
            data: {
              id: q.id,
              tableId: q.tableId,
              format: MatchFormat.ONE_V_ONE,
              status: q.status as QueueGroupStatus,
              slot: q.slot,
              joinedAt: q.joinedAt,
              calledAt: q.calledAt,
              expiresAt: q.expiresAt,
              createdAt: q.joinedAt,
              members: {
                create: {
                  userId: q.userId,
                  isRequester: true,
                  accepted: true,
                },
              },
            },
          });
        }

        // Le match de table en cours entre les deux groupes sur Baby A.
        await tx.match.create({
          data: {
            id: 'seed_table_match_1',
            format: MatchFormat.ONE_V_ONE,
            status: MatchStatus.ACCEPTED,
            teamAPlayer1Id: 'seed_bob',
            teamBPlayer1Id: 'seed_charlie',
            tableId: 'table_a',
            createdAt: minutesAgo(12),
            respondedAt: minutesAgo(12),
          },
        });
      },
      { timeout: 60_000 },
    );
  } finally {
    await prisma.$disconnect();
  }

  console.log('Seed completed.');
  console.log('  10 comptes de démo (mot de passe commun : Test1234!) :');
  for (const user of users) {
    const s = stats[user.id];
    console.log(
      `    ${user.email.padEnd(20)} ${user.role.padEnd(6)} rating=${s.rating} wins=${s.wins}/${s.matchesPlayed} badges=[${[...s.badges.keys()].join(', ')}]`,
    );
  }
  console.log(
    '  2 tournois lancés (1 terminé, 1 en cours) + 1 brouillon, 2 tables, queue/chat/amis peuplés.',
  );
}

/** Hash entier déterministe d'une chaîne, pour produire des valeurs pseudo-aléatoires reproductibles. */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
