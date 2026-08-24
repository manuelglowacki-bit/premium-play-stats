import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Mail, User, ArrowRight, Trophy, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

// Supabase renvoie ses erreurs en anglais technique ("Invalid login
// credentials", "User already registered"...). Elles etaient affichees
// telles quelles aux joueurs. On les traduit, et on garde un repli lisible
// pour les cas non prevus.
function messageErreur(brut: string): string {
  const texte = (brut || "").toLowerCase();

  if (texte.includes("invalid login credentials")) {
    return "E-mail ou mot de passe incorrect.";
  }
  if (texte.includes("email not confirmed")) {
    return "Ton adresse e-mail n'est pas encore confirmée : ouvre le message reçu à l'inscription.";
  }
  if (texte.includes("user already registered") || texte.includes("already been registered")) {
    return "Un compte existe déjà avec cette adresse. Connecte-toi plutôt.";
  }
  if (texte.includes("password should be at least")) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }
  if (texte.includes("unable to validate email") || texte.includes("invalid email")) {
    return "Cette adresse e-mail n'est pas valide.";
  }
  if (texte.includes("rate limit") || texte.includes("too many requests")) {
    return "Trop de tentatives. Patiente une minute avant de réessayer.";
  }
  if (texte.includes("failed to fetch") || texte.includes("network")) {
    return "Connexion au serveur impossible. Vérifie ta connexion Internet.";
  }
  return brut || "Une erreur est survenue. Réessaie dans un instant.";
}

// Exportée (et pas seulement passée à `component`) pour être réutilisée
// directement par src/routes/__root.tsx comme écran de connexion affiché
// entre l'intro et l'application — même formulaire, même logique Supabase.
export function AuthPage() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Sur telephone, le clavier met souvent une majuscule au premier
    // caractere et ajoute un espace : "  Manuel@Gmail.com " ne correspond
    // alors a aucun compte. On normalise avant d'envoyer.
    const emailPropre = email.trim().toLowerCase();
    const pseudoPropre = pseudo.trim();

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: emailPropre,
          password,
          options: {
            data: { pseudo: pseudoPropre },
          },
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({
              id: data.user.id,
              pseudo: pseudoPropre,
              avatar_url: null,
              favorite_team: null,
              is_admin: false,
            });

          if (profileError) {
            console.error(profileError);
          }
        }

        // Si la confirmation par e-mail est activée côté Supabase, aucune
        // session n'est ouverte : dire "tu peux te connecter" serait faux,
        // le joueur essaierait et se ferait refuser.
        if (data.session) {
          navigate({ to: "/" });
          return;
        }
        setMessage(
          data.user
            ? "Compte créé. Ouvre le message envoyé à ton adresse pour le confirmer, puis connecte-toi."
            : "Compte créé. Tu peux maintenant te connecter.",
        );
        setIsSignUp(false);
      } else {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: emailPropre,
            password,
          });

        if (signInError) throw signInError;

        if (data.session) {
          // Connexion réussie → page d'accueil (objectif : Intro → Login →
          // Accueil). __root.tsx bascule aussi automatiquement de l'écran de
          // connexion vers l'app dès que `useAuth().user` devient non-null
          // (voir onAuthStateChange dans AuthContext) ; cette navigation
          // garantit en plus que l'URL pointe bien sur "/" et pas sur une
          // route protégée qui aurait déclenché l'affichage du login.
          navigate({ to: "/" });
        }
      }
    } catch (err: any) {
      setError(messageErreur(err?.message ?? ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-[100dvh] min-h-screen flex-col overflow-hidden bg-[#020813] text-slate-100"
    >
      {/* ================= BACKGROUND STADE NOCTURNE ================= */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-top bg-no-repeat"
        style={{ backgroundImage: "url('/arriere%20plan%20general.png')" }}
      />
      {/* Voile sombre pour lisibilité */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,18,.78)_0%,rgba(2,8,18,.62)_45%,#020813_95%)]" />
      {/* Vignette latérale */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,8,18,0)_35%,rgba(2,8,18,.55)_100%)]" />
      {/* Reflets Ligue 1 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-emerald-500/5 mix-blend-overlay" />

      {/* Halo radial lumineux derrière la carte */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,.14) 0%, transparent 70%)" }}
      />

      {/* Particules très discrètes */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[12%] top-[20%] size-1 rounded-full bg-emerald-300/50"
        style={{ animation: "auth-drift 6s ease-in-out infinite", boxShadow: "0 0 8px rgba(110,231,183,.4)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[15%] top-[62%] size-[6px] rounded-full bg-amber-300/50"
        style={{ animation: "auth-drift 8s ease-in-out infinite 1s", boxShadow: "0 0 10px rgba(252,211,77,.4)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-[68%] top-[15%] size-[5px] rounded-full bg-emerald-300/40"
        style={{ animation: "auth-drift 7s ease-in-out infinite .5s", boxShadow: "0 0 8px rgba(110,231,183,.35)" }}
      />

      <style>{`
        @keyframes auth-drift {
          0% { transform: translate3d(0,0,0); opacity: 0; }
          15% { opacity: .9; }
          85% { opacity: .9; }
          100% { transform: translate3d(6px,-30px,0); opacity: 0; }
        }
        @keyframes auth-glow {
          0%,100% { filter: drop-shadow(0 0 8px rgba(16,185,129,.35)); }
          50% { filter: drop-shadow(0 0 18px rgba(16,185,129,.65)); }
        }
        .auth-glow { animation: auth-glow 3s ease-in-out infinite; }

        @keyframes auth-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-fade-up { animation: auth-fade-up .55s cubic-bezier(.22,1,.36,1) both; }

        @media (prefers-reduced-motion: reduce) {
          .auth-glow { animation: none; }
          .auth-fade-up { animation: none; }
        }
      `}</style>

      {/* ================= CONTENU ================= */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {/* ---- BRANDING ---- */}
        <div className="auth-fade-up flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <img
              src="/logo%20ligue%201%20white.png"
              alt="Ligue 1"
              className="h-6 w-auto object-contain md:h-7"
            />
            <span className="font-display text-lg font-black uppercase tracking-[.06em] text-white md:text-xl">
              Prono <span className="text-emerald-400">Ligue 1</span> LM
            </span>
          </div>
          <p className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-slate-400">
            La compétition commence ici
          </p>
        </div>

        {/* ---- CARTE CENTRALE ---- */}
        <div className="auth-fade-up mt-5 w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1325]/75 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-8" style={{ animationDelay: "80ms" }}>
          {/* Trophée premium */}
          <div className="auth-glow mx-auto flex size-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10">
            <Trophy className="size-7 text-emerald-400" strokeWidth={1.4} />
          </div>

          {/* Titre */}
          <div className="mt-4 text-center">
            <h1 className="font-display text-3xl font-black uppercase tracking-[.04em] text-white md:text-4xl">
              {isSignUp ? "Créer un compte" : "Connexion"}
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-400">
              {isSignUp
                ? "Rejoins la compétition et affronte tes amis"
                : "Connecte-toi pour retrouver tes pronostics"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 text-center font-medium" role="alert">
              ❌ {error}
            </div>
          )}

          {/* Success */}
          {message && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 text-center font-medium" role="status">
              ✅ {message}
            </div>
          )}

          {/* ---- FORMULAIRE ---- */}
          <form onSubmit={handleAuth} className="mt-5 space-y-4">
            {isSignUp && (
              <div className="space-y-1.5">
                <label htmlFor="auth-pseudo" className="text-xs font-semibold text-slate-300">
                  Pseudo
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                  <input
                    id="auth-pseudo"
                    type="text"
                    required
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    placeholder="Ton pseudo"
                    autoComplete="nickname"
                    maxLength={20}
                    className="w-full rounded-xl border border-slate-800/80 bg-[#050b16]/80 px-4 py-3.5 pl-10 text-sm text-white placeholder-slate-600 shadow-[inset_0_1px_3px_rgba(0,0,0,.4)] transition-all duration-200 focus:border-emerald-500/60 focus:bg-[#050b16] focus:shadow-[0_0_0_3px_rgba(16,185,129,.15),inset_0_1px_3px_rgba(0,0,0,.4)] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="text-xs font-semibold text-slate-300">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-slate-800/80 bg-[#050b16]/80 px-4 py-3.5 pl-10 text-sm text-white placeholder-slate-600 shadow-[inset_0_1px_3px_rgba(0,0,0,.4)] transition-all duration-200 focus:border-emerald-500/60 focus:bg-[#050b16] focus:shadow-[0_0_0_3px_rgba(16,185,129,.15),inset_0_1px_3px_rgba(0,0,0,.4)] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="auth-password" className="text-xs font-semibold text-slate-300">
                  Mot de passe
                </label>
                {!isSignUp && (
                  <Link
                    to="/forgot-password"
                    className="text-[11px] font-medium text-slate-400 underline decoration-slate-600/50 underline-offset-4 transition-colors hover:text-emerald-400"
                  >
                    Mot de passe oublié ?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  minLength={isSignUp ? 6 : undefined}
                  className="w-full rounded-xl border border-slate-800/80 bg-[#050b16]/80 px-4 py-3.5 pl-10 pr-12 text-sm text-white placeholder-slate-600 shadow-[inset_0_1px_3px_rgba(0,0,0,.4)] transition-all duration-200 focus:border-emerald-500/60 focus:bg-[#050b16] focus:shadow-[0_0_0_3px_rgba(16,185,129,.15),inset_0_1px_3px_rgba(0,0,0,.4)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="tap absolute right-2.5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-emerald-400"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-4 font-display text-sm font-black uppercase tracking-[.06em] text-slate-950 shadow-[0_0_28px_rgba(16,185,129,0.4)] transition-all hover:brightness-110 disabled:pointer-events-none disabled:opacity-70"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                  {isSignUp ? "Création..." : "Connexion..."}
                </span>
              ) : (
                <>
                  {isSignUp ? "S'inscrire" : "Se connecter"}
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Bascule */}
          <div className="mt-5 text-center">
            <span className="text-xs text-slate-400">
              {isSignUp ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setMessage(null);
                }}
                className="font-semibold text-emerald-400 underline decoration-emerald-400/40 underline-offset-4 transition-colors hover:text-emerald-300"
              >
                {isSignUp ? "Connecte-toi" : "S'inscrire"}
              </button>
            </span>
          </div>

          {/* Micro-information */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <ShieldCheck className="size-3 text-slate-500" />
            <span className="text-[10px] text-slate-500">
              Tes pronostics sont sauvegardés sur ton compte
            </span>
          </div>
        </div>

        {/* ---- FOOTER ---- */}
        <div className="auth-fade-up mt-6 flex items-center gap-3 opacity-70" style={{ animationDelay: "160ms" }}>
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-400/50" />
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[.3em] text-amber-100/70">
            Prono Ligue 1 LM · Saison 2026/27
          </span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-400/50" />
        </div>
      </div>
    </div>
  );
}