import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/prono/AppShell";
import AdminRoute from "@/components/auth/AdminRoute";
import {
  type Player,
  type Payment,
  type Match,
  type Matchday,
  type Team,
  type Season,
  type Competition,
  type DiscoveredCompetition,
  type AppSettings,
  getPlayers,
  deletePlayer as apiDeletePlayer,
  setPlayerAdmin,
  updatePlayer,
  getPayments,
  setPaymentPaid,
  setPaymentAmount,
  generateMissingPayments,
  getMatches,
  createMatch,
  updateMatch,
  deleteMatch as apiDeleteMatch,
  syncLigue1Matches,
  syncCompetitionMatches,
  getMatchdays,
  createMatchday,
  updateMatchday,
  setMatchdayDeadline,
  setMatchdayAutoMinusOne,
  clearMatchdayDeadline,
  setMatchdayFinished,
  deleteMatchday as apiDeleteMatchday,
  getTeams,
  getSeasons,
  getCompetitions,
  getAvailableCompetitions,
  setCompetitionActive,
  getSettings,
  updateSettings,
} from "@/services/adminService";
import {
  type BonusCandidate,
  type BonusCompetitionCode,
  normalizeCompetitionName,
  selectBestBonusMatch,
} from "@/services/bonusSelectionService";

import {
  Users,
  Wallet,
  Shield,
  ShieldOff,
  Settings as SettingsIcon,
  Calendar,
  RefreshCw,
  CheckCircle2,
  Save,
  Trash2,
  Plus,
  Pencil,
  X,
  Lock,
  Unlock,
  AlertTriangle,
  Crown,
  Gift,
  Timer,
  CalendarClock,
  Check,
  Download,
  Globe,
} from "lucide-react";

/** Onglets de l'espace admin, adressables via le search param `tab`
 * (`/admin?tab=...`) plutôt que par un simple state local, pour rester
 * partageable/bookmarkable. */
const ADMIN_TAB_VALUES = ["joueurs", "paiements", "matchs", "bonus", "reglages"] as const;
export type AdminTab = (typeof ADMIN_TAB_VALUES)[number];

function isAdminTab(value: unknown): value is AdminTab {
  return typeof value === "string" && (ADMIN_TAB_VALUES as readonly string[]).includes(value);
}

type AdminSearch = { tab?: AdminTab };

// L'onglet "Journées" a été fusionné dans "Bonus" (tirage bonus + gestion
// des championnats européens) : un ancien lien/bookmark `?tab=journees`
// doit continuer à pointer quelque part plutôt que de retomber sur l'onglet
// par défaut.
const LEGACY_TAB_REDIRECTS: Record<string, AdminTab> = { journees: "bonus" };

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  validateSearch: (search: Record<string, unknown>): AdminSearch => {
    if (typeof search.tab === "string" && search.tab in LEGACY_TAB_REDIRECTS) {
      return { tab: LEGACY_TAB_REDIRECTS[search.tab] };
    }
    return { tab: isAdminTab(search.tab) ? search.tab : undefined };
  },
});

// ============================================================
// Données club (réutilisées de la page pronostics)
// ============================================================
const OFFICIAL_L1_CLUBS = [
  { id: "angers", name: "Angers SCO", crestUrl: "/logos/ligue1/angers.png" },
  { id: "monaco", name: "AS Monaco", crestUrl: "/logos/ligue1/monaco.png" },
  { id: "auxerre", name: "AJ Auxerre", crestUrl: "/logos/ligue1/auxerre.png" },
  { id: "brest", name: "Stade Brestois 29", crestUrl: "/logos/ligue1/brest.png" },
  { id: "lehavre", name: "Le Havre AC", crestUrl: "/logos/ligue1/lehavre.png" },
  { id: "lemans", name: "Le Mans FC", crestUrl: "/logos/ligue1/lemans.png" },
  { id: "lens", name: "RC Lens", crestUrl: "/logos/ligue1/lens.png" },
  { id: "lorient", name: "FC Lorient", crestUrl: "/logos/ligue1/lorient.png" },
  { id: "lille", name: "LOSC Lille", crestUrl: "/logos/ligue1/lille.png" },
  { id: "ol", name: "Olympique Lyonnais", crestUrl: "/logos/ligue1/ol.png" },
  { id: "om", name: "Olympique de Marseille", crestUrl: "/logos/ligue1/om.png" },
  { id: "parisfc", name: "Paris FC", crestUrl: "/logos/ligue1/parisfc.png" },
  { id: "psg", name: "Paris Saint-Germain", crestUrl: "/logos/ligue1/psg.png" },
  { id: "rennes", name: "Stade Rennais FC", crestUrl: "/logos/ligue1/rennes.png" },
  { id: "strasbourg", name: "RC Strasbourg Alsace", crestUrl: "/logos/ligue1/strasbourg.png" },
  { id: "tfc", name: "Toulouse FC", crestUrl: "/logos/ligue1/tfc.png" },
  { id: "troyes", name: "ESTAC Troyes", crestUrl: "/logos/ligue1/troyes.png" },
  { id: "nice", name: "OGC Nice", crestUrl: "/logos/ligue1/nice.png" },
];

function clubOf(key: string | null | undefined) {
  if (!key) return null;
  const normalized = key.toLowerCase();
  return (
    OFFICIAL_L1_CLUBS.find((c) => c.id === normalized) ||
    OFFICIAL_L1_CLUBS.find((c) => c.name.toLowerCase().includes(normalized)) ||
    null
  );
}

function teamOf(teams: Team[], id: string | null | undefined) {
  if (!id) return null;
  return teams.find((t) => t.id === id) ?? null;
}

/** Forme normalisée consommée par EntityBadge, qu'il s'agisse d'une
 * équipe Supabase (`teams`) ou d'un club officiel L1 codé en dur. */
type BadgeEntity = { name: string; shortName?: string | null; logoUrl?: string | null } | null;

/** Badge générique logo + nom, avec repli sur les initiales si le logo
 * est absent ou casse au chargement. Réutilisé par TeamBadge et ClubBadge
 * ci-dessous, qui ne font plus qu'adapter leur source de données au
 * format BadgeEntity attendu ici. */
function EntityBadge({
  entity,
  fallbackLabel = "—",
  size = "size-6",
  imgClassName = "",
}: {
  entity: BadgeEntity;
  fallbackLabel?: string;
  size?: string;
  imgClassName?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!entity) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
        <span className={`${size} rounded-md bg-slate-800 border border-slate-700`} />
        {fallbackLabel}
      </span>
    );
  }

  const label = entity.shortName || entity.name;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`relative ${size} shrink-0 rounded-md overflow-hidden bg-white/5 border border-slate-800 flex items-center justify-center`}>
        {broken || !entity.logoUrl ? (
          <span className="font-mono text-[8px] font-bold text-slate-300">{label.slice(0, 2).toUpperCase()}</span>
        ) : (
          <img
            src={entity.logoUrl}
            alt={entity.name}
            className={`size-full object-contain ${imgClassName}`}
            onError={() => setBroken(true)}
          />
        )}
      </span>
      <span className="text-xs font-semibold text-slate-200">{label}</span>
    </span>
  );
}

function TeamBadge({ teams, teamId, size = "size-6" }: { teams: Team[]; teamId: string | null; size?: string }) {
  const team = teamOf(teams, teamId);
  return (
    <EntityBadge
      entity={team ? { name: team.name, shortName: team.short_name, logoUrl: team.logo_url } : null}
      size={size}
    />
  );
}

function ClubBadge({ value, size = "size-6" }: { value: string | null; size?: string }) {
  const club = clubOf(value);
  return (
    <EntityBadge
      entity={club ? { name: club.name, logoUrl: club.crestUrl } : null}
      fallbackLabel={value || "—"}
      size={size}
      imgClassName="p-0.5"
    />
  );
}

// ============================================================
// Petits composants UI partagés (style du reste de l'app)
// ============================================================
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-[#0b1325] shadow-inner ${className}`}>
      {children}
    </div>
  );
}

function StatPill({ label, value, tone = "text-emerald-400" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0d1322] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`font-display text-2xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  className = "",
  danger = false,
  title,
  ariaLabel,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  danger?: boolean;
  title?: string;
  /** Libellé accessible explicite — indispensable quand le bouton n'affiche
   * qu'une icône (ex. GhostButton danger de suppression). Vient s'ajouter
   * au `title` (info-bulle), il ne le remplace pas. */
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel ?? title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[11px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white"
          : "border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 ${className}`}
    />
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-300">
      <AlertTriangle size={16} className="shrink-0" />
      {message}
    </div>
  );
}

type ToastMessage = { id: number; message: string };

/** Pile de notifications non bloquantes, en bas d'écran, qui reprend le
 * style d'ErrorBanner. Remplace les alert() natifs du navigateur : chaque
 * toast disparaît de lui-même après quelques secondes ou peut être fermé
 * manuellement. */
function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-amber-500/30 bg-[#0b1325]/95 px-4 py-3 text-xs font-semibold text-amber-300 shadow-2xl backdrop-blur-md"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Fermer la notification"
            className="shrink-0 rounded-lg p-1 text-amber-300/70 transition-colors hover:bg-amber-500/10 hover:text-amber-200"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

const TABLE_MISSING_HINT =
  "Table introuvable dans Supabase. Exécutez le script SQL fourni (supabase_admin_schema.sql) puis synchronisez.";

/** Extrait un message lisible d'une erreur `catch` typée `unknown` (pas de
 * `any`) — utilisé par les handlers ajoutés ci-dessous (score inline,
 * onglet Bonus, Réglages) ; le reste du fichier utilise encore
 * `catch (e: any)`, une convention préexistante non touchée ici. */
function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Enregistre une erreur de chargement sous `key` sans écraser un message
 * déjà présent pour la même clé : les messages distincts se combinent, les
 * doublons ne sont pas répétés. Évite qu'une source fasse disparaître
 * l'erreur d'une autre source rattachée au même onglet. */
function addError(bag: Record<string, string>, key: string, message: string) {
  const previous = bag[key];
  if (!previous) {
    bag[key] = message;
  } else if (!previous.includes(message)) {
    bag[key] = `${previous} ${message}`;
  }
}

// ============================================================
// PAGE ADMIN
// ============================================================
// AdminTab est défini plus haut, à côté de la Route.

const TABS: { id: AdminTab; label: string; icon: typeof Users }[] = [
  { id: "joueurs", label: "Joueurs", icon: Users },
  { id: "paiements", label: "Paiements", icon: Wallet },
  { id: "matchs", label: "Matchs", icon: Calendar },
  { id: "bonus", label: "Bonus", icon: Gift },
  { id: "reglages", label: "Réglages", icon: SettingsIcon },
];

function AdminPage() {
  // L'onglet actif vit dans l'URL (?tab=...) plutôt que dans un simple
  // useState, pour rester adressable (lien partagé, retour arrière, etc.).
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab = search.tab ?? "joueurs";
  function setActiveTab(tab: AdminTab) {
    navigate({ search: (prev: AdminSearch) => ({ ...prev, tab }) });
  }

  // Nettoie l'URL d'un ancien lien/bookmark `?tab=journees` (onglet fusionné
  // dans Bonus) vers `?tab=bonus`, une fois le routeur monté. validateSearch
  // fait déjà pointer `activeTab` sur "bonus" immédiatement ; ceci ne fait
  // que corriger la barre d'adresse pour ne pas perpétuer l'ancien lien.
  useEffect(() => {
    const rawTab = new URLSearchParams(window.location.search).get("tab");
    if (rawTab && rawTab in LEGACY_TAB_REDIRECTS) {
      navigate({ search: (prev: AdminSearch) => ({ ...prev, tab: LEGACY_TAB_REDIRECTS[rawTab] }), replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const [players, setPlayers] = useState<Player[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Notifications non bloquantes (remplace les alert() natifs) — voir ToastStack.
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  function notify(message: string) {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function clearErrors(keys: string[]) {
    setErrors((prev) => {
      const next = { ...prev };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  }

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    setLoading(true);
    await loadAll();
    setLoading(false);
  }

  async function loadAll() {
    const nextErrors: Record<string, string> = {};

    // Les 8 sources sont indépendantes : on les charge en parallèle plutôt
    // qu'en série pour diviser le temps de chargement par ~8, et on garde
    // Promise.allSettled pour qu'un échec isolé (ex. table manquante)
    // n'empêche pas les autres sources de s'afficher.
    const [
      playersResult,
      paymentsResult,
      matchesResult,
      matchdaysResult,
      teamsResult,
      seasonsResult,
      competitionsResult,
      settingsResult,
    ] = await Promise.allSettled([
      getPlayers(),
      getPayments(),
      getMatches(),
      getMatchdays(),
      getTeams(),
      getSeasons(),
      getCompetitions(),
      getSettings(),
    ]);

    if (playersResult.status === "fulfilled") {
      setPlayers(playersResult.value);
    } else {
      console.error(playersResult.reason);
      addError(nextErrors, "joueurs", "Impossible de charger les joueurs.");
    }

    if (paymentsResult.status === "fulfilled") {
      setPayments(paymentsResult.value);
    } else {
      console.warn("payments:", paymentsResult.reason);
      addError(nextErrors, "paiements", TABLE_MISSING_HINT);
    }

    if (matchesResult.status === "fulfilled") {
      setMatches(matchesResult.value);
    } else {
      console.warn("matches:", matchesResult.reason);
      addError(nextErrors, "matchs", TABLE_MISSING_HINT);
    }

    if (matchdaysResult.status === "fulfilled") {
      setMatchdays(matchdaysResult.value);
    } else {
      console.warn("matchdays:", matchdaysResult.reason);
      addError(nextErrors, "bonus", TABLE_MISSING_HINT);
    }

    if (teamsResult.status === "fulfilled") {
      setTeams(teamsResult.value);
    } else {
      console.warn("teams:", teamsResult.reason);
      // Clé distincte de "matchs" : les équipes ne sont qu'un référentiel
      // utilisé par le formulaire de l'onglet Matchs, pas l'onglet lui-même.
      // Les confondre affichait par le passé le badge d'erreur sur le
      // mauvais onglet.
      addError(nextErrors, "equipes", TABLE_MISSING_HINT);
    }

    if (seasonsResult.status === "fulfilled") {
      setSeasons(seasonsResult.value);
    } else {
      console.warn("seasons:", seasonsResult.reason);
      addError(nextErrors, "bonus", TABLE_MISSING_HINT);
    }

    if (competitionsResult.status === "fulfilled") {
      setCompetitions(competitionsResult.value);
    } else {
      console.warn("competitions:", competitionsResult.reason);
      addError(nextErrors, "bonus", TABLE_MISSING_HINT);
    }

    if (settingsResult.status === "fulfilled") {
      setSettings(settingsResult.value);
    } else {
      console.warn("app_settings:", settingsResult.reason);
      addError(nextErrors, "reglages", TABLE_MISSING_HINT);
    }

    setErrors(nextErrors);
  }

  async function handleSync() {
    setSyncing(true);
    await loadAll();
    setSyncSuccess(true);
    setSyncing(false);
    setTimeout(() => setSyncSuccess(false), 2500);
  }

  const entryFee = settings?.entry_fee ?? 10;

  const paidCount = useMemo(() => payments.filter((p) => p.paid).length, [payments]);
  const totalCollected = useMemo(
    () => payments.filter((p) => p.paid).reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [payments],
  );
  const totalExpected = useMemo(() => players.length * entryFee, [players, entryFee]);
  const adminCount = useMemo(() => players.filter((p) => p.is_admin).length, [players]);
  const openMatchdaysCount = useMemo(() => matchdays.filter((m) => !m.is_finished).length, [matchdays]);

  if (loading) {
    return (
      <AdminRoute>
        <AppShell>
          <div className="flex h-[70vh] items-center justify-center">
            <RefreshCw className="animate-spin text-emerald-400" size={42} />
          </div>
        </AppShell>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <AppShell>
        <div className="mx-auto max-w-6xl space-y-6 pb-32">
          {/* ================= EN-TÊTE ================= */}
          <section className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-[#060b16] p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(ellipse 65% 55% at 88% -10%, rgba(16,185,129,0.20), transparent 70%)",
              }}
            />
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.14em] text-emerald-400">
                  <Shield size={12} />
                  ESPACE ADMINISTRATEUR
                </div>
                <h1 className="font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
                  Gestion de la ligue
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Joueurs, paiements, matchs, journées et réglages de la saison {settings?.season ?? "2026-2027"}.
                </p>
              </div>

              <GhostButton onClick={handleSync} className="!px-4 !py-2.5">
                {syncSuccess ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                )}
                {syncSuccess ? "Synchronisé" : "Synchroniser"}
              </GhostButton>
            </div>

            {/* Stats rapides */}
            <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatPill label="Joueurs" value={String(players.length)} />
              <StatPill label="Admins" value={String(adminCount)} tone="text-sky-400" />
              <StatPill label="Cagnotte" value={`${totalCollected}€`} tone="text-gold" />
              <StatPill label="Journées ouvertes" value={String(openMatchdaysCount)} tone="text-mint" />
            </div>
          </section>

          {/* ================= NAVIGATION ONGLETS ================= */}
          <nav className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-800 bg-[#0d1322]/90 p-1.5 shadow-inner">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const hasError = !!errors[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-bold uppercase tracking-wide transition-all ${
                    isActive
                      ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                  {hasError && (
                    <span className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* ================= CONTENU ================= */}
          {activeTab === "joueurs" && (
            <PlayersTab
              players={players}
              setPlayers={setPlayers}
              error={errors.joueurs}
              onChanged={async () => setPlayers(await getPlayers())}
              notify={notify}
            />
          )}

          {activeTab === "paiements" && (
            <PaymentsTab
              players={players}
              payments={payments}
              setPayments={setPayments}
              entryFee={entryFee}
              paidCount={paidCount}
              totalCollected={totalCollected}
              totalExpected={totalExpected}
              error={errors.paiements}
              onChanged={async () => setPayments(await getPayments())}
              notify={notify}
            />
          )}

          {activeTab === "matchs" && (
            <MatchesTab
              matches={matches}
              setMatches={setMatches}
              matchdays={matchdays}
              teams={teams}
              error={errors.matchs}
              teamsError={errors.equipes}
              clearErrors={clearErrors}
              onChanged={async () => setMatches(await getMatches())}
              refreshMatchdays={async () => setMatchdays(await getMatchdays())}
              notify={notify}
            />
          )}

          {activeTab === "bonus" && (
            <BonusTab
              matchdays={matchdays}
              setMatchdays={setMatchdays}
              matches={matches}
              teams={teams}
              seasons={seasons}
              competitions={competitions}
              settings={settings}
              error={errors.bonus}
              onChanged={async () => {
                setMatchdays(await getMatchdays());
                setMatches(await getMatches());
              }}
              onCompetitionsChanged={async () => setCompetitions(await getCompetitions())}
              onSettingsChanged={async () => setSettings(await getSettings())}
              notify={notify}
            />
          )}

          {activeTab === "reglages" && (
            <SettingsTab
              settings={settings}
              error={errors.reglages}
              onChanged={async () => setSettings(await getSettings())}
              notify={notify}
            />
          )}
        </div>

        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </AppShell>
    </AdminRoute>
  );
}

// ============================================================
// 👥 ONGLET JOUEURS (Mis à jour avec Équipe favorite et Dérogation admin - Phases 2, 3, 4)
// ============================================================
function PlayersTab({
  players,
  setPlayers,
  error,
  onChanged,
  notify,
}: {
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  error?: string;
  onChanged: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);
  const [editing, setEditing] = useState<Player | null>(null);
  const [editForm, setEditForm] = useState({ pseudo: "", favorite_team: "" });
  const [saving, setSaving] = useState(false);

  function openEdit(player: Player) {
    setEditing(player);
    setEditForm({ pseudo: player.pseudo ?? "", favorite_team: player.favorite_team ?? "" });
  }

  async function submitEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await updatePlayer(editing.id, {
        pseudo: editForm.pseudo.trim() || null,
        favorite_team: editForm.favorite_team || null,
        favorite_team_override: true, // Phase 4 : Dérogation admin active lors de la modification admin
      });
      setEditing(null);
      await onChanged();
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la modification du joueur.");
    } finally {
      setSaving(false);
    }
  }

  // Mise à jour optimiste : le rôle change à l'écran immédiatement, sans
  // attendre Supabase. On ne resynchronise (refetch complet) qu'en cas
  // d'erreur, pour revenir à un état garanti cohérent.
  async function toggleAdmin(player: Player) {
    setBusyId(player.id);
    const nextIsAdmin = !player.is_admin;
    setPlayers((prev) => prev.map((p) => (p.id === player.id ? { ...p, is_admin: nextIsAdmin } : p)));
    try {
      await setPlayerAdmin(player.id, nextIsAdmin);
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la mise à jour.");
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  // Idem : le joueur disparaît du tableau tout de suite. En cas d'échec de
  // la suppression côté Supabase, on resynchronise pour le faire réapparaître.
  async function confirmAndDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setBusyId(target.id);
    setPlayers((prev) => prev.filter((p) => p.id !== target.id));
    setConfirmDelete(null);
    try {
      await apiDeletePlayer(target.id);
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la suppression.");
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <Users size={18} className="text-emerald-400" />
          Joueurs ({players.length})
        </h2>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {players.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun joueur pour le moment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-left font-mono text-[10px] uppercase tracking-widest text-slate-500">
                <th className="pb-2 pr-3">Joueur</th>
                <th className="pb-2 pr-3">Équipe favorite</th>
                <th className="pb-2 pr-3">Statut</th>
                <th className="pb-2 pr-3">Rôle</th>
                <th className="pb-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-slate-700 bg-slate-800">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt={player.pseudo ?? ""} className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center font-display text-sm font-bold text-slate-400">
                            {(player.pseudo ?? "?").slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-100">{player.pseudo ?? "Sans pseudo"}</div>
                        <div className="truncate font-mono text-[10px] text-slate-500">{player.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <ClubBadge value={player.favorite_team} />
                  </td>
                  <td className="py-3 pr-3">
                    {player.favorite_team ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-mono">
                        <Check size={14} /> {player.favorite_team_override ? "Modifié (Admin)" : "OK"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-mono">
                        <AlertTriangle size={14} /> En attente
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {player.is_admin ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 font-mono text-[10px] font-bold text-gold">
                        <Crown size={11} />
                        ADMIN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-400">
                        JOUEUR
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-0 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <GhostButton onClick={() => openEdit(player)} title="Modifier">
                        <Pencil size={12} />
                        Modifier
                      </GhostButton>
                      <GhostButton onClick={() => toggleAdmin(player)} title="Basculer le rôle">
                        {busyId === player.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : player.is_admin ? (
                          <ShieldOff size={12} />
                        ) : (
                          <Shield size={12} />
                        )}
                        {player.is_admin ? "Rétrograder" : "Promouvoir"}
                      </GhostButton>
                      <GhostButton
                        danger
                        onClick={() => setConfirmDelete(player)}
                        title="Supprimer"
                        ariaLabel={`Supprimer le joueur ${player.pseudo ?? player.id}`}
                      >
                        <Trash2 size={12} />
                      </GhostButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title="Modifier le joueur" onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Pseudo
              </label>
              <TextInput
                value={editForm.pseudo}
                onChange={(e) => setEditForm((f) => ({ ...f, pseudo: e.target.value }))}
                placeholder="Pseudo du joueur"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Équipe favorite
              </label>
              <select
                value={editForm.favorite_team}
                onChange={(e) => setEditForm((f) => ({ ...f, favorite_team: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              >
                <option value="">— Aucune —</option>
                {OFFICIAL_L1_CLUBS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <GhostButton onClick={() => setEditing(null)}>Annuler</GhostButton>
              <PrimaryButton onClick={submitEdit} disabled={saving}>
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Supprimer ce joueur ?"
          description={`${confirmDelete.pseudo ?? "Ce joueur"} sera définitivement supprimé, ainsi que ses pronostics et paiements associés.`}
          confirmLabel="Supprimer"
          busy={busyId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmAndDelete}
        />
      )}
    </Card>
  );
}

// ============================================================
// 💳 ONGLET PAIEMENTS
// ============================================================
function PaymentsTab({
  players,
  payments,
  setPayments,
  entryFee,
  paidCount,
  totalCollected,
  totalExpected,
  error,
  onChanged,
  notify,
}: {
  players: Player[];
  payments: Payment[];
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  entryFee: number;
  paidCount: number;
  totalCollected: number;
  totalExpected: number;
  error?: string;
  onChanged: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [search, setSearch] = useState("");

  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return payments;
    return payments.filter((payment) => {
      const pseudo = playerById.get(payment.user_id)?.pseudo ?? "";
      return pseudo.toLowerCase().includes(query);
    });
  }, [payments, playerById, search]);

  // Mise à jour optimiste : le badge de statut change immédiatement, on ne
  // resynchronise depuis Supabase qu'en cas d'échec de la requête.
  async function togglePaid(payment: Payment) {
    setBusyId(payment.id);
    const nextPaid = !payment.paid;
    setPayments((prev) => prev.map((p) => (p.id === payment.id ? { ...p, paid: nextPaid } : p)));
    try {
      await setPaymentPaid(payment.id, nextPaid);
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la mise à jour.");
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function saveAmount(payment: Payment) {
    const raw = editingAmount[payment.id];
    if (raw === undefined) return;
    const amount = Number(raw.replace(",", "."));
    if (Number.isNaN(amount) || amount < 0) return;

    setBusyId(payment.id);
    try {
      await setPaymentAmount(payment.id, amount);
      await onChanged();
      setEditingAmount((prev) => {
        const next = { ...prev };
        delete next[payment.id];
        return next;
      });
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la mise à jour du montant.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerateMissing() {
    setGenerating(true);
    try {
      await generateMissingPayments(players, payments, entryFee);
      await onChanged();
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la génération des paiements.");
    } finally {
      setGenerating(false);
      setConfirmGenerate(false);
    }
  }

  const missingCount = players.length - payments.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="Payé" value={`${paidCount} / ${players.length}`} />
        <StatPill label="Collecté" value={`${totalCollected}€`} tone="text-gold" />
        <StatPill label="Attendu" value={`${totalExpected}€`} tone="text-sky-400" />
        <StatPill label="Restant" value={`${Math.max(totalExpected - totalCollected, 0)}€`} tone="text-red-400" />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
            <Wallet size={18} className="text-emerald-400" />
            Paiements
            <span className="ml-1 rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-300">
              {paidCount} payé{paidCount > 1 ? "s" : ""} / {players.length} inscrit{players.length > 1 ? "s" : ""}
            </span>
          </h2>
          {missingCount > 0 && (
            <PrimaryButton onClick={() => setConfirmGenerate(true)} disabled={generating}>
              {generating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              Générer {missingCount} paiement{missingCount > 1 ? "s" : ""} manquant{missingCount > 1 ? "s" : ""}
            </PrimaryButton>
          )}
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        {!error && payments.length > 0 && (
          <div className="mb-4">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un joueur…"
              className="!max-w-xs"
            />
          </div>
        )}

        {!error && payments.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Aucun paiement enregistré. Génère les paiements pour commencer.
          </p>
        ) : !error && filteredPayments.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Aucun joueur ne correspond à « {search} ».</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-left font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  <th className="pb-2 pr-3">Joueur</th>
                  <th className="pb-2 pr-3">Montant</th>
                  <th className="pb-2 pr-3">Statut</th>
                  <th className="pb-2 pr-3">Date de paiement</th>
                  <th className="pb-2 pr-0 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const player = playerById.get(payment.user_id);
                  const editValue = editingAmount[payment.id];
                  return (
                    <tr key={payment.id} className="border-b border-slate-800/60 last:border-0">
                      <td className="py-3 pr-3 font-semibold text-slate-100">
                        {player?.pseudo ?? "Joueur inconnu"}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <TextInput
                            inputMode="decimal"
                            className="!w-24 !py-1.5"
                            value={editValue ?? String(payment.amount)}
                            onChange={(e) =>
                              setEditingAmount((prev) => ({ ...prev, [payment.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveAmount(payment);
                            }}
                          />
                          <span className="text-xs text-slate-500">€</span>
                          {editValue !== undefined && editValue !== String(payment.amount) && (
                            <GhostButton
                              onClick={() => saveAmount(payment)}
                              title="Enregistrer le montant"
                              ariaLabel={`Enregistrer le montant de ${player?.pseudo ?? "ce joueur"}`}
                            >
                              {busyId === payment.id ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : (
                                <Save size={12} />
                              )}
                            </GhostButton>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        {payment.paid ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 font-mono text-[10px] font-bold text-mint">
                            <CheckCircle2 size={11} />
                            PAYÉ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-red-400">
                            <AlertTriangle size={11} />
                            NON PAYÉ
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-slate-400">
                        {payment.payment_date
                          ? new Date(payment.payment_date).toLocaleDateString("fr-FR", { dateStyle: "medium" })
                          : "—"}
                      </td>
                      <td className="py-3 pr-0 text-right">
                        <GhostButton onClick={() => togglePaid(payment)}>
                          {busyId === payment.id ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={12} />
                          )}
                          {payment.paid ? "Marquer non payé" : "Marquer payé"}
                        </GhostButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {confirmGenerate && (
        <ConfirmDialog
          title="Générer les paiements manquants ?"
          description={`${missingCount} paiement${missingCount > 1 ? "s" : ""} de ${entryFee}€ ${
            missingCount > 1 ? "seront créés" : "sera créé"
          } pour les joueurs qui n'en ont pas encore.`}
          confirmLabel="Générer"
          tone="primary"
          busy={generating}
          onCancel={() => setConfirmGenerate(false)}
          onConfirm={handleGenerateMissing}
        />
      )}
    </div>
  );
}

// ============================================================
// ⚽ ONGLET MATCHS
// ============================================================
const emptyMatchForm = {
  matchday_id: "",
  home_team_id: "",
  away_team_id: "",
  kickoff: "",
  finished: false,
};

/** Statut d'affichage dérivé (il n'existe pas de colonne "status" en base). */
function matchDisplayStatus(match: Pick<Match, "finished" | "kickoff">): "scheduled" | "live" | "finished" {
  if (match.finished) return "finished";
  if (match.kickoff && new Date(match.kickoff).getTime() <= Date.now()) return "live";
  return "scheduled";
}

function matchdayLabel(md: Matchday | null | undefined) {
  if (!md) return "—";
  return `J${md.number}`;
}

/** Détermine la journée à afficher par défaut à l'ouverture de l'onglet :
 * la journée "en cours" (aujourd'hui tombe dans sa plage de coups d'envoi,
 * + 3h de tolérance pour couvrir un match encore en jeu), sinon la
 * prochaine journée à venir, sinon la dernière journée jouée, sinon la
 * première journée connue. */
function computeDefaultMatchdayId(matchdays: Matchday[], matches: Match[]): string | null {
  const sorted = [...matchdays].sort((a, b) => a.number - b.number);
  if (sorted.length === 0) return null;

  const rangeByMatchday = new Map<string, { min: number; max: number }>();
  matches.forEach((m) => {
    if (!m.matchday_id || !m.kickoff) return;
    const t = new Date(m.kickoff).getTime();
    if (Number.isNaN(t)) return;
    const range = rangeByMatchday.get(m.matchday_id);
    if (range) {
      range.min = Math.min(range.min, t);
      range.max = Math.max(range.max, t);
    } else {
      rangeByMatchday.set(m.matchday_id, { min: t, max: t });
    }
  });

  const now = Date.now();
  const THREE_HOURS = 3 * 60 * 60 * 1000;

  const ongoing = sorted.find((md) => {
    const range = rangeByMatchday.get(md.id);
    return range && now >= range.min && now <= range.max + THREE_HOURS;
  });
  if (ongoing) return ongoing.id;

  let next: Matchday | null = null;
  for (const md of sorted) {
    const range = rangeByMatchday.get(md.id);
    if (range && range.min > now) {
      if (!next || range.min < rangeByMatchday.get(next.id)!.min) next = md;
    }
  }
  if (next) return next.id;

  const withMatches = sorted.filter((md) => rangeByMatchday.has(md.id));
  if (withMatches.length > 0) return withMatches[withMatches.length - 1].id;

  return sorted[0].id;
}

function MatchesTab({
  matches,
  setMatches,
  matchdays,
  teams,
  error,
  teamsError,
  onChanged,
  refreshMatchdays,
  notify,
  clearErrors,
}: {
  matches: Match[];
  setMatches: React.Dispatch<React.SetStateAction<Match[]>>;
  matchdays: Matchday[];
  teams: Team[];
  error?: string;
  teamsError?: string;
  onChanged: () => Promise<void>;
  refreshMatchdays: () => Promise<void>;
  notify: (message: string) => void;
  clearErrors: (keys: string[]) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [form, setForm] = useState(emptyMatchForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Match | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncingApi, setSyncingApi] = useState(false);

  // Sélecteur de journée : "all" affiche tout, sinon l'id de la journée
  // choisie. `null` = pas encore initialisé (le premier effet ci-dessous
  // pose la journée courante/prochaine dès que les données sont là), pour
  // ne pas écraser un choix déjà fait par l'admin lors d'un simple refetch.
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string | "all" | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, { home: string; away: string }>>({});
  const [savingScoreId, setSavingScoreId] = useState<string | null>(null);

  const matchdaysById = useMemo(() => new Map(matchdays.map((md) => [md.id, md])), [matchdays]);

  // Cet onglet ne montre que la Ligue 1 : les autres championnats européens
  // (synchronisés depuis l'onglet Bonus) portent un match_type distinct de
  // "LIGUE1" et vivent dans leur propre liste là-bas.
  const ligue1Matches = useMemo(
    () => matches.filter((m) => (m.match_type ?? "LIGUE1") === "LIGUE1"),
    [matches],
  );
  const ligue1MatchdayIds = useMemo(
    () => new Set(ligue1Matches.map((m) => m.matchday_id).filter((id): id is string => !!id)),
    [ligue1Matches],
  );
  const sortedMatchdays = useMemo(
    () => matchdays.filter((md) => ligue1MatchdayIds.has(md.id)).sort((a, b) => a.number - b.number),
    [matchdays, ligue1MatchdayIds],
  );

  useEffect(() => {
    if (selectedMatchdayId !== null || sortedMatchdays.length === 0) return;
    setSelectedMatchdayId(computeDefaultMatchdayId(sortedMatchdays, ligue1Matches) ?? "all");
  }, [sortedMatchdays, ligue1Matches, selectedMatchdayId]);

  const visibleMatches = useMemo(() => {
    if (selectedMatchdayId === null || selectedMatchdayId === "all") return ligue1Matches;
    return ligue1Matches.filter((m) => m.matchday_id === selectedMatchdayId);
  }, [ligue1Matches, selectedMatchdayId]);

  function scoreDraftFor(match: Match) {
    return (
      scoreDrafts[match.id] ?? {
        home: match.home_score === null || match.home_score === undefined ? "" : String(match.home_score),
        away: match.away_score === null || match.away_score === undefined ? "" : String(match.away_score),
      }
    );
  }

  function setScoreDraft(match: Match, patch: Partial<{ home: string; away: string }>) {
    setScoreDrafts((prev) => ({ ...prev, [match.id]: { ...scoreDraftFor(match), ...patch } }));
  }

  // Sauvegarde manuelle du score, y compris sur un match "à venir" : les
  // deux champs présents et numériques font basculer `finished` à true
  // automatiquement (seul signal de statut porté par le modèle actuel,
  // voir matchDisplayStatus) ; un score partiel n'y touche pas.
  async function saveScore(match: Match) {
    const draft = scoreDraftFor(match);
    const homeRaw = draft.home.trim();
    const awayRaw = draft.away.trim();
    const home = homeRaw === "" ? null : Number(homeRaw);
    const away = awayRaw === "" ? null : Number(awayRaw);
    if ((home !== null && Number.isNaN(home)) || (away !== null && Number.isNaN(away))) {
      notify("Le score doit être un nombre.");
      return;
    }
    if (home !== null && home < 0) return notify("Le score domicile ne peut pas être négatif.");
    if (away !== null && away < 0) return notify("Le score extérieur ne peut pas être négatif.");

    setSavingScoreId(match.id);
    try {
      const bothPresent = home !== null && away !== null;
      await updateMatch(match.id, {
        home_score: home,
        away_score: away,
        finished: bothPresent ? true : match.finished,
      });
      setScoreDrafts((prev) => {
        const next = { ...prev };
        delete next[match.id];
        return next;
      });
      await onChanged();
    } catch (e) {
      notify(errorMessage(e, "Erreur lors de l'enregistrement du score."));
    } finally {
      setSavingScoreId(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyMatchForm);
    setFormOpen(true);
  }

  function openEdit(match: Match) {
    setEditing(match);
    setForm({
      matchday_id: match.matchday_id ?? "",
      home_team_id: match.home_team_id ?? "",
      away_team_id: match.away_team_id ?? "",
      kickoff: match.kickoff ? match.kickoff.slice(0, 16) : "",
      finished: match.finished,
    });
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.home_team_id || !form.away_team_id || !form.kickoff) {
      notify("Renseigne les deux équipes et la date/heure du match.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        matchday_id: form.matchday_id || null,
        home_team_id: form.home_team_id,
        away_team_id: form.away_team_id,
        kickoff: new Date(form.kickoff).toISOString(),
        finished: form.finished,
        home_score: editing?.home_score ?? null,
        away_score: editing?.away_score ?? null,
      };

      if (editing) {
        await updateMatch(editing.id, payload);
      } else {
        await createMatch(payload);
      }

      setFormOpen(false);
      await onChanged();
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de l'enregistrement du match.");
    } finally {
      setSaving(false);
    }
  }

  // Optimiste : le match quitte la liste immédiatement : on ne resynchronise
  // depuis Supabase que si la suppression échoue réellement côté serveur.
  async function confirmAndDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setBusyId(target.id);
    setMatches((prev) => prev.filter((m) => m.id !== target.id));
    setConfirmDelete(null);
    try {
      await apiDeleteMatch(target.id);
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la suppression.");
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  // Synchronise via l'API Vercel /api/ligue1/matchs, puis rafraîchit les
  // matchs et journées. Aucune Edge Function Supabase n'est utilisée ici.
  async function handleSyncFromApi() {
    setSyncingApi(true);
    try {
      const summary = await syncLigue1Matches();
      await Promise.all([onChanged(), refreshMatchdays()]);
      // Une ancienne erreur de chargement ne doit pas rester affichée après
      // une synchronisation réussie.
      clearErrors(["matchs", "bonus", "equipes"]);

      const parts = [`${summary.created} créé(s)`, `${summary.updated} mis à jour`];
      if (summary.skipped > 0) parts.push(`${summary.skipped} ignoré(s)`);
      if (summary.matchdaysCreated > 0) parts.push(`${summary.matchdaysCreated} journée(s) créée(s)`);
      notify(`Synchronisation terminée : ${parts.join(", ")}.`);

      if (summary.warnings.length > 0) {
        summary.warnings.forEach((w) => console.warn("[sync-ligue1-matches]", w));
        notify(
          `${summary.warnings.length} équipe(s)/match(s) ignoré(s) faute de correspondance dans team_api_mapping (détail dans la console).`,
        );
      }
      if (summary.errors.length > 0) {
        summary.errors.forEach((err) => console.error("[sync-ligue1-matches]", err));
        notify(`${summary.errors.length} erreur(s) pendant la synchronisation (détail dans la console).`);
      }
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la synchronisation football-data.org.");
    } finally {
      setSyncingApi(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <Calendar size={18} className="text-emerald-400" />
          Matchs Ligue 1 ({visibleMatches.length}/{ligue1Matches.length})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <GhostButton
            onClick={handleSyncFromApi}
            disabled={syncingApi}
            ariaLabel="Synchroniser les matchs depuis football-data.org"
          >
            {syncingApi ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            {syncingApi ? "Synchronisation…" : "Synchroniser depuis football-data.org"}
          </GhostButton>
          <PrimaryButton onClick={openCreate}>
            <Plus size={14} />
            Ajouter un match
          </PrimaryButton>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* Erreur distincte : les équipes ne se chargent pas forcément en
          même temps que les matchs (bug corrigé — voir addError côté page). */}
      {teamsError && (
        <div className="mb-4">
          <ErrorBanner message={teamsError} />
        </div>
      )}

      {sortedMatchdays.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-800 bg-[#0d1322]/90 p-1.5">
          <button
            type="button"
            onClick={() => setSelectedMatchdayId("all")}
            className={`shrink-0 rounded-xl px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide transition-all ${
              selectedMatchdayId === "all"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            Toutes
          </button>
          {sortedMatchdays.map((md) => (
            <button
              key={md.id}
              type="button"
              onClick={() => setSelectedMatchdayId(md.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide transition-all ${
                selectedMatchdayId === md.id
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              J{md.number}
            </button>
          ))}
        </div>
      )}

      {!error && visibleMatches.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {ligue1Matches.length === 0 ? "Aucun match enregistré pour le moment." : "Aucun match pour cette journée."}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleMatches.map((match) => {
            const draft = scoreDraftFor(match);
            const hasDraftEdit = scoreDrafts[match.id] !== undefined;
            return (
            <div
              key={match.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0d1322] px-4 py-3"
            >
              <div className="flex items-center gap-4">
                <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 font-mono text-[10px] font-bold text-slate-400">
                  {matchdayLabel(matchdaysById.get(match.matchday_id ?? ""))}
                </span>
                <div className="flex items-center gap-2">
                  <TeamBadge teams={teams} teamId={match.home_team_id} />
                  <span className="text-slate-600">vs</span>
                  <TeamBadge teams={teams} teamId={match.away_team_id} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-400">
                  {match.kickoff ? new Date(match.kickoff).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </span>
                <StatusBadge status={matchDisplayStatus(match)} />

                {/* Score inline : éditable même sur un match "à venir" — la
                    sauvegarde bascule automatiquement `finished` à true dès
                    que les deux scores sont renseignés (voir saveScore). */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={draft.home}
                    onChange={(e) => setScoreDraft(match, { home: e.target.value })}
                    onBlur={() => hasDraftEdit && saveScore(match)}
                    onKeyDown={(e) => e.key === "Enter" && saveScore(match)}
                    aria-label={`Score domicile ${teamOf(teams, match.home_team_id)?.name ?? "?"}`}
                    className="w-12 rounded-lg border border-slate-700 bg-[#060b16] px-1.5 py-1 text-center text-xs font-bold text-slate-100 outline-none focus:border-emerald-500/60"
                  />
                  <span className="text-slate-600">-</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={draft.away}
                    onChange={(e) => setScoreDraft(match, { away: e.target.value })}
                    onBlur={() => hasDraftEdit && saveScore(match)}
                    onKeyDown={(e) => e.key === "Enter" && saveScore(match)}
                    aria-label={`Score extérieur ${teamOf(teams, match.away_team_id)?.name ?? "?"}`}
                    className="w-12 rounded-lg border border-slate-700 bg-[#060b16] px-1.5 py-1 text-center text-xs font-bold text-slate-100 outline-none focus:border-emerald-500/60"
                  />
                  {hasDraftEdit && (
                    <GhostButton
                      onClick={() => saveScore(match)}
                      title="Enregistrer le score"
                      ariaLabel={`Enregistrer le score de ${teamOf(teams, match.home_team_id)?.name ?? "?"} vs ${
                        teamOf(teams, match.away_team_id)?.name ?? "?"
                      }`}
                    >
                      {savingScoreId === match.id ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                    </GhostButton>
                  )}
                </div>

                <GhostButton
                  onClick={() => openEdit(match)}
                  title="Modifier"
                  ariaLabel={`Modifier le match ${teamOf(teams, match.home_team_id)?.name ?? "?"} vs ${
                    teamOf(teams, match.away_team_id)?.name ?? "?"
                  }`}
                >
                  <Pencil size={12} />
                </GhostButton>
                <GhostButton
                  danger
                  onClick={() => setConfirmDelete(match)}
                  title="Supprimer"
                  ariaLabel={`Supprimer le match ${teamOf(teams, match.home_team_id)?.name ?? "?"} vs ${
                    teamOf(teams, match.away_team_id)?.name ?? "?"
                  }`}
                >
                  {busyId === match.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </GhostButton>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <Modal title={editing ? "Modifier le match" : "Ajouter un match"} onClose={() => setFormOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Journée
              </label>
              <select
                value={form.matchday_id}
                onChange={(e) => setForm((f) => ({ ...f, matchday_id: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              >
                <option value="">— Aucune —</option>
                {matchdays.map((md) => (
                  <option key={md.id} value={md.id}>
                    {matchdayLabel(md)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Équipe à domicile
                </label>
                <select
                  value={form.home_team_id}
                  onChange={(e) => setForm((f) => ({ ...f, home_team_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                >
                  <option value="">Choisir…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Équipe à l'extérieur
                </label>
                <select
                  value={form.away_team_id}
                  onChange={(e) => setForm((f) => ({ ...f, away_team_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                >
                  <option value="">Choisir…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Date et heure
                </label>
                <TextInput
                  type="datetime-local"
                  value={form.kickoff}
                  onChange={(e) => setForm((f) => ({ ...f, kickoff: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Statut
                </label>
                <select
                  value={form.finished ? "finished" : "scheduled"}
                  onChange={(e) => setForm((f) => ({ ...f, finished: e.target.value === "finished" }))}
                  className="w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                >
                  <option value="scheduled">À venir / en cours</option>
                  <option value="finished">Terminé</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <GhostButton onClick={() => setFormOpen(false)}>Annuler</GhostButton>
              <PrimaryButton onClick={submitForm} disabled={saving}>
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {editing ? "Enregistrer" : "Ajouter"}
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Supprimer ce match ?"
          description={`Le match ${teamOf(teams, confirmDelete.home_team_id)?.name ?? "?"} vs ${
            teamOf(teams, confirmDelete.away_team_id)?.name ?? "?"
          } sera définitivement supprimé.`}
          confirmLabel="Supprimer"
          busy={busyId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmAndDelete}
        />
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: "À venir", className: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
    live: { label: "En direct", className: "border-red-500/30 bg-red-500/10 text-red-400 animate-pulse" },
    finished: { label: "Terminé", className: "border-slate-700 bg-slate-800/60 text-slate-400" },
  };
  const conf = map[status] ?? map.scheduled;
  return (
    <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold ${conf.className}`}>
      {conf.label.toUpperCase()}
    </span>
  );
}

// ============================================================
// 🎁 ONGLET BONUS
// ============================================================
// Remplace l'ancien onglet "Journées" : point d'entrée unique pour tout ce
// qui touche au bonus (tirage de la sélection premium) et aux championnats
// hors Ligue 1 (activation, synchronisation football-data.org). La gestion
// des journées elle-même (création, verrouillage) vit ici aussi, reprise
// telle quelle — les journées sont une notion transverse à tous les
// championnats, pas seulement à la Ligue 1 (voir l'onglet Matchs, scopé
// Ligue 1 uniquement).
function BonusTab({
  matchdays,
  setMatchdays,
  matches,
  teams,
  seasons,
  competitions,
  settings,
  error,
  onChanged,
  onCompetitionsChanged,
  onSettingsChanged,
  notify,
}: {
  matchdays: Matchday[];
  setMatchdays: React.Dispatch<React.SetStateAction<Matchday[]>>;
  matches: Match[];
  teams: Team[];
  seasons: Season[];
  competitions: Competition[];
  settings: AppSettings | null;
  error?: string;
  onChanged: () => Promise<void>;
  onCompetitionsChanged: () => Promise<void>;
  onSettingsChanged: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [number, setNumber] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lockBusyId, setLockBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Matchday | null>(null);
  const [editing, setEditing] = useState<Matchday | null>(null);
  const [editForm, setEditForm] = useState({ number: "", seasonId: "", competitionId: "", deadline: "", deadlineMode: "manual" as "manual" | "auto_minus_1" });
  const [saving, setSaving] = useState(false);

  // Sélection bonus : état local pour cette première étape.
  // La persistance Supabase sera branchée dans adminService après validation de l'UI.
  const [bonusSelections, setBonusSelections] = useState<Record<string, Partial<Record<BonusCompetitionCode, BonusCandidate>>>>({});
  const [generatingBonus, setGeneratingBonus] = useState(false);
  const [replacingBonus, setReplacingBonus] = useState<BonusCompetitionCode | null>(null);

  // Championnats (grandes ligues européennes hors Ligue 1) : la liste
  // disponible vient de football-data.org, pas d'une constante codée en dur.
  const [availableCompetitions, setAvailableCompetitions] = useState<DiscoveredCompetition[]>([]);
  const [competitionsLoaded, setCompetitionsLoaded] = useState(false);
  const [loadingCompetitions, setLoadingCompetitions] = useState(false);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);
  const [syncingCode, setSyncingCode] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  // Période d'éligibilité des matchs au tirage bonus (app_settings —
  // persistée pour survivre entre sessions, voir generateBonusForDay).
  const [periodStart, setPeriodStart] = useState(settings?.bonus_period_start?.slice(0, 16) ?? "");
  const [periodEnd, setPeriodEnd] = useState(settings?.bonus_period_end?.slice(0, 16) ?? "");
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [periodSaved, setPeriodSaved] = useState(false);

  useEffect(() => {
    setPeriodStart(settings?.bonus_period_start?.slice(0, 16) ?? "");
    setPeriodEnd(settings?.bonus_period_end?.slice(0, 16) ?? "");
  }, [settings]);

  async function handleSavePeriod() {
    if (periodStart && periodEnd && new Date(periodStart) >= new Date(periodEnd)) {
      notify("La fin de la période doit être après le début.");
      return;
    }
    setSavingPeriod(true);
    try {
      await updateSettings({
        bonus_period_start: periodStart ? new Date(periodStart).toISOString() : null,
        bonus_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
      });
      await onSettingsChanged();
      setPeriodSaved(true);
      setTimeout(() => setPeriodSaved(false), 2500);
    } catch (e) {
      notify(errorMessage(e, "Erreur lors de l'enregistrement de la période."));
    } finally {
      setSavingPeriod(false);
    }
  }

  /** Un match est éligible au tirage s'il n'y a pas de période définie, ou
   * si son coup d'envoi tombe dedans (bornes incluses). Pas de coup
   * d'envoi connu = exclu dès qu'une période est active (on ne peut pas
   * vérifier). */
  function isWithinBonusPeriod(match: Match): boolean {
    if (!periodStart && !periodEnd) return true;
    if (!match.kickoff) return false;
    const kickoff = new Date(match.kickoff).getTime();
    if (Number.isNaN(kickoff)) return false;
    if (periodStart && kickoff < new Date(periodStart).getTime()) return false;
    if (periodEnd && kickoff > new Date(periodEnd).getTime()) return false;
    return true;
  }

  async function loadAvailableCompetitions() {
    setLoadingCompetitions(true);
    try {
      const list = await getAvailableCompetitions();
      setAvailableCompetitions(list);
      setCompetitionsLoaded(true);
    } catch (e) {
      notify(errorMessage(e, "Erreur lors du chargement des championnats football-data.org."));
    } finally {
      setLoadingCompetitions(false);
    }
  }

  function competitionRowFor(code: string): Competition | null {
    return competitions.find((c) => c.external_code === code || c.code === code) ?? null;
  }

  async function toggleCompetitionActive(discovered: DiscoveredCompetition) {
    const row = competitionRowFor(discovered.code);
    const nextActive = !(row?.is_active ?? false);
    setTogglingCode(discovered.code);
    try {
      await setCompetitionActive(discovered, row?.id ?? null, nextActive);
      await onCompetitionsChanged();
      notify(`${discovered.name} ${nextActive ? "activé" : "désactivé"}.`);
    } catch (e) {
      notify(errorMessage(e, "Erreur lors de l'activation du championnat."));
    } finally {
      setTogglingCode(null);
    }
  }

  async function handleSyncCompetition(discovered: DiscoveredCompetition) {
    setSyncingCode(discovered.code);
    try {
      const summary = await syncCompetitionMatches(discovered.code);
      await Promise.all([onChanged(), onCompetitionsChanged()]);
      const parts = [`${summary.created} créé(s)`, `${summary.updated} mis à jour`];
      if (summary.skipped > 0) parts.push(`${summary.skipped} ignoré(s)`);
      if (summary.matchdaysCreated > 0) parts.push(`${summary.matchdaysCreated} journée(s) créée(s)`);
      notify(`${discovered.name} : ${parts.join(", ")}.`);
      if (summary.errors.length > 0) {
        summary.errors.forEach((err) => console.error(`[sync-${discovered.code}]`, err));
        notify(`${summary.errors.length} erreur(s) pendant la synchronisation de ${discovered.name} (détail dans la console).`);
      }
    } catch (e) {
      notify(errorMessage(e, `Erreur lors de la synchronisation de ${discovered.name}.`));
    } finally {
      setSyncingCode(null);
    }
  }

  const matchCountByCompetitionCode = useMemo(() => {
    const map = new Map<string, number>();
    matches.forEach((m) => {
      const code = m.match_type ?? "LIGUE1";
      if (code === "LIGUE1") return;
      map.set(code, (map.get(code) ?? 0) + 1);
    });
    return map;
  }, [matches]);

  const seasonsById = useMemo(() => new Map(seasons.map((s) => [s.id, s])), [seasons]);
  const competitionsById = useMemo(() => new Map(competitions.map((c) => [c.id, c])), [competitions]);

  function openEdit(md: Matchday) {
    setEditing(md);
    setEditForm({
      number: String(md.number),
      seasonId: md.season_id ?? "",
      competitionId: md.competition_id ?? "",
      deadline: md.deadline ? md.deadline.slice(0, 16) : "",
      deadlineMode: md.deadline_mode ?? "manual",
    });
  }

  async function submitEdit() {
    if (!editing) return;
    const parsedNumber = parseInt(editForm.number, 10);
    if (Number.isNaN(parsedNumber)) {
      notify("Le numéro de la journée doit être un nombre.");
      return;
    }
    setSaving(true);
    try {
      await updateMatchday(editing.id, {
        number: parsedNumber,
        season_id: editForm.seasonId || editing.season_id,
        competition_id: editForm.competitionId || editing.competition_id,
        deadline: editForm.deadline ? new Date(editForm.deadline).toISOString() : null,
        deadline_mode: editForm.deadlineMode,
      });
      setEditing(null);
      await onChanged();
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la modification de la journée.");
    } finally {
      setSaving(false);
    }
  }

  async function handleManualLock(md: Matchday) {
    const value = window.prompt(
      `Date/heure limite pour J${md.number} (format : 2026-08-22T18:59)`,
      md.deadline ? md.deadline.slice(0, 16) : "",
    );
    if (value === null) return;

    if (!value.trim()) {
      notify("Date/heure invalide.");
      return;
    }

    setLockBusyId(md.id);
    try {
      await setMatchdayDeadline(md.id, new Date(value).toISOString());
      await onChanged();
      notify(`🔐 J${md.number} verrouillée en mode manuel.`);
    } catch (e: any) {
      notify(e.message ?? "Erreur lors du verrouillage manuel.");
    } finally {
      setLockBusyId(null);
    }
  }

  async function handleAutoMinusOne(md: Matchday) {
    setLockBusyId(md.id);
    try {
      await setMatchdayAutoMinusOne(md.id);
      await onChanged();
      notify(`⚡ J${md.number} : verrouillage automatique -1 min activé.`);
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de l'activation du verrouillage automatique.");
    } finally {
      setLockBusyId(null);
    }
  }

  async function handleClearLock(md: Matchday) {
    setLockBusyId(md.id);
    try {
      await clearMatchdayDeadline(md.id);
      await onChanged();
      notify(`🔓 Verrouillage retiré pour J${md.number}.`);
    } catch (e: any) {
      notify(e.message ?? "Erreur lors du retrait du verrouillage.");
    } finally {
      setLockBusyId(null);
    }
  }

  const competitionCodeById = useMemo(() => {
    const map = new Map<string, BonusCompetitionCode | null>();
    competitions.forEach((competition) => {
      map.set(competition.id, normalizeCompetitionName(competition.name));
    });
    return map;
  }, [competitions]);

  const matchesByMatchdayId = useMemo(() => {
    const map = new Map<string, Match[]>();
    matches.forEach((match) => {
      if (!match.matchday_id) return;
      const list = map.get(match.matchday_id) ?? [];
      list.push(match);
      map.set(match.matchday_id, list);
    });
    return map;
  }, [matches]);

  function bonusMatchesForDay(md: Matchday, code: BonusCompetitionCode): Match[] {
    return matchdays
      .filter(
        (candidateDay) =>
          candidateDay.number === md.number &&
          candidateDay.season_id === md.season_id &&
          candidateDay.competition_id != null &&
          competitionCodeById.get(candidateDay.competition_id) === code,
      )
      .flatMap((candidateDay) => matchesByMatchdayId.get(candidateDay.id) ?? []);
  }

  function toBonusMatch(match: Match): Match {
    const home = teams.find((team) => team.id === match.home_team_id)?.name ?? "";
    const away = teams.find((team) => team.id === match.away_team_id)?.name ?? "";
    return { ...match, home_team: home, away_team: away };
  }

  function generateBonusForDay(md: Matchday) {
    setGeneratingBonus(true);
    try {
      const key = `${md.season_id}:${md.number}`;
      const next: Partial<Record<BonusCompetitionCode, BonusCandidate>> = {};

      (["PL", "PD", "SA", "BL1"] as BonusCompetitionCode[]).forEach((code) => {
        const candidates = bonusMatchesForDay(md, code).filter(isWithinBonusPeriod).map(toBonusMatch);
        const best = selectBestBonusMatch(candidates, code);
        if (best) next[code] = best;
      });

      if (Object.keys(next).length === 0) {
        notify(
          periodStart || periodEnd
            ? `Aucun match des 4 championnats trouvé pour J${md.number} dans la période choisie.`
            : `Aucun match des 4 championnats trouvé pour J${md.number}.`,
        );
        return;
      }

      setBonusSelections((prev) => ({ ...prev, [key]: next }));
      setReplacingBonus(null);
      notify(`${Object.keys(next).length}/4 Matchs bonus sélectionnés pour J${md.number}.`);
    } finally {
      setGeneratingBonus(false);
    }
  }

  function replaceBonusForDay(md: Matchday, code: BonusCompetitionCode, match: Match) {
    const candidate = scoreBonusCandidateForAdmin(match, code);
    if (!candidate) return;

    const key = `${md.season_id}:${md.number}`;
    setBonusSelections((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [code]: candidate },
    }));
    setReplacingBonus(null);
  }

  function removeBonusDraw(md: Matchday) {
    const key = `${md.season_id}:${md.number}`;
    setBonusSelections((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setReplacingBonus(null);
    notify(`Tirage bonus de J${md.number} retiré.`);
  }

  function scoreCandidateForMatch(match: Match, code: BonusCompetitionCode): BonusCandidate | null {
    return scoreBonusCandidateForAdmin(match, code);
  }

  function scoreBonusCandidateForAdmin(match: Match, code: BonusCompetitionCode): BonusCandidate | null {
    return selectBestBonusMatch([toBonusMatch(match)], code);
  }

  const matchCountByMatchdayId = useMemo(() => {
    const map = new Map<string, number>();
    matches.forEach((m) => {
      if (!m.matchday_id) return;
      map.set(m.matchday_id, (map.get(m.matchday_id) ?? 0) + 1);
    });
    return map;
  }, [matches]);

  function suggestNextNumber() {
    const numbers = matchdays.map((m) => m.number).filter((n) => !Number.isNaN(n));
    const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
    setNumber(String(next));
  }

  async function handleCreate() {
    const parsedNumber = parseInt(number, 10);
    if (!number.trim() || Number.isNaN(parsedNumber)) {
      notify("Le numéro de la journée est requis (ex: 1).");
      return;
    }
    if (!seasonId || !competitionId) {
      notify("Choisis une saison et une compétition.");
      return;
    }
    setCreating(true);
    try {
      await createMatchday(
        seasonId,
        competitionId,
        parsedNumber,
        deadline ? new Date(deadline).toISOString() : null,
      );
      setNumber("");
      setDeadline("");
      await onChanged();
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la création de la journée.");
    } finally {
      setCreating(false);
    }
  }

  // Optimiste comme les autres bascules de statut (toggleAdmin, togglePaid) :
  // le badge EN COURS/TERMINÉE change tout de suite.
  async function toggleFinished(md: Matchday) {
    setBusyId(md.id);
    const nextFinished = !md.is_finished;
    setMatchdays((prev) => prev.map((m) => (m.id === md.id ? { ...m, is_finished: nextFinished } : m)));
    try {
      await setMatchdayFinished(md.id, nextFinished);
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la mise à jour.");
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  // Optimiste : la journée disparaît de la liste immédiatement, on ne
  // resynchronise que si Supabase renvoie une erreur.
  async function confirmAndDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setBusyId(target.id);
    setMatchdays((prev) => prev.filter((m) => m.id !== target.id));
    setConfirmDelete(null);
    try {
      await apiDeleteMatchday(target.id);
    } catch (e: any) {
      notify(e.message ?? "Erreur lors de la suppression.");
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
              <Globe size={18} className="text-emerald-400" />
              Championnats
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Championnats disponibles sur ton compte football-data.org — active ceux à synchroniser pour la sélection bonus.
            </p>
          </div>
          <GhostButton onClick={loadAvailableCompetitions} disabled={loadingCompetitions}>
            <RefreshCw size={12} className={loadingCompetitions ? "animate-spin" : ""} />
            {competitionsLoaded ? "Actualiser la liste" : "Charger les championnats"}
          </GhostButton>
        </div>

        {!competitionsLoaded && !loadingCompetitions && (
          <p className="py-6 text-center text-sm text-slate-500">
            Charge la liste pour voir les championnats disponibles et les activer.
          </p>
        )}

        {competitionsLoaded && availableCompetitions.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">Aucun championnat renvoyé par football-data.org.</p>
        )}

        <div className="space-y-2">
          {availableCompetitions.map((discovered) => {
            const row = competitionRowFor(discovered.code);
            const isActive = row?.is_active ?? false;
            const count = matchCountByCompetitionCode.get(discovered.code) ?? 0;
            const expanded = expandedCode === discovered.code;
            return (
              <div key={discovered.code} className="rounded-xl border border-slate-800 bg-[#0d1322] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {discovered.emblem ? (
                      <img src={discovered.emblem} alt="" className="size-6 shrink-0 object-contain" />
                    ) : (
                      <span className="size-6 shrink-0 rounded-md border border-slate-700 bg-slate-800" />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{discovered.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {discovered.code}
                        {discovered.area ? ` · ${discovered.area}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-300">
                      {count} match{count > 1 ? "s" : ""} synchronisé{count > 1 ? "s" : ""}
                    </span>
                    <GhostButton
                      onClick={() => toggleCompetitionActive(discovered)}
                      disabled={togglingCode === discovered.code}
                      title={isActive ? "Désactiver ce championnat" : "Activer ce championnat"}
                    >
                      {togglingCode === discovered.code ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : isActive ? (
                        <CheckCircle2 size={12} className="text-emerald-400" />
                      ) : (
                        <X size={12} />
                      )}
                      {isActive ? "Activé" : "Désactivé"}
                    </GhostButton>
                    <GhostButton
                      onClick={() => handleSyncCompetition(discovered)}
                      disabled={!isActive || syncingCode === discovered.code}
                      title={isActive ? "Synchroniser depuis football-data.org" : "Active le championnat pour pouvoir synchroniser"}
                    >
                      {syncingCode === discovered.code ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      Synchroniser
                    </GhostButton>
                    {count > 0 && (
                      <GhostButton onClick={() => setExpandedCode(expanded ? null : discovered.code)}>
                        {expanded ? "Masquer" : "Voir les matchs"}
                      </GhostButton>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="mt-3 border-t border-slate-800 pt-3">
                    <CompetitionMatchesList
                      matches={matches.filter((m) => (m.match_type ?? "LIGUE1") === discovered.code)}
                      matchdays={row ? matchdays.filter((md) => md.competition_id === row.id) : []}
                      onChanged={onChanged}
                      notify={notify}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 border-emerald-500/20">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
              <Gift size={18} className="text-emerald-400" />
              Match bonus
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              1 grosse affiche par championnat · Prestige 40 % · Équilibre 30 % · Rivalité 20 % · Horaire 10 %.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-slate-800 bg-[#0d1322] p-4">
          <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
            <CalendarClock size={11} className="text-emerald-400" />
            Période d'éligibilité des matchs au tirage
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Début de la période
              </label>
              <input
                type="datetime-local"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#060b16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Fin de la période
              </label>
              <input
                type="datetime-local"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#060b16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
              />
            </div>
            <PrimaryButton onClick={handleSavePeriod} disabled={savingPeriod}>
              {savingPeriod ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : periodSaved ? (
                <CheckCircle2 size={14} />
              ) : (
                <Save size={14} />
              )}
              {periodSaved ? "Enregistré" : "Enregistrer"}
            </PrimaryButton>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Seuls les matchs dont le coup d'envoi tombe dans cette fenêtre sont proposés au tirage. Laisse les deux
            champs vides pour ne filtrer sur rien (comportement historique).
          </p>
        </div>

        <div className="space-y-3">
          {matchdays
            .slice()
            .sort((a, b) => a.number - b.number)
            .map((md) => {
              const key = `${md.season_id}:${md.number}`;
              const selection = bonusSelections[key] ?? {};
              const codes: BonusCompetitionCode[] = ["PL", "PD", "SA", "BL1"];
              const labels: Record<BonusCompetitionCode, string> = {
                PL: "Premier League",
                PD: "Liga",
                SA: "Serie A",
                BL1: "Bundesliga",
              };

              return (
                <div key={`bonus-${md.id}`} className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-display text-sm font-black text-emerald-400">
                        J{md.number}
                      </span>
                      <span className="text-xs text-slate-500">
                        {codes.filter((code) => selection[code]).length}/4 sélectionnés
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <PrimaryButton onClick={() => generateBonusForDay(md)} disabled={generatingBonus}>
                        {generatingBonus ? <RefreshCw size={13} className="animate-spin" /> : <Gift size={13} />}
                        Générer la sélection bonus
                      </PrimaryButton>
                      {Object.keys(selection).length > 0 && (
                        <GhostButton danger onClick={() => removeBonusDraw(md)} ariaLabel={`Retirer le tirage bonus J${md.number}`}>
                          <Trash2 size={12} />
                          Retirer le tirage
                        </GhostButton>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {codes.map((code) => {
                      const candidate = selection[code];
                      const alternatives = bonusMatchesForDay(md, code).filter(isWithinBonusPeriod);

                      return (
                        <div key={code} className="rounded-xl border border-slate-800 bg-[#0b1325] p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                              {labels[code]}
                            </span>
                            {candidate && (
                              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                                {candidate.score.total}/100
                              </span>
                            )}
                          </div>

                          {candidate ? (
                            <>
                              <div className="text-sm font-bold text-white">
                                {candidate.match.home_team} <span className="text-slate-600">—</span> {candidate.match.away_team}
                              </div>
                              <div className="mt-1 text-[10px] text-slate-500">
                                {candidate.reasons.length ? candidate.reasons.join(" · ") : "Affiche retenue automatiquement"}
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-slate-500">
                              Aucun candidat trouvé.
                            </div>
                          )}

                          {alternatives.length > 0 && (
                            <div className="mt-3">
                              <GhostButton onClick={() => setReplacingBonus(replacingBonus === code ? null : code)}>
                                <Pencil size={11} />
                                {replacingBonus === code ? "Fermer" : "Remplacer"}
                              </GhostButton>

                              {replacingBonus === code && (
                                <div className="mt-2 space-y-1.5">
                                  {alternatives.map((match) => {
                                    const scored = scoreCandidateForMatch(match, code);
                                    if (!scored) return null;
                                    return (
                                      <button
                                        key={match.id}
                                        type="button"
                                        onClick={() => replaceBonusForDay(md, code, match)}
                                        className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-left hover:border-emerald-500/40 hover:bg-emerald-500/5"
                                      >
                                        <span className="text-xs font-semibold text-slate-200">
                                          {scored.match.home_team} — {scored.match.away_team}
                                        </span>
                                        <span className="font-mono text-[10px] font-bold text-emerald-400">
                                          {scored.score.total}/100
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <Plus size={18} className="text-emerald-400" />
          Créer une journée
        </h2>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[110px_1fr_1fr_1fr]">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Numéro
            </label>
            <TextInput placeholder="1" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Compétition
            </label>
            <select
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
            >
              <option value="">Choisir…</option>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Saison
            </label>
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
            >
              <option value="">Choisir…</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Date limite pronos
            </label>
            <TextInput type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <GhostButton onClick={suggestNextNumber}>Numéro suivant</GhostButton>
          <PrimaryButton onClick={handleCreate} disabled={creating}>
            {creating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            Créer
          </PrimaryButton>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <Calendar size={18} className="text-emerald-400" />
          Journées ({matchdays.length})
        </h2>

        {!error && matchdays.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Aucune journée créée pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {matchdays.map((md) => (
              <div
                key={md.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0d1322] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-display text-sm font-black text-white">
                    J{md.number}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {(md.competition_id ? competitionsById.get(md.competition_id) : undefined)?.name ?? "Compétition inconnue"}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-slate-500">
                      <span>
                        {matchCountByMatchdayId.get(md.id) ?? 0} match(s) · saison{" "}
                        {(md.season_id ? seasonsById.get(md.season_id) : undefined)?.name ?? "?"}
                      </span>
                      {md.deadline_mode === "auto_minus_1" ? (
                        <span className="inline-flex items-center gap-1 text-cyan-300">
                          <Timer size={11} />
                          Auto -1 min
                        </span>
                      ) : md.deadline ? (
                        <span className="inline-flex items-center gap-1 text-amber-400/80">
                          <CalendarClock size={11} />
                          Limite : {new Date(md.deadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Unlock size={11} />
                          Sans verrouillage
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <GhostButton
                    onClick={() => handleManualLock(md)}
                    disabled={lockBusyId === md.id}
                    title="Définir une date/heure limite"
                    ariaLabel={`Définir une limite manuelle pour J${md.number}`}
                  >
                    {lockBusyId === md.id ? "…" : "🔐"}
                    Manuel
                  </GhostButton>

                  <GhostButton
                    onClick={() => handleAutoMinusOne(md)}
                    disabled={lockBusyId === md.id}
                    title="Verrouiller chaque match 1 minute avant son coup d'envoi"
                    ariaLabel={`Activer le verrouillage automatique moins une minute pour J${md.number}`}
                  >
                    <Timer size={12} />
                    Auto -1 min
                  </GhostButton>

                  {(md.deadline || md.deadline_mode === "auto_minus_1") && (
                    <GhostButton
                      danger
                      onClick={() => handleClearLock(md)}
                      disabled={lockBusyId === md.id}
                      title="Retirer le verrouillage"
                      ariaLabel={`Retirer le verrouillage de J${md.number}`}
                    >
                      <Unlock size={12} />
                      Retirer
                    </GhostButton>
                  )}

                  {!md.is_finished ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 font-mono text-[10px] font-bold text-mint">
                      <Unlock size={11} />
                      EN COURS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-400">
                      <Lock size={11} />
                      TERMINÉE
                    </span>
                  )}
                  <GhostButton onClick={() => toggleFinished(md)}>
                    {busyId === md.id ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : md.is_finished ? (
                      <Unlock size={12} />
                    ) : (
                      <Lock size={12} />
                    )}
                    {md.is_finished ? "Rouvrir" : "Clôturer"}
                  </GhostButton>
                  <GhostButton onClick={() => openEdit(md)} title="Modifier" ariaLabel={`Modifier la journée J${md.number}`}>
                    <Pencil size={12} />
                  </GhostButton>
                  <GhostButton
                    danger
                    onClick={() => setConfirmDelete(md)}
                    title="Supprimer"
                    ariaLabel={`Supprimer la journée J${md.number}`}
                  >
                    <Trash2 size={12} />
                  </GhostButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <Modal title={`Modifier J${editing.number}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Numéro
                </label>
                <TextInput value={editForm.number} onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Compétition
                </label>
                <select
                  value={editForm.competitionId}
                  onChange={(e) => setEditForm((f) => ({ ...f, competitionId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                >
                  {competitions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Saison
                </label>
                <select
                  value={editForm.seasonId}
                  onChange={(e) => setEditForm((f) => ({ ...f, seasonId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Date limite
                </label>
                <TextInput
                  type="datetime-local"
                  value={editForm.deadline}
                  onChange={(e) => setEditForm((f) => ({ ...f, deadline: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <GhostButton onClick={() => setEditing(null)}>Annuler</GhostButton>
              <PrimaryButton onClick={submitEdit} disabled={saving}>
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Supprimer cette journée ?"
          description={`La journée J${confirmDelete.number} sera supprimée. Les matchs déjà rattachés perdront leur journée.`}
          confirmLabel="Supprimer"
          busy={busyId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmAndDelete}
        />
      )}
    </div>
  );
}

/** Liste compacte, triée par journée, des matchs synchronisés pour un
 * championnat de l'onglet Bonus — équivalent allégé du tableau de l'onglet
 * Matchs (mêmes scores éditables inline), sans création/suppression : ces
 * matchs n'existent que via la synchronisation football-data.org. Pas de
 * badge logo (aucune équipe hors Ligue 1 n'est en base, voir
 * syncCompetitionMatches) : le nom brut renvoyé par l'API suffit ici. */
function CompetitionMatchesList({
  matches,
  matchdays,
  onChanged,
  notify,
}: {
  matches: Match[];
  matchdays: Matchday[];
  onChanged: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, { home: string; away: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const matchdaysById = useMemo(() => new Map(matchdays.map((md) => [md.id, md])), [matchdays]);

  // Sélecteur de journée scopé à ce championnat (pas de J1-J34 fixe : le
  // numéro vient tel quel du champ `matchday` renvoyé par football-data.org
  // pour CE championnat, voir syncCompetitionMatches). Si plusieurs
  // championnats sont développés en même temps dans l'onglet Bonus, chaque
  // instance de CompetitionMatchesList a son propre state — le filtre ne
  // s'applique donc qu'au championnat affiché ici, jamais globalement.
  const sortedMatchdays = useMemo(() => [...matchdays].sort((a, b) => a.number - b.number), [matchdays]);
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string | "all" | null>(null);

  useEffect(() => {
    if (selectedMatchdayId !== null || sortedMatchdays.length === 0) return;
    setSelectedMatchdayId(computeDefaultMatchdayId(sortedMatchdays, matches) ?? "all");
  }, [sortedMatchdays, matches, selectedMatchdayId]);

  function draftFor(match: Match) {
    return (
      scoreDrafts[match.id] ?? {
        home: match.home_score === null || match.home_score === undefined ? "" : String(match.home_score),
        away: match.away_score === null || match.away_score === undefined ? "" : String(match.away_score),
      }
    );
  }

  async function saveScore(match: Match) {
    const draft = draftFor(match);
    const homeRaw = draft.home.trim();
    const awayRaw = draft.away.trim();
    const home = homeRaw === "" ? null : Number(homeRaw);
    const away = awayRaw === "" ? null : Number(awayRaw);
    if ((home !== null && Number.isNaN(home)) || (away !== null && Number.isNaN(away))) {
      notify("Le score doit être un nombre.");
      return;
    }
    setSavingId(match.id);
    try {
      await updateMatch(match.id, {
        home_score: home,
        away_score: away,
        finished: home !== null && away !== null ? true : match.finished,
      });
      setScoreDrafts((prev) => {
        const next = { ...prev };
        delete next[match.id];
        return next;
      });
      await onChanged();
    } catch (e) {
      notify(errorMessage(e, "Erreur lors de l'enregistrement du score."));
    } finally {
      setSavingId(null);
    }
  }

  const sorted = useMemo(
    () =>
      [...matches].sort((a, b) => {
        const an = matchdaysById.get(a.matchday_id ?? "")?.number ?? 0;
        const bn = matchdaysById.get(b.matchday_id ?? "")?.number ?? 0;
        if (an !== bn) return an - bn;
        return (a.kickoff ?? "").localeCompare(b.kickoff ?? "");
      }),
    [matches, matchdaysById],
  );

  const visible = useMemo(() => {
    if (selectedMatchdayId === null || selectedMatchdayId === "all") return sorted;
    return sorted.filter((m) => m.matchday_id === selectedMatchdayId);
  }, [sorted, selectedMatchdayId]);

  if (sorted.length === 0) {
    return <p className="py-4 text-center text-xs text-slate-500">Aucun match synchronisé pour ce championnat.</p>;
  }

  return (
    <div>
      {sortedMatchdays.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedMatchdayId("all")}
            className={`shrink-0 rounded-lg px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide transition-all ${
              selectedMatchdayId === "all"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            Toutes
          </button>
          {sortedMatchdays.map((md) => (
            <button
              key={md.id}
              type="button"
              onClick={() => setSelectedMatchdayId(md.id)}
              className={`shrink-0 rounded-lg px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide transition-all ${
                selectedMatchdayId === md.id
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              {matchdayLabel(md)}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
      {visible.map((match) => {
        const draft = draftFor(match);
        const hasDraftEdit = scoreDrafts[match.id] !== undefined;
        const md = matchdaysById.get(match.matchday_id ?? "");
        return (
          <div
            key={match.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#060b16] px-3 py-2"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-400">
                {md ? `J${md.number}` : "—"}
              </span>
              <span className="font-semibold text-slate-200">{match.home_team || "?"}</span>
              <span className="text-slate-600">vs</span>
              <span className="font-semibold text-slate-200">{match.away_team || "?"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-500">
                {match.kickoff ? new Date(match.kickoff).toLocaleDateString("fr-FR", { dateStyle: "short" }) : "—"}
              </span>
              <StatusBadge status={matchDisplayStatus(match)} />
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.home}
                onChange={(e) => setScoreDrafts((prev) => ({ ...prev, [match.id]: { ...draftFor(match), home: e.target.value } }))}
                onBlur={() => hasDraftEdit && saveScore(match)}
                onKeyDown={(e) => e.key === "Enter" && saveScore(match)}
                aria-label={`Score domicile ${match.home_team ?? "?"}`}
                className="w-10 rounded border border-slate-700 bg-[#0d1322] px-1 py-0.5 text-center text-xs font-bold text-slate-100 outline-none focus:border-emerald-500/60"
              />
              <span className="text-slate-600">-</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.away}
                onChange={(e) => setScoreDrafts((prev) => ({ ...prev, [match.id]: { ...draftFor(match), away: e.target.value } }))}
                onBlur={() => hasDraftEdit && saveScore(match)}
                onKeyDown={(e) => e.key === "Enter" && saveScore(match)}
                aria-label={`Score extérieur ${match.away_team ?? "?"}`}
                className="w-10 rounded border border-slate-700 bg-[#0d1322] px-1 py-0.5 text-center text-xs font-bold text-slate-100 outline-none focus:border-emerald-500/60"
              />
              {hasDraftEdit && (
                <GhostButton onClick={() => saveScore(match)} title="Enregistrer le score">
                  {savingId === match.id ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                </GhostButton>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

// ============================================================
// ⚙️ ONGLET RÉGLAGES
// ============================================================
/** Champ numérique générique : on garde la saisie en texte tant que le
 * champ est édité (comme le reste de l'admin — voir montant de paiement,
 * score de match) pour ne pas gêner la frappe d'un nombre décimal ou d'un
 * champ vidé temporairement ; la conversion en nombre a lieu à
 * l'enregistrement. */
function NumberField({
  label,
  value,
  onChange,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: typeof Users;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        {Icon && <Icon size={11} />}
        {label}
      </label>
      <TextInput inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

function toNumber(raw: string, fallback = 0): number {
  const n = Number(raw.replace(",", "."));
  return Number.isNaN(n) ? fallback : n;
}

function SettingsTab({
  settings,
  error,
  onChanged,
  notify,
}: {
  settings: AppSettings | null;
  error?: string;
  onChanged: () => Promise<void>;
  notify: (message: string) => void;
}) {
  // Général
  const [season, setSeason] = useState(settings?.season ?? "2026-2027");
  const [entryFee, setEntryFee] = useState(String(settings?.entry_fee ?? 10));
  const [timezone, setTimezone] = useState(settings?.timezone ?? "Europe/Paris");
  const [registrationDeadline, setRegistrationDeadline] = useState(settings?.registration_deadline?.slice(0, 16) ?? "");

  // Barème de points
  const [scoreExact, setScoreExact] = useState(String(settings?.bonus_exact_score ?? 5));
  const [correctResult, setCorrectResult] = useState(String(settings?.points_correct_result ?? 1));
  const [goalDiffBonus, setGoalDiffBonus] = useState(String(settings?.points_goal_diff_bonus ?? 0));

  // Blocage des pronostics
  const [closingDelay, setClosingDelay] = useState(String(settings?.closing_delay_minutes ?? 0));

  // Équipe de cœur
  const [favoriteTeamDeadline, setFavoriteTeamDeadline] = useState(settings?.favorite_team_deadline?.slice(0, 16) ?? "");
  const [favoriteTeamAutoLock, setFavoriteTeamAutoLock] = useState(settings?.favorite_team_auto_lock ?? true);
  const [favoriteTeamBonusPoints, setFavoriteTeamBonusPoints] = useState(String(settings?.favorite_team_bonus_points ?? 0));

  // Bonus
  const [bonusDrawsPerPeriod, setBonusDrawsPerPeriod] = useState(String(settings?.bonus_draws_per_period ?? 1));
  const [bonusMatchPoints, setBonusMatchPoints] = useState(settings?.bonus_match_points != null ? String(settings.bonus_match_points) : "");

  // Mode maintenance
  const [maintenanceMode, setMaintenanceMode] = useState(settings?.maintenance_mode ?? false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(settings?.maintenance_message ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testingApi, setTestingApi] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setSeason(settings.season);
    setEntryFee(String(settings.entry_fee));
    setTimezone(settings.timezone);
    setRegistrationDeadline(settings.registration_deadline?.slice(0, 16) ?? "");
    setScoreExact(String(settings.bonus_exact_score));
    setCorrectResult(String(settings.points_correct_result));
    setGoalDiffBonus(String(settings.points_goal_diff_bonus));
    setClosingDelay(String(settings.closing_delay_minutes));
    setFavoriteTeamDeadline(settings.favorite_team_deadline?.slice(0, 16) ?? "");
    setFavoriteTeamAutoLock(settings.favorite_team_auto_lock);
    setFavoriteTeamBonusPoints(String(settings.favorite_team_bonus_points));
    setBonusDrawsPerPeriod(String(settings.bonus_draws_per_period));
    setBonusMatchPoints(settings.bonus_match_points != null ? String(settings.bonus_match_points) : "");
    setMaintenanceMode(settings.maintenance_mode);
    setMaintenanceMessage(settings.maintenance_message ?? "");
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        season,
        entry_fee: toNumber(entryFee, 0),
        timezone: timezone.trim() || "Europe/Paris",
        registration_deadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
        bonus_exact_score: toNumber(scoreExact, 0),
        points_correct_result: toNumber(correctResult, 0),
        points_goal_diff_bonus: toNumber(goalDiffBonus, 0),
        closing_delay_minutes: Math.max(0, Math.round(toNumber(closingDelay, 0))),
        favorite_team_deadline: favoriteTeamDeadline ? new Date(favoriteTeamDeadline).toISOString() : null,
        favorite_team_auto_lock: favoriteTeamAutoLock,
        favorite_team_bonus_points: toNumber(favoriteTeamBonusPoints, 0),
        bonus_draws_per_period: Math.max(0, Math.round(toNumber(bonusDrawsPerPeriod, 1))),
        bonus_match_points: bonusMatchPoints.trim() === "" ? null : toNumber(bonusMatchPoints, 0),
        maintenance_mode: maintenanceMode,
        maintenance_message: maintenanceMessage.trim() || null,
      });
      await onChanged();
      setSaved(true);
      notify("Réglages enregistrés.");
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      notify(errorMessage(e, "Erreur lors de l'enregistrement des réglages."));
    } finally {
      setSaving(false);
    }
  }

  async function handleResync() {
    setSyncing(true);
    await onChanged();
    setSyncing(false);
  }

  async function handleTestApiConnection() {
    setTestingApi(true);
    try {
      const list = await getAvailableCompetitions();
      notify(`✅ Connexion football-data.org OK — ${list.length} championnat(s) disponible(s) sur ce compte.`);
    } catch (e) {
      notify(errorMessage(e, "❌ Connexion à football-data.org impossible."));
    } finally {
      setTestingApi(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      {/* ================= BARÈME DE POINTS ================= */}
      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <Gift size={18} className="text-emerald-400" />
          Barème de points
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Ces valeurs sont sauvegardées, mais aucun moteur de calcul de points n'existe encore dans le code ni en
          base à ce jour (vérifié) — elles ne s'appliquent pas encore automatiquement aux pronostics.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField label="Score exact (points)" value={scoreExact} onChange={setScoreExact} icon={CheckCircle2} />
          <NumberField
            label="Bon résultat 1N2 (points)"
            value={correctResult}
            onChange={setCorrectResult}
            icon={Check}
            hint="Bon sens du résultat, sans le score exact."
          />
          <NumberField
            label="Bonus bon nombre de buts (points)"
            value={goalDiffBonus}
            onChange={setGoalDiffBonus}
            icon={Plus}
            hint="Nombre de buts d'une des deux équipes deviné juste."
          />
        </div>
      </Card>

      {/* ================= ÉQUIPE DE CŒUR ================= */}
      <Card className="p-5 border-amber-500/30 bg-[#0d1322]">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
            ⭐
          </span>
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white">Équipe de cœur</h2>
            <p className="text-xs text-slate-400">
              Date limite et verrouillage automatique du choix d'équipe favorite (onglet Joueurs).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              <Calendar size={11} className="text-emerald-400" /> Date limite de choix
            </label>
            <input
              type="datetime-local"
              value={favoriteTeamDeadline}
              onChange={(e) => setFavoriteTeamDeadline(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#060b16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
            />
          </div>
          <NumberField
            label="Bonus points (matchs équipe de cœur)"
            value={favoriteTeamBonusPoints}
            onChange={setFavoriteTeamBonusPoints}
            icon={Gift}
            hint="0 = aucun bonus. Non appliqué automatiquement aujourd'hui (voir barème de points)."
          />
          <div className="flex flex-col justify-end">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-[#060b16] p-2.5 transition-colors hover:border-slate-700">
              <input
                type="checkbox"
                checked={favoriteTeamAutoLock}
                onChange={(e) => setFavoriteTeamAutoLock(e.target.checked)}
                className="size-4 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0"
              />
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                <Lock size={14} className="text-amber-400" /> Verrouillage automatique à la date limite
              </span>
            </label>
          </div>
        </div>
      </Card>

      {/* ================= BONUS ================= */}
      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <Gift size={18} className="text-emerald-400" />
          Bonus
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Les championnats couverts se pilotent depuis l'onglet Bonus (activer/désactiver) — ici, la cadence des
          tirages et un barème spécifique optionnel pour les matchs bonus.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Tirages bonus par période"
            value={bonusDrawsPerPeriod}
            onChange={setBonusDrawsPerPeriod}
            icon={RefreshCw}
          />
          <NumberField
            label="Points pronostic bonus (si différent du barème standard)"
            value={bonusMatchPoints}
            onChange={setBonusMatchPoints}
            icon={Gift}
            hint="Laisser vide pour appliquer le barème standard ci-dessus."
          />
        </div>
      </Card>

      {/* ================= BLOCAGE DES PRONOSTICS ================= */}
      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <Timer size={18} className="text-emerald-400" />
          Blocage des pronostics
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Valeur par défaut utilisée par le verrouillage automatique « Auto −1 min » des journées (onglet Bonus).
        </p>
        <div className="max-w-xs">
          <NumberField
            label="Minutes avant le coup d'envoi"
            value={closingDelay}
            onChange={setClosingDelay}
            icon={Lock}
          />
        </div>
      </Card>

      {/* ================= MODE MAINTENANCE ================= */}
      <Card className={`p-5 ${maintenanceMode ? "border-red-500/40 bg-red-500/[0.03]" : ""}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
            <AlertTriangle size={18} className={maintenanceMode ? "text-red-400" : "text-emerald-400"} />
            Mode maintenance
          </h2>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-[#060b16] px-3 py-2 transition-colors hover:border-slate-700">
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              className="size-4 rounded border-slate-800 bg-slate-900 text-red-500 focus:ring-0"
            />
            <span className="text-sm font-medium text-white">Geler les pronostics</span>
          </label>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Réglage sauvegardé — à brancher côté page Pronostics si tu veux qu'il bloque réellement les saisies (pas
          encore lu par le code aujourd'hui).
        </p>
        <TextInput
          value={maintenanceMessage}
          onChange={(e) => setMaintenanceMessage(e.target.value)}
          placeholder="Message affiché aux joueurs pendant la maintenance (optionnel)"
        />
      </Card>

      {/* ================= SAISON & PARAMÈTRES GÉNÉRAUX ================= */}
      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <SettingsIcon size={18} className="text-emerald-400" />
          Saison &amp; paramètres généraux
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Saison en cours
            </label>
            <TextInput value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026-2027" />
          </div>
          <NumberField label="Droit d'entrée (€ / joueur)" value={entryFee} onChange={setEntryFee} />
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Fuseau horaire d'affichage
            </label>
            <TextInput value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/Paris" />
            <p className="mt-1 text-[10px] text-slate-500">
              Sauvegardé, non encore branché dans le formatage des heures ci-dessous (toujours navigateur local).
            </p>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Date limite d'inscription / modification du profil
            </label>
            <input
              type="datetime-local"
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#0d1322] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : saved ? (
              <CheckCircle2 size={14} />
            ) : (
              <Save size={14} />
            )}
            {saved ? "Enregistré" : "Enregistrer"}
          </PrimaryButton>
        </div>
      </Card>

      {/* ================= FOOTBALL-DATA.ORG ================= */}
      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <Globe size={18} className="text-emerald-400" />
          Intégration football-data.org
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Clé API stockée côté serveur (variable d'environnement <code className="text-slate-400">FOOTBALL_DATA_API_TOKEN</code>),
          jamais exposée ici. Ce bouton vérifie juste que la connexion fonctionne.
        </p>
        <GhostButton onClick={handleTestApiConnection} disabled={testingApi}>
          <RefreshCw size={12} className={testingApi ? "animate-spin" : ""} />
          Tester la connexion
        </GhostButton>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <RefreshCw size={18} className="text-emerald-400" />
          Synchronisation
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Recharge l'ensemble des données admin (joueurs, paiements, matchs, bonus, réglages) depuis Supabase.
        </p>
        <GhostButton onClick={handleResync}>
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
          Resynchroniser maintenant
        </GhostButton>
      </Card>
    </div>
  );
}

// ============================================================
// Composants génériques : Modal & confirmation
// ============================================================
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0b1325] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
  tone = "danger",
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** "danger" (défaut, inchangé) pour les suppressions ; "primary" pour une
   * confirmation d'action non destructive (ex. génération en masse), qui
   * reprend alors le vert émeraude du reste de l'app au lieu du rouge. */
  tone?: "danger" | "primary";
}) {
  const isDanger = tone === "danger";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        className={`w-full max-w-sm rounded-2xl border bg-[#0b1325] p-6 shadow-2xl ${
          isDanger ? "border-red-500/20" : "border-emerald-500/20"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mb-3 flex items-center gap-2 ${isDanger ? "text-red-400" : "text-emerald-400"}`}>
          <AlertTriangle size={18} />
          <h3 className="font-display text-lg font-bold uppercase tracking-wide">{title}</h3>
        </div>
        <p className="mb-5 text-sm text-slate-400">{description}</p>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onCancel}>Annuler</GhostButton>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50 ${
              isDanger
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            }`}
          >
            {busy ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : isDanger ? (
              <Trash2 size={14} />
            ) : (
              <Check size={14} />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
