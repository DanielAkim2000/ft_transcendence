import {
  Award,
  Crown,
  Flame,
  Medal,
  Shield,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { BadgeCode } from "./badgesApi";

export const BADGE_CATALOG: { code: BadgeCode; icon: LucideIcon }[] = [
  { code: "FIRST_WIN", icon: Medal },
  { code: "TEN_WINS", icon: Award },
  { code: "FIFTY_MATCHES", icon: Trophy },
  { code: "WIN_STREAK_3", icon: Flame },
  { code: "GIANT_SLAYER", icon: Swords },
  { code: "TOURNAMENT_FINALIST", icon: Shield },
  { code: "TOURNAMENT_CHAMPION", icon: Crown },
];
