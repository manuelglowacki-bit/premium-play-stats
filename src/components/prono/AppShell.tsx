import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  Target,
  Trophy,
  Newspaper,
  BarChart3,
  User,
  Shield,
  LogIn,
  LogOut,
  MessageCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  VESTIAIRE_UNREAD_KEY,
  getVestiaireUnreadCount,
  markVestiaireRead,
} from "@/lib/vestiaireUnread";
import { useAuth } from "@/context/AuthContext";
import { useKeyboardOpen } from "@/hooks/useKeyboardOpen";

/**
 * Hauteur rÃ©ellement visible de l'app, en une seule source pour toute
 * l'appli â€” posÃ©e sur <html> comme variable CSS `--app-vh`, dÃ©rivÃ©e de
 * window.visualViewport (seule API qui rÃ©agit vraiment Ã  l'ouverture du
 * clavier virtuel sur Android Chrome ; 100vh/100dvh non, le clavier
 * chevauche le contenu au lieu de rÃ©duire la hauteur visible). Toute page
 * qui a besoin de "toute la hauteur disponible" (ex. le Vestiaire) peut
 * alors se contenter d'un simple height: 100% en cascade, sans recalculer
 * quoi que ce soit elle-mÃªme.
 */
function useAppViewportHeight() {
  useEffect(() => {
    function update() {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-vh", `${height}px`);
    }
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);
}

/**
 * Hauteur RÃ‰ELLE (mesurÃ©e, jamais devinÃ©e) du header sticky et de la nav
 * flottante, posÃ©es sur <html> comme `--app-header-h` / `--app-nav-h`.
 * Sert Ã  des pages qui ont besoin de rÃ©server un espace exact sous le
 * header ou au-dessus de la nav (ex. Admin â†’ Suivi des pronostics) sans
 * qu'un padding en dur (ex. pb-32) ne se retrouve un jour trop court ou
 * trop long si ces Ã©lÃ©ments changent de taille. ResizeObserver plutÃ´t que
 * seulement `resize` : rÃ©agit aussi si le contenu du header/de la nav
 * change de taille sans que la fenÃªtre change (ex. badge qui apparaÃ®t/
 * disparaÃ®t Ã  un breakpoint, police qui finit de charger).
 */
function useMeasuredChromeHeights(
  headerRef: React.RefObject<HTMLElement | null>,
  navRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const header = headerRef.current;
    const nav = navRef.current;
    if (!header || !nav) return;

    const setVar = (name: string, px: number) =>
      document.documentElement.style.setProperty(name, `${Math.round(px)}px`);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (entry.target === header) setVar("--app-header-h", height);
        if (entry.target === nav) setVar("--app-nav-h", height);
      }
    });

    observer.observe(header);
    observer.observe(nav);
    setVar("--app-header-h", header.getBoundingClientRect().height);
    setVar("--app-nav-h", nav.getBoundingClientRect().height);

    return () => observer.disconnect();
  }, [headerRef, navRef]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navigate = useNavigate();
  // MÃªme source de vÃ©ritÃ© que le reste de l'app (AuthContext) plutÃ´t qu'un
  // second abonnement local Ã  la session Supabase â€” `isAdmin` en dÃ©coule
  // dÃ©jÃ  (profiles.is_admin), c'est le mÃ©canisme dÃ©jÃ  utilisÃ© par
  // AdminRoute pour protÃ©ger la route /admin, rÃ©utilisÃ© ici pour la nav.
  const { user, isAdmin, signOut } = useAuth();
  const keyboardOpen = useKeyboardOpen();
  useAppViewportHeight();
  const headerRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const [vestiaireUnread, setVestiaireUnread] = useState(0);
  // Journee et saison affichees dans l'en-tete. Elles etaient ecrites en dur
  // ("J1 • 2026", "Saison 2026-2027") et ne bougeaient donc jamais.
  const [headerSeason, setHeaderSeason] = useState<string | null>(null);
  const [headerDay, setHeaderDay] = useState<{ number: number; kickoff: number | null } | null>(null);
  useMeasuredChromeHeights(headerRef, navRef);

  // DERNIERE VISITE REELLE. auth.users.last_sign_in_at ne bouge qu'a la
  // saisie du mot de passe : un joueur reste connecte des semaines et n'y
  // apparait plus jamais. On note donc l'ouverture du site elle-meme, au
  // plus une fois par heure et par joueur pour ne rien surcharger.
  useEffect(() => {
    if (!user?.id) return;

    const cle = `prono:last-seen:${user.id}`;
    try {
      const dernier = Number(window.localStorage.getItem(cle) ?? 0);
      if (Date.now() - dernier < 60 * 60 * 1000) return;
      window.localStorage.setItem(cle, String(Date.now()));
    } catch {
      // Stockage indisponible : on ecrit quand meme, sans limitation.
    }

    void supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(({ error }) => {
        // Colonne absente (migration non appliquee) : sans consequence,
        // l'Admin retombe sur la date d'authentification.
        if (error) console.warn("Derniere visite non enregistree", error.message);
      });
  }, [user?.id]);

  // Saison et journee de l'en-tete, lues en base. Aucun point n'est calcule
  // ici : on cherche seulement le prochain match de Ligue 1 a jouer, pour
  // afficher sa journee, sa date et son heure.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [{ data: settings }, { data: competitions }, { data: matchdays }] = await Promise.all([
          supabase.from("app_settings").select("season").eq("id", 1).maybeSingle(),
          supabase.from("competitions").select("id, code, external_code"),
          supabase.from("matchdays").select("id, number, competition_id, season"),
        ]);
        if (cancelled) return;

        const season = settings?.season ? String(settings.season) : null;
        if (season) setHeaderSeason(season);

        // Journees de LIGUE 1 uniquement : les 4 championnats bonus ont leurs
        // propres J1/J2 et fausseraient le numero affiche.
        const ligue1CompetitionIds = new Set(
          (competitions ?? [])
            .filter((c: any) => c.code === "FL1" || c.external_code === "FL1")
            .map((c: any) => String(c.id)),
        );
        const numberByMatchdayId = new Map<string, number>();
        (matchdays ?? []).forEach((md: any) => {
          if (season && md.season && String(md.season) !== season) return;
          if (md.competition_id && !ligue1CompetitionIds.has(String(md.competition_id))) return;
          numberByMatchdayId.set(String(md.id), Number(md.number ?? 0));
        });
        if (numberByMatchdayId.size === 0) return;

        const { data: matches } = await supabase
          .from("matches")
          .select("matchday_id, kickoff, is_bonus")
          .in("matchday_id", [...numberByMatchdayId.keys()]);
        if (cancelled) return;

        const playable = (matches ?? [])
          .filter((m: any) => m?.is_bonus !== true && m?.kickoff && m?.matchday_id)
          .map((m: any) => ({
            number: numberByMatchdayId.get(String(m.matchday_id)) ?? 0,
            at: new Date(String(m.kickoff)).getTime(),
          }))
          .filter((m) => m.number > 0 && Number.isFinite(m.at))
          .sort((a, b) => a.at - b.at);
        if (playable.length === 0) return;

        const now = Date.now();
        const next = playable.find((m) => m.at > now);
        const reference = next ?? playable[playable.length - 1];
        setHeaderDay({ number: reference.number, kickoff: next ? reference.at : null });
      } catch (error) {
        console.warn("En-tete : journee non chargee", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setVestiaireUnread(0);
      return;
    }

    if (currentPath === "/trophees") {
      // Ouvrir le Vestiaire vaut lecture : on déplace le repère, sinon les
      // messages déjà lus seraient recomptés au prochain chargement.
      markVestiaireRead();
      setVestiaireUnread(0);
      return;
    }

    let cancelled = false;

    // CORRECTIF : le badge ne comptait QUE les messages arrivés pendant que
    // l'application était ouverte — l'état repartait de 0 à chaque
    // chargement de page. Un joueur qui ouvrait l'app après que ses
    // coéquipiers avaient écrit ne voyait donc jamais rien. On repart
    // désormais du repère de dernière lecture conservé dans le navigateur
    // (src/lib/vestiaireUnread.ts), avant de continuer à compter en direct.
    void getVestiaireUnreadCount(user.id).then((count) => {
      if (!cancelled) setVestiaireUnread(count);
    });

    // Le Vestiaire émet un événement `storage` synthétique quand il marque
    // les messages comme lus : le badge retombe à zéro immédiatement.
    const onStorage = (event: StorageEvent) => {
      if (event.key === VESTIAIRE_UNREAD_KEY) setVestiaireUnread(0);
    };
    window.addEventListener("storage", onStorage);

    const channel = supabase
      .channel(`app-vestiaire-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const row = payload.new as { id?: string; user_id?: string | null };
          if (!row?.id || !row.user_id || row.user_id === user.id) return;
          if (window.location.pathname === "/trophees") {
            setVestiaireUnread(0);
            return;
          }
          setVestiaireUnread((current) => current + 1);
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Vestiaire notifications:", error || status);
        }
      });

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      void supabase.removeChannel(channel);
    };
  }, [currentPath, user?.id]);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const navItems = [
    { label: "Accueil", to: "/", icon: Home },
    { label: "Pronos", to: "/pronostics", icon: Target },
    { label: "Classement", to: "/classement", icon: Trophy },
    { label: "Gazette", to: "/gazette", icon: Newspaper },
    { label: "Vestiaire", to: "/trophees", icon: MessageCircle },
    // La route /trophees contient actuellement le Vestiaire.
    { label: "Stats", to: "/stats", icon: BarChart3 },
    { label: "Profil", to: "/profil", icon: User },
    // Invisible pour les joueurs : aucun lien/bouton Admin dans la nav tant
    // que profiles.is_admin n'est pas vrai. L'URL /admin reste en plus
    // protÃ©gÃ©e cÃ´tÃ© route par AdminRoute (voir src/routes/admin.tsx).
    ...(isAdmin ? [{ label: "Admin", to: "/admin", icon: Shield }] : []),
  ];

  return (
    <div
      // PAS de `min-h-screen` ici : `min-height: 100vh` l'emporterait sur la
      // hauteur ci-dessous des que la hauteur reellement visible est plus
      // petite que 100vh — c'est-a-dire presque toujours sur Android, ou la
      // barre d'URL la rogne, et massivement des que le clavier s'ouvre.
      // L'application restait alors plus haute que l'ecran, et tout ce qui se
      // trouve en bas (le champ de saisie du Vestiaire, son bouton Envoyer)
      // passait sous le bord de l'ecran, hors d'atteinte : le corps de page
      // ne defile pas, il n'y avait aucun moyen d'y acceder.
      //
      // `--app-vh` (voir useAppViewportHeight) est deja la hauteur visible
      // mesuree, et `100dvh` sert de repli tant que le script n'a pas tourne.
      // Les deux suffisent : un minimum en plus ne peut que les contredire.
      className="bg-[#030712] text-slate-100 relative flex flex-col font-sans"
      style={{ height: "var(--app-vh, 100dvh)" }}
    >

      {/* ================= ARRIÃˆRE-PLAN GLOBAL PREMIUM ================= */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#050b14]">
        
        {/* Calque 1 : fond global officiel de tout le site (public/arriere plan
            general.png â€” mÃªme fichier, jamais rÃ©gÃ©nÃ©rÃ© ni remplacÃ©). "cover" +
            position "top" pour remplir tout l'Ã©cran sans bandes vides tout en
            gardant le haut de l'image (oÃ¹ se trouve le stade + le logo Ligue 1
            d'origine) visible en prioritÃ©, quel que soit le format d'Ã©cran. */}
        <div
          className="absolute inset-0 bg-cover bg-top bg-no-repeat"
          style={{
            backgroundImage: "url('/arriere%20plan%20general.png')",
            backgroundAttachment: "fixed",
          }}
        />

        {/* Calque 2 : Vignette lÃ©gÃ¨re (assombrit Ã  peine les bords, pour ne pas dÃ©naturer l'image d'origine) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,11,22,0)_0%,rgba(3,7,18,0.35)_100%)]" />

        {/* Calque 3 : Reflets subtils aux couleurs de la Ligue 1 (Ã©meraude/bleu) */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-emerald-500/5 mix-blend-overlay" />
      </div>

      {/* Les deux badges "Ligue 1" dÃ©coratifs fixes (haut-droite / bas-gauche)
          qui vivaient ici ont Ã©tÃ© retirÃ©s : depuis le passage au nouveau fond
          global (public/arriere plan general.png), qui porte dÃ©jÃ  son propre
          logo Ligue 1 dans la photo elle-mÃªme, ces badges superposÃ©s
          faisaient doublon sur toutes les pages. Le logo Ligue 1 fonctionnel
          (navigation, favicon d'onglet) n'est pas concernÃ©, seulement ces
          deux images purement dÃ©coratives. */}

      {/* ================= HEADER / NAVIGATION ================= */}
      {/* paddingTop env(...) pousse le contenu sous l'encoche/la barre de statut
          sur mobile (iOS/Android) sans changer la hauteur visuelle sur les
          navigateurs qui ne la dÃ©finissent pas â€” env() vaut alors 0px. Fond
          et bordure du header couvrent quand mÃªme toute la zone au-dessus.
          En style inline (et non en classe Tailwind arbitraire) : le
          minifieur CSS du build Ã©mettait un warning sur `env()` Ã  l'intÃ©rieur
          d'un sÃ©lecteur gÃ©nÃ©rÃ©, sans le casser, mais autant l'Ã©viter. */}
      <header
        ref={headerRef}
        className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#060b16]/75 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 md:px-8">
          
          <Link to="/" className="flex items-center gap-3 group">
            <div className="size-10 rounded-2xl overflow-hidden border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform flex items-center justify-center bg-[#0d1322]">
              <img
                src="/logo%20ligue%201%20white.png"
                alt="Ligue 1"
                className="w-7 h-7 object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-extrabold uppercase tracking-wider text-white">
                  Prono Ligue 1
                </span>
                <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest block">
                Saison {headerSeason ?? "—"}
              </span>
            </div>
          </Link>

          {/* Version mobile compacte â€” icÃ´ne seule, sm:hidden. Bug rÃ©el
              trouvÃ© lors de l'audit final : le bloc "hidden sm:flex"
              ci-dessous Ã©tait la SEULE porte de dÃ©connexion de toute
              l'application, invisible sur tout Ã©cran < 640px, donc
              injoignable sur tÃ©lÃ©phone. MÃªme handleLogout/signOut, aucune
              logique d'authentification modifiÃ©e â€” juste rendue accessible. */}
          {user ? (
            <button
              onClick={handleLogout}
              className="sm:hidden flex size-9 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400"
              title="Se dÃ©connecter"
              aria-label="Se dÃ©connecter"
            >
              <LogOut size={16} />
            </button>
          ) : (
            <Link
              to="/auth"
              className="sm:hidden flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              aria-label="Connexion"
            >
              <LogIn size={16} />
            </Link>
          )}

          {/* SECTION DROITE : BADGE + BOUTON CONNEXION / DÃ‰CONNEXION */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-slate-800 bg-[#0d1322] px-3.5 py-1.5 shadow-inner">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-xs font-bold text-slate-200">
                {headerDay ? `J${headerDay.number}` : "—"}
              </span>
              {headerDay && (
                <>
                  <span className="h-3 w-px bg-slate-700" />
                  <span className="font-mono text-[11px] text-slate-400">
                    {headerDay.kickoff
                      ? new Date(headerDay.kickoff)
                          .toLocaleString("fr-FR", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                          .replace(",", " ·")
                      : "journée terminée"}
                  </span>
                </>
              )}
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white font-mono text-xs font-bold transition-all shadow-inner"
                title="Se dÃ©connecter"
              >
                <LogOut size={14} />
                <span>Quitter</span>
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-mono text-xs font-bold transition-all shadow-inner"
              >
                <LogIn size={14} />
                <span>Connexion</span>
              </Link>
            )}
          </div>

        </div>
      </header>

      {/* ================= CONTENU DE LA PAGE ================= */}
      {/* flex flex-col + min-h-0 : <main> devient un vrai maillon de la
          chaÃ®ne flex (pas juste un item flex-1, aussi un conteneur flex
          pour son enfant) â€” nÃ©cessaire pour qu'une page comme le Vestiaire
          puisse faire flex:1 + min-height:0 sur son propre conteneur racine
          et rÃ©cupÃ©rer l'espace rÃ©ellement disponible, sans recalculer quoi
          que ce soit en JS.
          min-w-0 sur le wrapper de {children} : correctif d'une rÃ©gression
          rÃ©elle trouvÃ©e lors de l'audit responsive (Pronos dÃ©bordait de
          680px sur 360px de large). En rendant <main> flex, chaque page
          devient un flex-item dont le min-width par dÃ©faut est "auto" (ne
          rÃ©trÃ©cit jamais sous la largeur de son contenu) â€” exactement le
          mÃªme piÃ¨ge que min-height sur l'axe vertical, ici sur l'axe
          horizontal. Un seul enfant large quelque part sur une page (ex.
          bandeau de journÃ©es Ã  dÃ©filer) suffisait Ã  repousser toute la page
          en largeur. Un seul wrapper min-w-0 ici corrige structurellement
          toutes les pages d'un coup, sans dupliquer le correctif page par
          page. */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-10">
        {/* Ce wrapper doit etre un MAILLON de la chaine flex, pas un bloc
            ordinaire. Ajoute a l'origine pour `min-w-0` (debordement en
            largeur), il etait reste en `display: block`, sans `flex: 1` et
            avec `min-height: auto` : il grandissait donc avec son contenu au
            lieu de tenir dans <main>.

            Consequence mesuree sur le Vestiaire, ecran 390x780 avec vingt
            messages : <main> faisait bien 711px, mais ce wrapper 1711px. La
            zone de messages heritait de cette hauteur, ne defilait plus
            (scrollHeight == clientHeight) et le champ de saisie se retrouvait
            a 1674px, tres loin sous le bord de l'ecran — impossible d'ecrire
            ni de remonter le fil.

            `flex-1 min-h-0 flex-col` le remet dans la chaine ; `min-w-0`
            reste, il corrigeait un vrai debordement horizontal. */}
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>
</main>

      {/* ================= NAVIGATION â€” un seul bloc, sur tous les Ã©crans ================= */}
      {/* Les maquettes ne montrent AUCUNE nav du haut, mÃªme en rÃ©solution
          desktop (~1024px) : une seule nav, en bas, partout â€” remplace
          l'ancien split "pills en haut dÃ¨s lg" / "barre flottante en bas
          jusqu'Ã  lg" par ce bloc unique, toujours affichÃ©.
          bottom via style inline : dÃ©cale la nav au-dessus de la barre de
          gestes (iOS) / navigation Android au lieu du seul bottom-4 fixe â€”
          env() vaut 0px par dÃ©faut, donc identique Ã  avant sur mobile.
          Style inline plutÃ´t que classe Tailwind arbitraire pour la mÃªme
          raison que le header ci-dessus (warning du minifieur CSS, inoffensif
          mais Ã©vitable). */}
      <div
        ref={navRef}
        className="fixed inset-x-4 z-50 transition-[opacity,transform] duration-200"
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          // MasquÃ©e pendant la saisie (clavier ouvert) plutÃ´t que superposÃ©e
          // au champ de texte ou au clavier â€” voir useKeyboardOpen ci-dessus.
          // pointer-events-none : Ã©vite un appui fantÃ´me sur un lien invisible.
          opacity: keyboardOpen ? 0 : 1,
          transform: keyboardOpen ? "translateY(16px)" : "translateY(0)",
          pointerEvents: keyboardOpen ? "none" : "auto",
        }}
      >
        {/* justify-around centre les items tant qu'ils tiennent ; l'ajout de "TrophÃ©es"
            (7e/8e lien) peut dÃ©passer la largeur disponible sur les trÃ¨s petits Ã©crans
            (ex. 360px) â€” le padding/icÃ´ne/texte ont donc Ã©tÃ© lÃ©gÃ¨rement resserrÃ©s pour
            que tout tienne sans rien retirer, et overflow-x-auto + scrollbar masquÃ©e
            servent de filet de sÃ©curitÃ© (glissement au lieu d'un lien invisible/coupÃ©)
            si un Ã©cran encore plus Ã©troit ou le lien Admin (utilisateurs admin) ne
            laissait vraiment plus assez de place. max-w-2xl + mx-auto : sur grand
            Ã©cran, reste alignÃ©e sur la largeur du contenu (comme les maquettes)
            au lieu de s'Ã©tirer sur toute la largeur de la fenÃªtre. */}
        <nav className="mx-auto flex max-w-2xl items-center justify-around overflow-x-auto bg-[#060b16]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)] [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-shrink-0 flex-col items-center gap-0.5 px-1 py-2 rounded-xl transition-all ${
                  isActive
                    ? "text-emerald-400 bg-emerald-500/10 shadow-[0_0_14px_rgba(16,185,129,0.28)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <div className="relative">
                  <Icon size={16} />
                  {item.label === "Vestiaire" && vestiaireUnread > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white shadow-lg">
                      {vestiaireUnread > 9 ? "9+" : vestiaireUnread}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-mono font-bold whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

    </div>
  );
}