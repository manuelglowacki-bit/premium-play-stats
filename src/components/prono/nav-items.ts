import { BarChart3, Home, Medal, Newspaper, Trophy, User } from "lucide-react";

export const navItems = [
  { label: "Accueil", to: "/", icon: Home },
  { label: "Pronos", to: "/pronostics", icon: Medal },
  { label: "Classement", to: "/classement", icon: Trophy },
  { label: "Gazette", to: "/gazette", icon: Newspaper },
  { label: "Stats", to: "/statistiques", icon: BarChart3 },
  { label: "Trophées", to: "/trophees", icon: Trophy },
  { label: "Profil", to: "/profil", icon: User },
] as const;

export const bottomItems = navItems.filter((i) =>
  ["/", "/pronostics", "/classement", "/statistiques", "/gazette"].includes(i.to),
);
