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
    setAccessToken: (state, action: PayloadAction<{ accessToken: string }>) => {
      state.accessToken = action.payload.accessToken;
      state.twoFactorRequired = false;
    },
    setTwoFactorRequired: (state) => {
      state.twoFactorRequired = true;
      state.accessToken = null;
    },
    clearCredentials: (state) => {
      state.accessToken = null;
      state.twoFactorRequired = false;
    },
  },
});

export const { setAccessToken, setTwoFactorRequired, clearCredentials } =
  authSlice.actions;

export default authSlice.reducer;

export const selectAccessToken = (state: RootState) => state.auth.accessToken;
