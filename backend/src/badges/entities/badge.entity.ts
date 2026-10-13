/** [Minor · Gamification] Codes des badges attribuables. */
export enum BadgeCode {
  FIRST_WIN = 'FIRST_WIN',
  TEN_WINS = 'TEN_WINS',
  FIFTY_MATCHES = 'FIFTY_MATCHES',
  WIN_STREAK_3 = 'WIN_STREAK_3',
  TOURNAMENT_FINALIST = 'TOURNAMENT_FINALIST',
  TOURNAMENT_CHAMPION = 'TOURNAMENT_CHAMPION',
  GIANT_SLAYER = 'GIANT_SLAYER',
}

/** [Minor · Gamification] Badge obtenu par un joueur (code, date). */
export class UserBadgeEntity {
  code!: BadgeCode;
  earnedAt!: Date;

  /** [Minor · Gamification] Copie dans l'instance les champs fournis. */
  constructor(badge: Partial<UserBadgeEntity>) {
    Object.assign(this, badge);
  }
}

/** [Minor · Gamification] Profil de progression d'un joueur : XP, niveau, statistiques, badges. */
export class PlayerBadgesProfile {
  userId!: string;
  xp!: number;
  level!: number;
  xpIntoLevel!: number;
  xpPerLevel!: number;
  wins!: number;
  matchesPlayed!: number;
  currentWinStreak!: number;
  bestWinStreak!: number;
  /** Note Elo actuelle. */
  rating!: number;
  /** Position au classement général (ex æquo = même rang), null si le compte est supprimé. */
  rank!: number | null;
  totalPlayers!: number;
  badges!: UserBadgeEntity[];

  /** [Minor · Gamification] Copie dans l'instance les champs fournis. */
  constructor(profile: Partial<PlayerBadgesProfile>) {
    Object.assign(this, profile);
  }
}
