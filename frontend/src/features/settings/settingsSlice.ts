import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type ThemePreference = "light" | "dark" | "system";
export type LanguagePreference = "en" | "fr" | "es";

/** Couleur principale de l'interface (green = celle d'origine). */
export const ACCENT_PREFERENCES = [
  "green",
  "blue",
  "purple",
  "pink",
  "red",
  "orange",
  "amber",
  "teal",
] as const;
export type AccentPreference = (typeof ACCENT_PREFERENCES)[number];

/** Arrondi des bordures : none = angles droits (défaut). */
export const RADIUS_PREFERENCES = ["none", "medium", "large"] as const;
export type RadiusPreference = (typeof RADIUS_PREFERENCES)[number];

type SettingsState = {
  theme: ThemePreference;
  language: LanguagePreference;
  accent: AccentPreference;
  radius: RadiusPreference;
};

const initialState: SettingsState = {
  theme: "dark",
  language: "en",
  accent: "green",
  radius: "none",
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
    setAccent: (state, action: PayloadAction<{ accent: AccentPreference }>) => {
      state.accent = action.payload.accent;
    },
    setRadius: (state, action: PayloadAction<{ radius: RadiusPreference }>) => {
      state.radius = action.payload.radius;
    },
    /** Hydrate depuis l'API / BDD plus tard. */
    hydrateSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      if (action.payload.theme !== undefined) {
        state.theme = action.payload.theme;
      }
      if (action.payload.language !== undefined) {
        state.language = action.payload.language;
      }
      if (action.payload.accent !== undefined) {
        state.accent = action.payload.accent;
      }
      if (action.payload.radius !== undefined) {
        state.radius = action.payload.radius;
      }
    },
  },
});

export const { setTheme, setLanguage, setAccent, setRadius, hydrateSettings } =
  settingsSlice.actions;

export default settingsSlice.reducer;
