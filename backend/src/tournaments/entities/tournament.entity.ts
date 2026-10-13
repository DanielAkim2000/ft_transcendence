import { MatchFormat } from '../../matches/entities/match.entity';

/** [Minor · Tournois] États d'un tournoi (brouillon, en cours, terminé, annulé). */
export enum TournamentStatus {
  DRAFT = 'DRAFT',
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** [Minor · Tournois] États d'une confrontation (en attente, prête, en cours, terminée). */
export enum TournamentTieStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

/** [Minor · Tournois] Joueur d'une inscription de tournoi. */
export class TournamentPlayer {
  id!: string;
  displayname!: string;
  avatarUrl!: string | null;
  rating!: number;
}

/** [Minor · Tournois] Inscription (équipe) à un tournoi. */
export class TournamentEntryEntity {
  id!: string;
  seed!: number;
  player1!: TournamentPlayer;
  player2!: TournamentPlayer | null;
  eliminatedRound!: number | null;

  /** [Minor · Tournois] Copie dans l'instance les champs fournis. */
  constructor(entry: Partial<TournamentEntryEntity>) {
    Object.assign(this, entry);
  }
}

/** [Minor · Tournois] Confrontation du bracket avec ses manches. */
export class TournamentTieEntity {
  id!: string;
  round!: number;
  slot!: number;
  roundLabel!: string;
  entryA!: TournamentEntryEntity | null;
  entryB!: TournamentEntryEntity | null;
  status!: TournamentTieStatus;
  winnerEntryId!: string | null;
  pointsAwarded!: number | null;
  activeTableId!: string | null;
  activeLegId!: string | null;
  activeLegStatus!: string | null;
  /** Score soumis de la manche en attente de validation (null sinon). */
  activeLegScoreA!: number | null;
  activeLegScoreB!: number | null;
  /** Joueur qui a soumis ce score : l'équipe adverse doit le valider. */
  activeLegSubmittedById!: string | null;
  legsPlayed!: number;
  legsNeeded!: number;
  aggregateScoreA!: number | null;
  aggregateScoreB!: number | null;
  /** Manches terminées (score corrigeable par un admin). */
  completedLegs!: {
    id: string;
    legNumber: number;
    scoreA: number;
    scoreB: number;
  }[];

  /** [Minor · Tournois] Copie dans l'instance les champs fournis. */
  constructor(tie: Partial<TournamentTieEntity>) {
    Object.assign(this, tie);
  }
}

/** [Minor · Tournois] Tournoi avec ses inscriptions et son bracket. */
export class TournamentEntity {
  id!: string;
  name!: string;
  format!: MatchFormat;
  twoLegged!: boolean;
  status!: TournamentStatus;
  totalRounds!: number | null;
  createdBy!: TournamentPlayer;
  entries!: TournamentEntryEntity[];
  ties!: TournamentTieEntity[];
  createdAt!: Date;
  startedAt!: Date | null;
  completedAt!: Date | null;
  championEntryId!: string | null;

  /** [Minor · Tournois] Copie dans l'instance les champs fournis. */
  constructor(tournament: Partial<TournamentEntity>) {
    Object.assign(this, tournament);
  }
}
