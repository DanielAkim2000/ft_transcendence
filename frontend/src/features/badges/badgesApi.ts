import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { BADGES_ENDPOINTS } from "@/constants/queryEndpoints";

export type BadgeCode =
  | "FIRST_WIN"
  | "TEN_WINS"
  | "FIFTY_MATCHES"
  | "WIN_STREAK_3"
  | "TOURNAMENT_FINALIST"
  | "TOURNAMENT_CHAMPION"
  | "GIANT_SLAYER";

export interface EarnedBadge {
  code: BadgeCode;
  earnedAt: string;
}

export interface PlayerBadgesProfile {
  userId: string;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  wins: number;
  matchesPlayed: number;
  currentWinStreak: number;
  bestWinStreak: number;
  rating: number;
  /** Position au classement général (ex æquo = même rang) ; null pour un compte supprimé. */
  rank: number | null;
  totalPlayers: number;
  badges: EarnedBadge[];
}

export const badgesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [BADGES_ENDPOINTS.GET_BADGES]: builder.query<PlayerBadgesProfile, string>({
      query: (userId) => API_ROUTES.badges(userId),
      // Le rang change quand le classement change.
      providesTags: (_result, _error, userId) => [
        { type: TAG_TYPES.BADGES, id: userId },
        TAG_TYPES.RANKING,
      ],
    }),
  }),
});

export const { useGetBadgesQuery } = badgesApi;
