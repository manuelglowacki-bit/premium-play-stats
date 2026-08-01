import { BarChart3, Home, Medal, Newspaper, Trophy } from "lucide-react";

const items = [
  { label: "Accueil", href: "#accueil", icon: Home, active: true },
  { label: "Pronos", href: "#pronostics", icon: Medal },
  { label: "Classement", href: "#classement", icon: Trophy },
  { label: "Stats", href: "#stats", icon: BarChart3 },
  { label: "Gazette", href: "#gazette", icon: Newspaper },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Navigation mobile"
      className="glass fixed inset-x-3 bottom-3 z-50 flex items-center justify-between gap-1 rounded-3xl px-2 py-2 lg:hidden"
    >
      {items.map(({ label, href, icon: Icon, active }) => (
        <a
          key={label}
          href={href}
          className={`tap flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold ${
            active ? "bg-primary/15 text-primary" : "text-muted-foreground"
          }`}
        >
          <Icon className={`size-5 ${active ? "icon-lume" : ""}`} />
          {label}
        </a>
      ))}
    </nav>
  );
}