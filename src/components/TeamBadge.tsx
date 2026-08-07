import TeamLogo from "./TeamLogo";

type TeamBadgeProps = {
  name: string;
  shortName?: string;
  logoUrl?: string | null;
  size?: number;
};

export default function TeamBadge({
  name,
  shortName,
  logoUrl,
  size = 44,
}: TeamBadgeProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2 shadow-md backdrop-blur-sm transition-all hover:border-emerald-500/60 hover:bg-slate-800/80 hover:shadow-[0_0_18px_rgba(16,185,129,0.25)]">

      <TeamLogo
        name={name}
        logoUrl={logoUrl}
        size={size}
      />

      <div className="min-w-0">
        <div className="truncate font-semibold text-white">
          {name}
        </div>

        {shortName && (
          <div className="text-xs uppercase tracking-wider text-slate-400">
            {shortName}
          </div>
        )}
      </div>

    </div>
  );
}
