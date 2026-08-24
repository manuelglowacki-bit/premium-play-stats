import { Link } from "@tanstack/react-router";
import { bottomItems } from "./nav-items";

export function BottomNav() {
  return (
    <nav
      aria-label="Navigation mobile"
      className="glass fixed inset-x-3 bottom-3 z-50 flex items-center justify-between gap-1 rounded-3xl px-2 py-2 lg:hidden"
    >
      {bottomItems.map(({ label, to, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="tap flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold text-muted-foreground"
          activeProps={{ className: "bg-primary/15 text-primary [&_svg]:icon-lume" }}
          activeOptions={{ exact: to === "/" }}
        >
          <Icon className="size-5 shrink-0" />
          <span className="max-w-full truncate">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
