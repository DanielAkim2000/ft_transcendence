import { TAG_TYPES } from "@/constants/tagTypes";
import type { RootState } from "@/store";
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

type AuthState = {
  accessToken: string | null;
  twoFactorRequired: boolean;
};

const initialState: AuthState = {
  accessToken: null,
  twoFactorRequired: false,
};

const authSlice = createSlice({
  name: TAG_TYPES.AUTH,
  initialState,
  reducers: {
    /** [Major · Gestion des utilisateurs] Stocke l'access token (connexion, refresh, 2FA validée) et lève l'exigence de 2FA. */
    setAccessToken: (state, action: PayloadAction<{ accessToken: string }>) => {
      state.accessToken = action.payload.accessToken;
      state.twoFactorRequired = false;
    },
    /** [Major · Gestion des utilisateurs] Le login exige la 2FA : efface le token et active l'écran de code. */
    setTwoFactorRequired: (state) => {
      state.twoFactorRequired = true;
      state.accessToken = null;
    },
    /** [Major · Gestion des utilisateurs] Vide la session (déconnexion, ban, refresh refusé). */
    clearCredentials: (state) => {
      state.accessToken = null;
      state.twoFactorRequired = false;
    },
  },
});

export const { setAccessToken, setTwoFactorRequired, clearCredentials } =
  authSlice.actions;

export default authSlice.reducer;

/** [Major · Gestion des utilisateurs] Sélecteur : access token courant (null si déconnecté). */
export const selectAccessToken = (state: RootState) => state.auth.accessToken;
