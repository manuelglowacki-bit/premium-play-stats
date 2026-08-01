import type { Club } from "@/lib/prono-data";

export function ClubCrest({
  club,
  size = 40,
  className = "",
}: {
  club: Club;
  size?: number;
  className?: string;
}) {
  const gid = `crest-${club.id}-${size}`;
  return (
    <svg
      width={size}
      height={size * 1.12}
      viewBox="0 0 100 112"
      className={className}
      role="img"
      aria-label={`Blason ${club.name}`}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={club.from} />
          <stop offset="100%" stopColor={club.to} />
        </linearGradient>
      </defs>
      <path
        d="M50 2 96 16v44c0 26-20 42-46 50C24 102 4 86 4 60V16Z"
        fill={`url(#${gid})`}
        stroke="rgba(255,255,255,.5)"
        strokeWidth="3"
      />
      <path d="M50 2 96 16v20C80 24 66 18 50 18S20 24 4 36V16Z" fill="rgba(255,255,255,.16)" />
      <text
        x="50"
        y="72"
        textAnchor="middle"
        fill="#fff"
        fontFamily="Barlow Condensed, sans-serif"
        fontWeight="800"
        fontSize={club.short.length > 3 ? 26 : 32}
        letterSpacing="1"
      >
        {club.short}
      </text>
    </svg>
  );
}