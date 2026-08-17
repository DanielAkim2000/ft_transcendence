import { TAG_TYPES } from "@/constants/tagTypes";
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

type AuthState = {
  accessToken: string | null;
  preAuthToken: string | null;
};

const initialState: AuthState = {
  accessToken: null,
  preAuthToken: null,
};

const authSlice = createSlice({
  name: TAG_TYPES.AUTH,
  initialState,
  reducers: {
    setAccessToken: (state, action: PayloadAction<{ accessToken: string }>) => {
      state.accessToken = action.payload.accessToken;
      state.preAuthToken = null;
    },
    setPreAuthToken: (
      state,
      action: PayloadAction<{ preAuthToken: string }>,
    ) => {
      state.preAuthToken = action.payload.preAuthToken;
      state.accessToken = null;
    },
    clearCredentials: (state) => {
      state.accessToken = null;
      state.preAuthToken = null;
    },
  },
});

export const { setAccessToken, setPreAuthToken, clearCredentials } =
  authSlice.actions;

export default authSlice.reducer;
