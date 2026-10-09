import {
  LayoutGridIcon,
  CrownIcon,
  MedalIcon,
  SwordsIcon,
  TrophyIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import type { AppNotification } from "./notificationsApi";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Icône et lien éventuel selon la famille de la notification. */
function categoryOf(type: AppNotification["type"]): { icon: LucideIcon; to?: string } {
  if (type === "FRIEND_REQUEST") return { icon: UsersIcon, to: ROUTES.FRIENDS };
  if (type.startsWith("CHESS_")) return { icon: CrownIcon, to: ROUTES.CHESS };
  if (type.startsWith("MATCH_")) return { icon: SwordsIcon, to: ROUTES.CHALLENGES };
  if (type.startsWith("QUEUE_") || type.startsWith("TABLE_")) {
    return { icon: LayoutGridIcon, to: ROUTES.TABLES };
  }
  if (type.startsWith("TOURNAMENT_")) {
    // Le lien exact (vers le tournoi concerné) est calculé au cas par cas
    // dans renderNotification, où l'id du tournoi est disponible.
    return { icon: TrophyIcon };
  }
  return { icon: MedalIcon, to: ROUTES.PROFILE_ME };
}

/** Texte (traduit) et lien vers la page concernée pour une notification. */
export function renderNotification(
  t: Translate,
  notification: AppNotification,
): { text: string; to?: string; icon: LucideIcon } {
  const { type, data } = notification;
  const { icon, to } = categoryOf(type);

  switch (type) {
    case "FRIEND_REQUEST":
      return { text: t("notifications.items.friendRequest", data), to, icon };
    case "MATCH_PROPOSED":
      return { text: t("notifications.items.matchProposed", data), to, icon };
    case "MATCH_ACCEPTED":
      return { text: t("notifications.items.matchAccepted", data), to, icon };
    case "MATCH_DECLINED":
      return { text: t("notifications.items.matchDeclined", data), to, icon };
    case "MATCH_SCORE_SUBMITTED":
      return {
        text: t("notifications.items.matchScoreSubmitted", data),
        to,
        icon,
      };
    case "MATCH_COMPLETED":
      return {
        text: t(
          data.won ? "notifications.items.matchCompletedWon" : "notifications.items.matchCompletedLost",
          data,
        ),
        to,
        icon,
      };
    case "MATCH_DISPUTED":
      return { text: t("notifications.items.matchDisputed", data), to, icon };
    case "QUEUE_INVITE":
      return { text: t("notifications.items.queueInvite", data), to, icon };
    case "QUEUE_INVITE_DECLINED":
      return {
        text: t("notifications.items.queueInviteDeclined", data),
        to,
        icon,
      };
    case "QUEUE_GROUP_CLOSED":
      return { text: t("notifications.items.queueGroupClosed", data), to, icon };
    case "QUEUE_CALLED":
      return { text: t("notifications.items.queueCalled", data), to, icon };
    case "QUEUE_EXPIRED": {
      const key =
        data.reason === "invite"
          ? "notifications.items.queueExpiredInvite"
          : data.reason === "tournament"
            ? "notifications.items.queueExpiredTournament"
            : data.reason === "admin"
              ? "notifications.items.queueExpiredAdmin"
              : "notifications.items.queueExpiredCall";
      return { text: t(key, data), to, icon };
    }
    case "TABLE_MATCH_STARTED":
      return { text: t("notifications.items.tableMatchStarted", data), to, icon };
    case "TABLE_SCORE_REQUIRED":
      return { text: t("notifications.items.tableScoreRequired", data), to, icon };
    case "TABLE_MATCH_ENDED":
      return {
        text: t(
          data.stays
            ? "notifications.items.tableMatchEndedStays"
            : "notifications.items.tableMatchEndedLeaves",
          data,
        ),
        to,
        icon,
      };
    case "TABLE_MATCH_CANCELLED":
      return {
        text: t(
          data.reason === "externalRelease"
            ? "notifications.items.tableMatchCancelledExternal"
            : data.reason === "admin"
              ? "notifications.items.tableMatchCancelledAdmin"
              : "notifications.items.tableMatchCancelledTimeout",
          data,
        ),
        to,
        icon,
      };
    case "TOURNAMENT_LAUNCHED":
      return {
        text: t("notifications.items.tournamentLaunched", data),
        to: typeof data.tournamentId === "string" ? ROUTES.tournament(data.tournamentId) : to,
        icon,
      };
    case "TOURNAMENT_TABLE_RECLAIMED":
      return {
        text: t("notifications.items.tournamentTableReclaimed", data),
        to: typeof data.tournamentId === "string" ? ROUTES.tournament(data.tournamentId) : to,
        icon,
      };
    case "TOURNAMENT_TIE_STARTED":
      return {
        text: t("notifications.items.tournamentTieStarted", data),
        to: typeof data.tournamentId === "string" ? ROUTES.tournament(data.tournamentId) : to,
        icon,
      };
    case "TOURNAMENT_TIE_WON":
      return {
        text: t("notifications.items.tournamentTieWon", data),
        to: typeof data.tournamentId === "string" ? ROUTES.tournament(data.tournamentId) : to,
        icon,
      };
    case "TOURNAMENT_ELIMINATED":
      return {
        text: t("notifications.items.tournamentEliminated", data),
        to: typeof data.tournamentId === "string" ? ROUTES.tournament(data.tournamentId) : to,
        icon,
      };
    case "TOURNAMENT_TIE_RESET":
      return {
        text: t("notifications.items.tournamentTieReset", data),
        to: typeof data.tournamentId === "string" ? ROUTES.tournament(data.tournamentId) : to,
        icon,
      };
    case "TOURNAMENT_SCORE_CORRECTED":
      return {
        text: t("notifications.items.tournamentScoreCorrected", data),
        to: typeof data.tournamentId === "string" ? ROUTES.tournament(data.tournamentId) : to,
        icon,
      };
    case "TOURNAMENT_COMPLETED":
      return {
        text: t("notifications.items.tournamentCompleted", data),
        to: typeof data.tournamentId === "string" ? ROUTES.tournament(data.tournamentId) : to,
        icon,
      };
    // Une invitation mène à la liste des défis (pour accepter) ; acceptée, directement à la partie.
    case "CHESS_INVITE":
      return { text: t("notifications.items.chessInvite", data), to, icon };
    case "CHESS_INVITE_ACCEPTED":
      return {
        text: t("notifications.items.chessInviteAccepted", data),
        to: typeof data.gameId === "string" ? `${ROUTES.CHESS}?gameId=${data.gameId}` : to,
        icon,
      };
    case "CHESS_INVITE_DECLINED":
      return { text: t("notifications.items.chessInviteDeclined", data), to, icon };
    case "BADGE_EARNED":
      return {
        text: t("notifications.items.badgeEarned", {
          name: t(`badges.catalog.${String(data.code)}.name`),
        }),
        to,
        icon,
      };
    default:
      return { text: type, to, icon };
  }
}
