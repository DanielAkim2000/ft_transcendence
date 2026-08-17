import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/features/auth/authSlice";
import settingsReducer from "@/features/settings/settingsSlice";
import { api } from "./api";
import "@/features/auth/authApi";
import "@/features/users/usersApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    settings: settingsReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
