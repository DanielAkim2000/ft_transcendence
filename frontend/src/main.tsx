import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import "@/i18n";
import App from "./App.tsx";
import { StoreProvider } from "./app/store-provider.tsx";
import { AuthBootstrap } from "./features/auth/AuthBootstrap.tsx";
import { I18nSync } from "./i18n/I18nSync.tsx";
import { ThemeSync } from "./features/settings/ThemeSync.tsx";
import { Toaster } from "@/components/ui/toast";
import { NavigationBridge } from "@/components/navigation-bridge";

createRoot(document.getElementById("root")!).render(
  <StoreProvider>
    <ThemeSync>
      <I18nSync>
        <BrowserRouter>
          <NavigationBridge />
          <AuthBootstrap>
            <App />
            <Toaster />
          </AuthBootstrap>
        </BrowserRouter>
      </I18nSync>
    </ThemeSync>
  </StoreProvider>
);
