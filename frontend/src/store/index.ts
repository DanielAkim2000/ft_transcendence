import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
// ESM path: l'import CJS `redux-persist/lib/storage` casse sous Vite
// (storage.getItem is not a function → page blanche).
import storage from "redux-persist/es/storage";
import authReducer from "@/features/auth/authSlice";
import settingsReducer from "@/features/settings/settingsSlice";
import { api } from "./api";
import { clearSessionHint, setSessionHint } from "@/lib/sessionHint";
import "@/features/auth/authApi";
import "@/features/users/usersApi";

const settingsPersistConfig = {
  key: "settings",
  storage,
};

const rootReducer = combineReducers({
  auth: authReducer,
  settings: persistReducer(settingsPersistConfig, settingsReducer),
  [api.reducerPath]: api.reducer,
});

/** [Major · Frameworks React + NestJS] Store Redux : réducteurs auth / réglages (persistés) / cache RTK Query, et middleware RTK Query. */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(api.middleware),
});

// Témoin de session : posé quand un access token apparaît, retiré quand il disparaît (déconnexion, ban, refresh refusé).
let hadToken = false;
store.subscribe(() => {
  const hasToken = Boolean(store.getState().auth.accessToken);
  if (hasToken === hadToken) return;
  hadToken = hasToken;
  if (hasToken) setSessionHint();
  else clearSessionHint();
});

// Lance la réhydratation localStorage → settings.
export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
