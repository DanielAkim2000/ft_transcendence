import { useEffect } from "react";
import { useNavigate } from "react-router";
import { setNavigate } from "@/lib/navigation";

/** [Minor · Design system] Enregistre la fonction `navigate` de React Router pour pouvoir naviguer hors des composants (store, sockets). */
export function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => setNavigate(navigate), [navigate]);
  return null;
}
