import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

type SettingsState = {
  theme: "light" | "dark" | "system";
  language: "en" | "fr" | "es";
};

const initialState: SettingsState = {
  theme: "light",
  language: "en",
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setTheme: (
      state,
      action: PayloadAction<{ theme: "light" | "dark" | "system" }>,
    ) => {
      state.theme = action.payload.theme;
    },
    setLanguage: (
      state,
      action: PayloadAction<{ language: "en" | "fr" | "es" }>,
    ) => {
      state.language = action.payload.language;
    },
  },
});

export const { setTheme, setLanguage } = settingsSlice.actions;

export default settingsSlice.reducer;
