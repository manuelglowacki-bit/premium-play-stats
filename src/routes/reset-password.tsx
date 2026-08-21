import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Lock, ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // État de la récupération : null = en cours d'initialisation (on attend
  // que Supabase traite le code PKCE présent dans l'URL), true = session de
  // récupération valide, false = aucun lien valide.
  const [recoveryReady, setRecoveryReady] = useState<boolean | null>(null);

  // Garde-fou anti-deadlock : on ne fait JAMAIS d'appel async Supabase dans
  // le callback onAuthStateChange. On stocke uniquement l'état, et on
  // déclenche la vérification de session en dehors du callback.
  const recoveryDetected = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // 1. Écoute l'événement PASSWORD_RECOVERY : c'est l'événement officiel
    //    Supabase qui signale que l'utilisateur vient d'un lien de
    //    récupération. On ne fait AUCUN appel async ici (anti-deadlock).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryDetected.current = true;
        if (!cancelled) setRecoveryReady(true);
      }
    });

    // 2. Vérifie la session existante (le lien PKCE peut déjà avoir été
    //    traité avant le montage du composant). On attend un petit délai
    //    pour laisser Supabase finir de traiter l'URL si nécessaire.
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data.session) {
        setRecoveryReady(true);
      } else if (!recoveryDetected.current) {
        // Aucune session ET aucun événement PASSWORD_RECOVERY : le lien est
        // réellement invalide/expiré. On ne l'affiche qu'après ce délai,
        // jamais pendant le chargement.
        setRecoveryReady(false);
      }
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations côté client
    if (!newPassword) {
      setError("Choisis un nouveau mot de passe.");
      return;
    }
    if (!confirmPassword) {
      setError("Confirme ton nouveau mot de passe.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        // Affiche l'erreur réelle de Supabase (lisible) au lieu d'un
        // message générique qui masquerait le problème.
        setError(updateError.message || "Impossible de modifier le mot de passe.");
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(
        err?.message || "Impossible de modifier le mot de passe pour le moment."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] min-h-screen flex-col overflow-hidden bg-[#020813] text-slate-100">
      {/* ================= BACKGROUND STADE NOCTURNE ================= */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-top bg-no-repeat"
        style={{ backgroundImage: "url('/arriere%20plan%20general.png')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,18,.78)_0%,rgba(2,8,18,.62)_45%,#020813_95%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,8,18,0)_35%,rgba(2,8,18,.55)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-emerald-500/5 mix-blend-overlay" />

      {/* Halo radial lumineux derrière la carte */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,.14) 0%, transparent 70%)" }}
      />

      <style>{`
        @keyframes auth-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-fade-up { animation: auth-fade-up .55s cubic-bezier(.22,1,.36,1) both; }
        @media (prefers-reduced-motion: reduce) {
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
          {success ? (
            /* ===== ÉTAT SUCCÈS ===== */
            <div className="flex flex-col items-center py-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10">
                <CheckCircle2 className="size-8 text-emerald-400" />
              </div>
              <h1 className="mt-5 font-display text-2xl font-black uppercase tracking-[.06em] text-white md:text-3xl">
                Mot de passe modifié
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
                Ton nouveau mot de passe a bien été enregistré.
              </p>

              <Link
                to="/auth"
                className="tap mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-4 font-display text-sm font-black uppercase tracking-[.06em] text-slate-950 shadow-[0_0_28px_rgba(16,185,129,0.4)] transition-all hover:brightness-110"
              >
                Retourner à la connexion
              </Link>
            </div>
          ) : recoveryReady === false ? (
            /* ===== LIEN INVALIDE / EXPIRÉ (affiché seulement après le
                     traitement Supabase terminé) ===== */
            <div className="flex flex-col items-center py-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10">
                <Lock className="size-8 text-amber-400" />
              </div>
              <h1 className="mt-5 font-display text-2xl font-black uppercase tracking-[.06em] text-white md:text-3xl">
                Lien invalide ou expiré
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
                Ce lien de réinitialisation n'est plus valide ou a déjà été
                utilisé.
              </p>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
                Demande un nouveau lien pour réinitialiser ton mot de passe.
              </p>

              <Link
                to="/forgot-password"
                className="tap mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-4 font-display text-sm font-black uppercase tracking-[.06em] text-slate-950 shadow-[0_0_28px_rgba(16,185,129,0.4)] transition-all hover:brightness-110"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          ) : recoveryReady === null ? (
            /* ===== CHARGEMENT : on attend que Supabase traite le lien ===== */
            <div className="flex flex-col items-center py-10 text-center">
              <span className="size-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[.2em] text-slate-500">
                Vérification du lien...
              </p>
            </div>
          ) : (
            <>
              {/* Titre */}
              <div className="text-center">
                <h1 className="font-display text-2xl font-black uppercase tracking-[.04em] text-white md:text-3xl">
                  Nouveau mot de passe
                </h1>
                <p className="mt-1.5 text-[13px] text-slate-400">
                  Choisis un nouveau mot de passe pour sécuriser ton compte.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 text-center font-medium" role="alert">
                  ❌ {error}
                </div>
              )}

              {/* Formulaire */}
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="text-xs font-semibold text-slate-300">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
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

                <div className="space-y-1.5">
                  <label htmlFor="confirm-password" className="text-xs font-semibold text-slate-300">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-800/80 bg-[#050b16]/80 px-4 py-3.5 pl-10 pr-12 text-sm text-white placeholder-slate-600 shadow-[inset_0_1px_3px_rgba(0,0,0,.4)] transition-all duration-200 focus:border-emerald-500/60 focus:bg-[#050b16] focus:shadow-[0_0_0_3px_rgba(16,185,129,.15),inset_0_1px_3px_rgba(0,0,0,.4)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      className="tap absolute right-2.5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-emerald-400"
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
                      Modification...
                    </span>
                  ) : (
                    <>
                      Modifier mon mot de passe
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Retour */}
              <div className="mt-5 text-center">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-emerald-400"
                >
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
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