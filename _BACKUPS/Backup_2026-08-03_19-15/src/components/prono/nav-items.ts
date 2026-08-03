import { BarChart3, Home, Medal, Newspaper, ShieldCheck, Trophy, User } from "lucide-react";

export const navItems = [
  { label: "Accueil", to: "/", icon: Home },
  { label: "Pronos", to: "/pronostics", icon: Medal },
  { label: "Classement", to: "/classement", icon: Trophy },
  { label: "Gazette", to: "/gazette", icon: Newspaper },
  { label: "Stats", to: "/stats", icon: BarChart3 },
  { label: "Profil", to: "/profil", icon: User },
  { label: "Admin", to: "/admin", icon: ShieldCheck }, // <-- Ajouté ici pour la sidebar
] as const;

export const bottomItems = navItems.filter((i) =>
  ["/", "/pronostics", "/classement", "/stats", "/gazette", "/profil"].includes(i.to),
);