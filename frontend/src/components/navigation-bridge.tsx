import { useEffect } from "react";
import { useNavigate } from "react-router";
import { setNavigate } from "@/lib/navigation";

export function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => setNavigate(navigate), [navigate]);
  return null;
}
