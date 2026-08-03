import { Check, ChevronDown, Heart, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Team = { name: string; short: string; from: string; to: string };

const TEAMS: Team[] = [
  { name: "AJ Auxerre", short: "AJA", from: "#113d91", to: "#e9eef7" }, { name: "Angers SCO", short: "SCO", from: "#151515", to: "#d3d3d3" }, { name: "AS Monaco", short: "ASM", from: "#e12631", to: "#f5f2e7" }, { name: "FC Lorient", short: "FCL", from: "#e6531c", to: "#111111" }, { name: "FC Metz", short: "FCM", from: "#7d1828", to: "#e7c79c" }, { name: "FC Nantes", short: "FCN", from: "#f0db00", to: "#16813b" }, { name: "Havre AC", short: "HAC", from: "#6ab6e5", to: "#173e82" }, { name: "LOSC Lille", short: "LOSC", from: "#a71930", to: "#172759" }, { name: "Montpellier HSC", short: "MHSC", from: "#ee7725", to: "#1b3f92" }, { name: "OGC Nice", short: "OGCN", from: "#d71920", to: "#111111" }, { name: "Olympique Lyonnais", short: "OL", from: "#174c9e", to: "#d52332" }, { name: "Olympique de Marseille", short: "OM", from: "#1e9bd7", to: "#f7fbff" }, { name: "Paris FC", short: "PFC", from: "#122f75", to: "#72c6e8" }, { name: "Paris Saint-Germain", short: "PSG", from: "#0b2b6f", to: "#df1838" }, { name: "RC Lens", short: "RCL", from: "#8d1720", to: "#d5a728" }, { name: "RC Strasbourg Alsace", short: "RCSA", from: "#1479c9", to: "#e9f4ff" }, { name: "Stade Brestois 29", short: "SB29", from: "#d31326", to: "#ffffff" }, { name: "Stade Rennais FC", short: "SRFC", from: "#be1425", to: "#151515" }, { name: "Toulouse FC", short: "TFC", from: "#522a86", to: "#d22a62" },
];

const SELECTION_DEADLINE = new Date("2026-08-21T20:45:00+02:00");
const STORAGE_KEY = "prono-favorite-team-2026-2027";

function TeamBadge({ team, size = "md" }: { team: Team; size?: "sm" | "md" }) {
  return <span aria-hidden="true" className={`${size === "sm" ? "size-8" : "size-10"} grid shrink-0 place-items-center rounded-xl border border-white/35 font-display text-[10px] font-black tracking-tight text-white shadow-sm`} style={{ background: `linear-gradient(135deg, ${team.from}, ${team.to})` }}>{team.short}</span>;
}

export function FavoriteTeamCard() {
  const [savedTeam, setSavedTeam] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const isClosed = new Date() >= SELECTION_DEADLINE;
  const activeTeam = TEAMS.find((team) => team.name === selectedTeam);

  useEffect(() => {
    const team = window.localStorage.getItem(STORAGE_KEY);
    if (team && TEAMS.some((candidate) => candidate.name === team)) { setSavedTeam(team); setSelectedTeam(team); }
  }, []);

  const deadlineLabel = useMemo(() => SELECTION_DEADLINE.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }), []);
  const chooseTeam = (team: string) => { setSelectedTeam(team); setIsOpen(false); };
  const saveTeam = () => { if (!selectedTeam || isClosed) return; window.localStorage.setItem(STORAGE_KEY, selectedTeam); setSavedTeam(selectedTeam); };
  const hasUnsavedChange = selectedTeam !== savedTeam;

  return (
    <section className="glass sheen glow-warm animate-rise relative z-50 self-start overflow-visible p-6 sm:p-7" style={{ animationDelay: "220ms" }}>
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary"><Heart className="size-5 icon-lume" /></span><div><h2 className="font-display text-3xl leading-none tracking-wide">Choisir équipe de cœur</h2><p className="mt-1 text-sm text-muted-foreground">Sélectionne ton club favori pour la saison</p></div></div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <button type="button" aria-haspopup="listbox" aria-expanded={isOpen} disabled={isClosed} onClick={() => setIsOpen((open) => !open)} className="tap flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-secondary/35 px-3 text-left shadow-none transition-colors hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50">
            {activeTeam ? <><TeamBadge team={activeTeam} size="sm" /><span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{activeTeam.name}</span></> : <span className="flex-1 text-sm font-bold text-muted-foreground">Sélectionner une équipe</span>}
            <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen && (
            <div role="listbox" aria-label="Équipes de Ligue 1" className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[100] max-h-80 overflow-y-auto rounded-2xl border border-border bg-[#091525] p-2 text-foreground shadow-2xl">
              {TEAMS.map((team) => <button key={team.name} type="button" role="option" aria-selected={selectedTeam === team.name} onClick={() => chooseTeam(team.name)} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-bold transition-colors hover:bg-primary/15 ${selectedTeam === team.name ? "bg-primary/15" : ""}`}><TeamBadge team={team} size="sm" /><span className="flex-1">{team.name}</span>{selectedTeam === team.name && <Check className="size-4 text-accent" />}</button>)}
            </div>
          )}
        </div>
        <button type="button" onClick={saveTeam} disabled={isClosed || !selectedTeam || !hasUnsavedChange} className="tap flex min-w-44 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-primary-foreground shadow-[0_8px_24px_color-mix(in_oklab,var(--primary)_20%,transparent)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">{isClosed ? <Lock className="size-4" /> : <Check className="size-4" />}{isClosed ? "Sélection clôturée" : savedTeam && !hasUnsavedChange ? "Club enregistré" : "Enregistrer"}</button>
      </div>
      {savedTeam && <div className="mt-5 flex items-center gap-3 rounded-2xl border border-mint/20 bg-mint/8 p-3"><TeamBadge team={TEAMS.find((team) => team.name === savedTeam)!} /><div><p className="flex items-center gap-1.5 text-sm font-bold text-mint"><Check className="size-4" /> Club de cœur enregistré</p><p className="font-display text-2xl leading-none tracking-wide text-foreground">{savedTeam}</p></div></div>}
      <p className={`mt-5 text-sm font-medium ${isClosed ? "text-primary" : "text-muted-foreground"}`}>{isClosed ? `Sélection clôturée depuis le début du championnat (${deadlineLabel} à 20 h 45).` : `Date butoir : ${deadlineLabel} à 20 h 45.`}</p>
    </section>
  );
}
