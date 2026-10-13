import "@/App.css";
import { Suspense } from "react";
import { Route, Routes } from "react-router";
import { ProtectedLayout } from "@/layouts/ProtectedLayout";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { RequireAdmin } from "@/layouts/RequireAdmin";
import { ROUTES } from "@/constants/routes";
import { lazyPage } from "@/lib/lazy-page";
import { PageFallback } from "@/components/page-fallback";

// Chaque page est un chunk chargé à la demande : le bundle initial reste léger.
const Home = lazyPage(() => import("@/pages/Home"), "Home");
const Login = lazyPage(() => import("@/pages/Login"), "Login");
const Register = lazyPage(() => import("@/pages/Register"), "Register");
const ForgetPass = lazyPage(() => import("@/pages/ForgetPass"), "ForgetPass");
const ResetPassword = lazyPage(() => import("@/pages/ResetPassword"), "ResetPassword");
const AuthCallback = lazyPage(() => import("@/pages/AuthCallback"), "AuthCallback");
const TwoFactorSettings = lazyPage(() => import("@/pages/TwoFactorSettings"), "TwoFactorSettings");
const Settings = lazyPage(() => import("@/pages/Settings"), "Settings");
const ProfileMe = lazyPage(() => import("@/pages/ProfileMe"), "ProfileMe");
const Profile = lazyPage(() => import("@/pages/Profile"), "Profile");
const Friends = lazyPage(() => import("@/pages/Friends"), "Friends");
const Chat = lazyPage(() => import("@/pages/Chat"), "Chat");
const Tables = lazyPage(() => import("@/pages/Tables"), "Tables");
const Ranking = lazyPage(() => import("@/pages/Ranking"), "Ranking");
const Challenges = lazyPage(() => import("@/pages/Challenges"), "Challenges");
const History = lazyPage(() => import("@/pages/History"), "History");
const Notifications = lazyPage(() => import("@/pages/Notifications"), "Notifications");
const Tournaments = lazyPage(() => import("@/pages/Tournaments"), "Tournaments");
const TournamentNew = lazyPage(() => import("@/pages/TournamentNew"), "TournamentNew");
const TournamentDetail = lazyPage(() => import("@/pages/TournamentDetail"), "TournamentDetail");
const Status = lazyPage(() => import("@/pages/Status"), "Status");
const ConfirmDeletion = lazyPage(() => import("@/pages/ConfirmDeletion"), "ConfirmDeletion");
const Legal = lazyPage(() => import("@/pages/Legal"), "Legal");
const Chess = lazyPage(() => import("@/pages/Chess"), "Chess");
const NotFound = lazyPage(() => import("@/pages/NotFound"), "NotFound");
const AdminUsers = lazyPage(() => import("@/pages/AdminUsers"), "AdminUsers");
const AdminTables = lazyPage(() => import("@/pages/AdminTables"), "AdminTables");
const BanPanel = lazyPage(() => import("@/pages/BanPanel"), "BanPanel");

/** [Major · Frameworks React + NestJS] Composant racine : déclare toutes les routes React Router (pages publiques, puis pages protégées derrière ProtectedLayout/DashboardLayout, puis pages admin derrière RequireAdmin) avec un Suspense pour le chargement paresseux des pages. */
function App() {
  return (
    <Suspense fallback={<PageFallback fullscreen />}>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<Login />} />
        <Route path={ROUTES.REGISTER} element={<Register />} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgetPass />} />
        <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
        <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />
        <Route path={ROUTES.PRIVACY} element={<Legal kind="privacy" />} />
        <Route path={ROUTES.TERMS} element={<Legal kind="terms" />} />
        <Route path={ROUTES.STATUS} element={<Status />} />
        <Route path={ROUTES.CONFIRM_DELETION} element={<ConfirmDeletion />} />

        <Route element={<ProtectedLayout />}>
          <Route element={<DashboardLayout />}>
            <Route path={ROUTES.HOME} element={<Home />} />
            <Route path={ROUTES.PROFILE_ME} element={<ProfileMe />} />
            <Route path={ROUTES.PROFILE_BY_ID} element={<Profile />} />
            <Route path={ROUTES.FRIENDS} element={<Friends />} />
            <Route path={ROUTES.CHAT} element={<Chat />} />
            <Route path={ROUTES.TABLES} element={<Tables />} />
            <Route path={ROUTES.RANKING} element={<Ranking />} />
            <Route path={ROUTES.CHALLENGES} element={<Challenges />} />
            <Route path={ROUTES.HISTORY} element={<History />} />
            <Route path={ROUTES.TOURNAMENTS_NEW} element={<TournamentNew />} />
            <Route path={ROUTES.TOURNAMENTS} element={<Tournaments />} />
            <Route path={ROUTES.TOURNAMENT_BY_ID} element={<TournamentDetail />} />
            <Route path={ROUTES.SETTINGS} element={<Settings />} />
            <Route path={ROUTES.SETTINGS_2FA} element={<TwoFactorSettings />} />
            <Route path={ROUTES.NOTIFICATIONS} element={<Notifications />} />
            <Route path={ROUTES.CHESS} element={<Chess />} />

            <Route element={<RequireAdmin />}>
              <Route path={ROUTES.ADMIN_USERS} element={<AdminUsers />} />
              <Route path={ROUTES.ADMIN_TABLES} element={<AdminTables />} />
              <Route path={ROUTES.ADMIN_BAN} element={<BanPanel />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;
