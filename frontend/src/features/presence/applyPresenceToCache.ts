import type { AppDispatch, RootState } from "@/store";
import type { Status } from "@/features/auth/authApi";
import { usersApi } from "../users/usersApi";
import { USERS_ENDPOINTS } from "@/constants/queryEndpoints";
import { TAG_TYPES } from "@/constants/tagTypes";

/** [Major · Temps réel WebSockets] Met à jour le statut en ligne d'un utilisateur dans tous les caches de listes d'amis et de recherche, sans refaire de requête. */
const applyPresenceToCache = (
  dispatch: AppDispatch,
  userId: string,
  status: Status,
) => {
  const isOnline = status === "ONLINE";

  // Les listes d'amis sont triées « en ligne d'abord » et paginées côté
  // backend : on les recharge plutôt que de les patcher (l'ordre et le
  // contenu des pages dépendent de la présence).
  dispatch(
    usersApi.util.invalidateTags([{ type: TAG_TYPES.FRIENDS, id: "LIST" }]),
  );

  dispatch(
    usersApi.util.updateQueryData(USERS_ENDPOINTS.GET_USER, userId, (draft) => {
      draft.user.status = status;
      draft.user.isOnline = isOnline;
    }),
  );

  // Amis éventuellement visibles dans une recherche déjà en cache
  dispatch((_, getState) => {
    const args = usersApi.util.selectCachedArgsForQuery(
      getState() as RootState,
      USERS_ENDPOINTS.SEARCH_USERS,
    );
    for (const arg of args) {
      dispatch(
        usersApi.util.updateQueryData(
          USERS_ENDPOINTS.SEARCH_USERS,
          arg,
          (draft) => {
            const user = draft.items.find((entry) => entry.id === userId);
            if (user && user.friendshipStatus === "friends") {
              user.status = status;
              user.isOnline = isOnline;
            }
          },
        ),
      );
    }
  });
};

export default applyPresenceToCache;
