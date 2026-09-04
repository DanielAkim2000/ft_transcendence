import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type ThemePreference = "light" | "dark" | "system";
export type LanguagePreference = "en" | "fr" | "es";

type SettingsState = {
  theme: ThemePreference;
  language: LanguagePreference;
};

const initialState: SettingsState = {
  theme: "light",
  language: "en",
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<{ theme: ThemePreference }>) => {
      state.theme = action.payload.theme;
    },
    setLanguage: (
      state,
      action: PayloadAction<{ language: LanguagePreference }>,
    ) => {
      state.language = action.payload.language;
    },
    /** Hydrate depuis l'API / BDD plus tard. */
    hydrateSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      if (action.payload.theme !== undefined) {
        state.theme = action.payload.theme;
      }
      if (action.payload.language !== undefined) {
        state.language = action.payload.language;
      }
    },
  },
});

export const { setTheme, setLanguage, hydrateSettings } = settingsSlice.actions;

export default settingsSlice.reducer;
