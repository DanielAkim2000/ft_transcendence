import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/store";

interface StoreProviderProps {
  children: React.ReactNode;
}

/** [Major · Frameworks React + NestJS] Fournit le store Redux et la réhydratation du stockage local (PersistGate) à toute l'application. */
export function StoreProvider({ children }: StoreProviderProps) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}
