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
import { ProtectedLayout } from "@/layouts/ProtectedLayout";
import { DashboardLayout } from "@/layouts/DashboardLayout";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<ProtectedLayout />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/profile/me" element={<ProfileMe />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/2fa" element={<TwoFactorSettings />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
