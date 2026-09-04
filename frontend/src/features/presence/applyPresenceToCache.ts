import type { AppDispatch, RootState } from "@/store";
import type { Status } from "@/features/auth/authApi";
import { usersApi } from "../users/usersApi";
import { USERS_ENDPOINTS } from "@/constants/queryEndpoints";

const patchUserInList = (
  draft: { id: string; isOnline: boolean; status: Status }[],
  userId: string,
  status: Status,
  isOnline: boolean,
) => {
  const user = draft.find((entry) => entry.id === userId);
  if (user) {
    user.status = status;
    user.isOnline = isOnline;
  }
};

const applyPresenceToCache = (
  dispatch: AppDispatch,
  userId: string,
  status: Status,
) => {
  const isOnline = status === "ONLINE";

  dispatch(
    usersApi.util.updateQueryData(
      USERS_ENDPOINTS.LIST_FRIENDS,
      undefined,
      (draft) => {
        patchUserInList(draft, userId, status, isOnline);
      },
    ),
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
            patchUserInList(draft, userId, status, isOnline);
          },
        ),
      );
    }
  });
};

export default applyPresenceToCache;
