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
    /** [Minor · Design system] Change le thème (clair, sombre, système). */
    setTheme: (state, action: PayloadAction<{ theme: ThemePreference }>) => {
      state.theme = action.payload.theme;
    },
    /** [Minor · Multilingue] Change la langue de l'interface (en, fr, es). */
    setLanguage: (
      state,
      action: PayloadAction<{ language: LanguagePreference }>,
    ) => {
      state.language = action.payload.language;
    },
    /** [Minor · Design system] Change la couleur d'accent. */
    setAccent: (state, action: PayloadAction<{ accent: AccentPreference }>) => {
      state.accent = action.payload.accent;
    },
    /** [Minor · Design system] Change l'arrondi des composants. */
    setRadius: (state, action: PayloadAction<{ radius: RadiusPreference }>) => {
      state.radius = action.payload.radius;
    },
    /** Hydrate depuis l'API / BDD plus tard. */
    /** [Minor · Design system] Charge les réglages enregistrés en base pour l'utilisateur connecté (source de vérité). */
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
