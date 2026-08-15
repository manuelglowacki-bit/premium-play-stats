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
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useKeyboardOpen } from "@/hooks/useKeyboardOpen";

/**
 * Hauteur réellement visible de l'app, en une seule source pour toute
 * l'appli — posée sur <html> comme variable CSS `--app-vh`, dérivée de
 * window.visualViewport (seule API qui réagit vraiment à l'ouverture du
 * clavier virtuel sur Android Chrome ; 100vh/100dvh non, le clavier
 * chevauche le contenu au lieu de réduire la hauteur visible). Toute page
 * qui a besoin de "toute la hauteur disponible" (ex. le Vestiaire) peut
 * alors se contenter d'un simple height: 100% en cascade, sans recalculer
 * quoi que ce soit elle-même.
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
 * Hauteur RÉELLE (mesurée, jamais devinée) du header sticky et de la nav
 * flottante, posées sur <html> comme `--app-header-h` / `--app-nav-h`.
 * Sert à des pages qui ont besoin de réserver un espace exact sous le
 * header ou au-dessus de la nav (ex. Admin → Suivi des pronostics) sans
 * qu'un padding en dur (ex. pb-32) ne se retrouve un jour trop court ou
 * trop long si ces éléments changent de taille. ResizeObserver plutôt que
 * seulement `resize` : réagit aussi si le contenu du header/de la nav
 * change de taille sans que la fenêtre change (ex. badge qui apparaît/
 * disparaît à un breakpoint, police qui finit de charger).
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
  // Même source de vérité que le reste de l'app (AuthContext) plutôt qu'un
  // second abonnement local à la session Supabase — `isAdmin` en découle
  // déjà (profiles.is_admin), c'est le mécanisme déjà utilisé par
  // AdminRoute pour protéger la route /admin, réutilisé ici pour la nav.
  const { user, isAdmin, signOut } = useAuth();
  const keyboardOpen = useKeyboardOpen();
  useAppViewportHeight();
  const headerRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  useMeasuredChromeHeights(headerRef, navRef);

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
    // protégée côté route par AdminRoute (voir src/routes/admin.tsx).
    ...(isAdmin ? [{ label: "Admin", to: "/admin", icon: Shield }] : []),
  ];

  return (
    <div
      className="min-h-screen bg-[#030712] text-slate-100 relative flex flex-col font-sans"
      style={{ height: "var(--app-vh, 100dvh)" }}
    >

      {/* ================= ARRIÈRE-PLAN GLOBAL PREMIUM ================= */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#050b14]">
        
        {/* Calque 1 : fond global officiel de tout le site (public/arriere plan
            general.png — même fichier, jamais régénéré ni remplacé). "cover" +
            position "top" pour remplir tout l'écran sans bandes vides tout en
            gardant le haut de l'image (où se trouve le stade + le logo Ligue 1
            d'origine) visible en priorité, quel que soit le format d'écran. */}
        <div
          className="absolute inset-0 bg-cover bg-top bg-no-repeat"
          style={{
            backgroundImage: "url('/arriere%20plan%20general.png')",
            backgroundAttachment: "fixed",
          }}
        />

        {/* Calque 2 : Vignette légère (assombrit à peine les bords, pour ne pas dénaturer l'image d'origine) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,11,22,0)_0%,rgba(3,7,18,0.35)_100%)]" />

        {/* Calque 3 : Reflets subtils aux couleurs de la Ligue 1 (émeraude/bleu) */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-emerald-500/5 mix-blend-overlay" />
      </div>

      {/* Les deux badges "Ligue 1" décoratifs fixes (haut-droite / bas-gauche)
          qui vivaient ici ont été retirés : depuis le passage au nouveau fond
          global (public/arriere plan general.png), qui porte déjà son propre
          logo Ligue 1 dans la photo elle-même, ces badges superposés
          faisaient doublon sur toutes les pages. Le logo Ligue 1 fonctionnel
          (navigation, favicon d'onglet) n'est pas concerné, seulement ces
          deux images purement décoratives. */}

      {/* ================= HEADER / NAVIGATION ================= */}
      {/* paddingTop env(...) pousse le contenu sous l'encoche/la barre de statut
          sur mobile (iOS/Android) sans changer la hauteur visuelle sur les
          navigateurs qui ne la définissent pas — env() vaut alors 0px. Fond
          et bordure du header couvrent quand même toute la zone au-dessus.
          En style inline (et non en classe Tailwind arbitraire) : le
          minifieur CSS du build émettait un warning sur `env()` à l'intérieur
          d'un sélecteur généré, sans le casser, mais autant l'éviter. */}
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
                Saison 2026-2027
              </span>
            </div>
          </Link>

          {/* Version mobile compacte — icône seule, sm:hidden. Bug réel
              trouvé lors de l'audit final : le bloc "hidden sm:flex"
              ci-dessous était la SEULE porte de déconnexion de toute
              l'application, invisible sur tout écran < 640px, donc
              injoignable sur téléphone. Même handleLogout/signOut, aucune
              logique d'authentification modifiée — juste rendue accessible. */}
          {user ? (
            <button
              onClick={handleLogout}
              className="sm:hidden flex size-9 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400"
              title="Se déconnecter"
              aria-label="Se déconnecter"
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

          {/* SECTION DROITE : BADGE + BOUTON CONNEXION / DÉCONNEXION */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#0d1322] px-3.5 py-1.5 shadow-inner">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-xs font-bold text-slate-300">J1 • 2026</span>
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white font-mono text-xs font-bold transition-all shadow-inner"
                title="Se déconnecter"
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
          chaîne flex (pas juste un item flex-1, aussi un conteneur flex
          pour son enfant) — nécessaire pour qu'une page comme le Vestiaire
          puisse faire flex:1 + min-height:0 sur son propre conteneur racine
          et récupérer l'espace réellement disponible, sans recalculer quoi
          que ce soit en JS.
          min-w-0 sur le wrapper de {children} : correctif d'une régression
          réelle trouvée lors de l'audit responsive (Pronos débordait de
          680px sur 360px de large). En rendant <main> flex, chaque page
          devient un flex-item dont le min-width par défaut est "auto" (ne
          rétrécit jamais sous la largeur de son contenu) — exactement le
          même piège que min-height sur l'axe vertical, ici sur l'axe
          horizontal. Un seul enfant large quelque part sur une page (ex.
          bandeau de journées à défiler) suffisait à repousser toute la page
          en largeur. Un seul wrapper min-w-0 ici corrige structurellement
          toutes les pages d'un coup, sans dupliquer le correctif page par
          page. */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-10">
        <div className="min-w-0 w-full">{children}</div>
</main>

      {/* ================= NAVIGATION — un seul bloc, sur tous les écrans ================= */}
      {/* Les maquettes ne montrent AUCUNE nav du haut, même en résolution
          desktop (~1024px) : une seule nav, en bas, partout — remplace
          l'ancien split "pills en haut dès lg" / "barre flottante en bas
          jusqu'à lg" par ce bloc unique, toujours affiché.
          bottom via style inline : décale la nav au-dessus de la barre de
          gestes (iOS) / navigation Android au lieu du seul bottom-4 fixe —
          env() vaut 0px par défaut, donc identique à avant sur mobile.
          Style inline plutôt que classe Tailwind arbitraire pour la même
          raison que le header ci-dessus (warning du minifieur CSS, inoffensif
          mais évitable). */}
      <div
        ref={navRef}
        className="fixed inset-x-4 z-50 transition-[opacity,transform] duration-200"
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          // Masquée pendant la saisie (clavier ouvert) plutôt que superposée
          // au champ de texte ou au clavier — voir useKeyboardOpen ci-dessus.
          // pointer-events-none : évite un appui fantôme sur un lien invisible.
          opacity: keyboardOpen ? 0 : 1,
          transform: keyboardOpen ? "translateY(16px)" : "translateY(0)",
          pointerEvents: keyboardOpen ? "none" : "auto",
        }}
      >
        {/* justify-around centre les items tant qu'ils tiennent ; l'ajout de "Trophées"
            (7e/8e lien) peut dépasser la largeur disponible sur les très petits écrans
            (ex. 360px) — le padding/icône/texte ont donc été légèrement resserrés pour
            que tout tienne sans rien retirer, et overflow-x-auto + scrollbar masquée
            servent de filet de sécurité (glissement au lieu d'un lien invisible/coupé)
            si un écran encore plus étroit ou le lien Admin (utilisateurs admin) ne
            laissait vraiment plus assez de place. max-w-2xl + mx-auto : sur grand
            écran, reste alignée sur la largeur du contenu (comme les maquettes)
            au lieu de s'étirer sur toute la largeur de la fenêtre. */}
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
                <Icon size={16} />
                <span className="text-[9px] font-mono font-bold whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

    </div>
  );
}
