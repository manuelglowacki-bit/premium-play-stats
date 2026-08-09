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
  const [confirmDelete, setConfirmDelete] = useState<Matchday | null>(null);
  const [editing, setEditing] = useState<Matchday | null>(null);
  const [editForm, setEditForm] = useState({ number: "", seasonId: "", competitionId: "", deadline: "" });
  const [saving, setSaving] = useState(false);

  const seasonsById = useMemo(() => new Map(seasons.map((s) => [s.id, s])), [seasons]);
  const competitionsById = useMemo(() => new Map(competitions.map((c) => [c.id, c])), [competitions]);

  function openEdit(md: Matchday) {
    setEditing(md);
    setEditForm({
      number: String(md.number),
      seasonId: md.season_id,
      competitionId: md.competition_id,
      deadline: md.deadline ? md.deadline.slice(0, 16) : "",
    });
  }

  async function submitEdit() {
    if (!editing) return;
    const parsedNumber = parseInt(editForm.number, 10);
    if (Number.isNaN(parsedNumber)) {
      alert("Le numéro de la journée doit être un nombre.");
      return;
    }
    setSaving(true);
    try {
      await updateMatchday(editing.id, {
        number: parsedNumber,
        season_id: editForm.seasonId || editing.season_id,
        competition_id: editForm.competitionId || editing.competition_id,
        deadline: editForm.deadline ? new Date(editForm.deadline).toISOString() : null,
      });
      setEditing(null);
      await onChanged();
    } catch (e: any) {
      alert(e.message ?? "Erreur lors de la modification de la journée.");
    } finally {
      setSaving(false);
    }
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
      alert("Le numéro de la journée est requis (ex: 1).");
      return;
    }
    if (!seasonId || !competitionId) {
      alert("Choisis une saison et une compétition.");
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
      alert(e.message ?? "Erreur lors de la création de la journée.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleFinished(md: Matchday) {
    setBusyId(md.id);
    try {
      await setMatchdayFinished(md.id, !md.is_finished);
      await onChanged();
    } catch (e: any) {
      alert(e.message ?? "Erreur lors de la mise à jour.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmAndDelete() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await apiDeleteMatchday(confirmDelete.id);
      setConfirmDelete(null);
      await onChanged();
    } catch (e: any) {
      alert(e.message ?? "Erreur lors de la suppression.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
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
                      {competitionsById.get(md.competition_id)?.name ?? "Compétition inconnue"}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-slate-500">
                      <span>
                        {matchCountByMatchdayId.get(md.id) ?? 0} match(s) · saison{" "}
                        {seasonsById.get(md.season_id)?.name ?? "?"}
                      </span>
                      {md.deadline && (
                        <span className="inline-flex items-center gap-1 text-amber-400/80">
                          <CalendarClock size={11} />
                          Limite : {new Date(md.deadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
                  <GhostButton onClick={() => openEdit(md)} title="Modifier">
                    <Pencil size={12} />
                  </GhostButton>
                  <GhostButton danger onClick={() => setConfirmDelete(md)} title="Supprimer">
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

// ============================================================
// ⚙️ ONGLET RÉGLAGES (Intégration Phase 2 : Date limite & Verrouillage auto)
// ============================================================
function SettingsTab({
  settings,
  error,
  onChanged,
}: {
  settings: AppSettings | null;
  error?: string;
  onChanged: () => Promise<void>;
}) {
  const [season, setSeason] = useState(settings?.season ?? "2026-2027");
  const [entryFee, setEntryFee] = useState(String(settings?.entry_fee ?? 10));
  const [bonus, setBonus] = useState(String(settings?.bonus_exact_score ?? 5));
  const [closingDelay, setClosingDelay] = useState(String(settings?.closing_delay_minutes ?? 0));
  
  // Phase 2 : Nouveaux états pour l'équipe favorite
  const [favoriteTeamDeadline, setFavoriteTeamDeadline] = useState("2026-08-15T20:00");
  const [favoriteTeamAutoLock, setFavoriteTeamAutoLock] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (settings) {
      setSeason(settings.season);
      setEntryFee(String(settings.entry_fee));
      setBonus(String(settings.bonus_exact_score));
      setClosingDelay(String(settings.closing_delay_minutes));
    }
  }, [settings]);

  // Phase 2 : Charger les paramètres de l'équipe favorite depuis app_settings
  useEffect(() => {
    async function loadFavoriteTeamSettings() {
      try {
        const { getSettings: getAppSettings } = await import("@/services/adminService");
        // On peut récupérer les clés spécifiques si stockées dans une table ou via getSettings si géré globalement
        // Ici on utilise la table app_settings via supabase directement si nécessaire ou via la fonction existante
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.from("app_settings").select("*");
        if (data) {
          const d = data.find((s: any) => s.key === "favorite_team_deadline");
          const l = data.find((s: any) => s.key === "favorite_team_auto_lock");
          if (d) setFavoriteTeamDeadline(d.value.slice(0, 16));
          if (l) setFavoriteTeamAutoLock(l.value === "true");
        }
      } catch (e) {
        console.warn("Impossible de charger les réglages équipe favorite:", e);
      }
    }
    loadFavoriteTeamSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        season,
        entry_fee: Number(entryFee.replace(",", ".")) || 0,
        bonus_exact_score: Number(bonus.replace(",", ".")) || 0,
        closing_delay_minutes: Number(closingDelay) || 0,
      });

      // Phase 2 : Sauvegarde des paramètres d'équipe favorite dans app_settings
      const { supabase } = await import("@/lib/supabase");
      const favoriteUpdates = [
        { key: "favorite_team_deadline", value: new Date(favoriteTeamDeadline).toISOString() },
        { key: "favorite_team_auto_lock", value: favoriteTeamAutoLock ? "true" : "false" },
      ];
      await supabase.from("app_settings").upsert(favoriteUpdates, { onConflict: "key" });

      await onChanged();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      alert(e.message ?? "Erreur lors de l'enregistrement des réglages.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResync() {
    setSyncing(true);
    await onChanged();
    setSyncing(false);
  }

  return (
    <div className="space-y-4">
      {/* Phase 2 : Section Équipe favorite */}
      <Card className="p-5 md:p-6 border-amber-500/30 bg-[#0d1322]">
        <div className="flex items-center gap-3 mb-4">
          <span className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            ⭐
          </span>
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">Équipe favorite</h2>
            <p className="text-xs text-slate-400">Paramétrez la date limite et le verrouillage automatique des choix d'équipe.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Calendar size={14} className="text-emerald-400" /> Date limite
            </label>
            <input
              type="datetime-local"
              value={favoriteTeamDeadline}
              onChange={(e) => setFavoriteTeamDeadline(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#060b16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl border border-slate-800 bg-[#060b16] hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={favoriteTeamAutoLock}
                onChange={(e) => setFavoriteTeamAutoLock(e.target.checked)}
                className="size-4 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0"
              />
              <span className="text-sm font-medium text-white flex items-center gap-1.5">
                <Lock size={14} className="text-amber-400" /> Verrouillage automatique
              </span>
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <SettingsIcon size={18} className="text-emerald-400" />
          Saison &amp; paramètres
        </h2>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Saison en cours
            </label>
            <TextInput value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026-2027" />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Droit d'entrée (€ / joueur)
            </label>
            <TextInput inputMode="decimal" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              <Gift size={11} />
              Bonus score exact (points)
            </label>
            <TextInput inputMode="decimal" value={bonus} onChange={(e) => setBonus(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              <Timer size={11} />
              Fermeture des pronos (min avant coup d'envoi)
            </label>
            <TextInput inputMode="numeric" value={closingDelay} onChange={(e) => setClosingDelay(e.target.value)} />
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

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
          <RefreshCw size={18} className="text-emerald-400" />
          Synchronisation
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Recharge l'ensemble des données admin (joueurs, paiements, matchs, journées, réglages) depuis Supabase.
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
