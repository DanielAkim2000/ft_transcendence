import "@/App.css";
import { Route, Routes } from "react-router";
import { Home } from "@/pages/Home";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { AuthCallback } from "@/pages/AuthCallback";
import { TwoFactorSettings } from "@/pages/TwoFactorSettings";
import { Settings } from "@/pages/Settings";
import { ProfileMe } from "@/pages/ProfileMe";
import { Profile } from "@/pages/Profile";
import { Friends } from "@/pages/Friends";
import { Chat } from "@/pages/Chat";
import { Tables } from "@/pages/Tables";
import { Ranking } from "@/pages/Ranking";
import { Tournaments } from "@/pages/Tournaments";
import { TournamentNew } from "@/pages/TournamentNew";
import { TournamentDetail } from "@/pages/TournamentDetail";
import { Legal } from "@/pages/Legal";
import { ProtectedLayout } from "@/layouts/ProtectedLayout";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ROUTES } from "@/constants/routes";

function App() {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<Login />} />
      <Route path={ROUTES.REGISTER} element={<Register />} />
      <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />
      <Route path={ROUTES.PRIVACY} element={<Legal kind="privacy" />} />
      <Route path={ROUTES.TERMS} element={<Legal kind="terms" />} />

      <Route element={<ProtectedLayout />}>
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.HOME} element={<Home />} />
          <Route path={ROUTES.PROFILE_ME} element={<ProfileMe />} />
          <Route path={ROUTES.PROFILE_BY_ID} element={<Profile />} />
          <Route path={ROUTES.FRIENDS} element={<Friends />} />
          <Route path={ROUTES.CHAT} element={<Chat />} />
          <Route path={ROUTES.TABLES} element={<Tables />} />
          <Route path={ROUTES.RANKING} element={<Ranking />} />
          <Route path={ROUTES.TOURNAMENTS_NEW} element={<TournamentNew />} />
          <Route path={ROUTES.TOURNAMENTS} element={<Tournaments />} />
          <Route path={ROUTES.TOURNAMENT_BY_ID} element={<TournamentDetail />} />
          <Route path={ROUTES.SETTINGS} element={<Settings />} />
          <Route path={ROUTES.SETTINGS_2FA} element={<TwoFactorSettings />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
