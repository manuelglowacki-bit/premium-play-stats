import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

// URL de retour pour le lien de réinitialisation Supabase. Basée sur
// window.location.origin : fonctionne automatiquement en dev local
// (http://localhost:5173), en preview Vercel et en production — aucune
// URL hardcodée, aucune variable d'environnement à configurer.
function getRedirectUrl() {
  return `${window.location.origin}/reset-password`;
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation côté client
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Entre ton adresse e-mail.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Vérifie l'adresse e-mail saisie.");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        { redirectTo: getRedirectUrl() }
      );

      if (resetError) throw resetError;

      // Message générique volontairement : on ne révèle jamais si l'adresse
      // existe ou non dans la base (sécurité anti-énumération).
      setSent(true);
    } catch (err: any) {
      setError(
        "Impossible d'envoyer le lien pour le moment. Réessaie dans un instant."
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
          {sent ? (
            /* ===== ÉTAT CONFIRMATION ===== */
            <div className="flex flex-col items-center py-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10">
                <CheckCircle2 className="size-8 text-emerald-400" />
              </div>
              <h1 className="mt-5 font-display text-2xl font-black uppercase tracking-[.06em] text-white md:text-3xl">
                Lien envoyé
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
                Un lien de réinitialisation vient d'être envoyé à cette adresse
                e-mail.
              </p>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
                Vérifie ta boîte de réception ainsi que tes spams.
              </p>

              <Link
                to="/auth"
                className="tap mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-4 font-display text-sm font-black uppercase tracking-[.06em] text-slate-950 shadow-[0_0_28px_rgba(16,185,129,0.4)] transition-all hover:brightness-110"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              {/* Titre */}
              <div className="text-center">
                <h1 className="font-display text-2xl font-black uppercase tracking-[.04em] text-white md:text-3xl">
                  Mot de passe oublié ?
                </h1>
                <p className="mt-1.5 text-[13px] text-slate-400">
                  Entre ton adresse e-mail pour recevoir un lien de
                  réinitialisation.
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
                  <label htmlFor="forgot-email" className="text-xs font-semibold text-slate-300">
                    Adresse e-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="exemple@email.com"
                      autoComplete="email"
                      className="w-full rounded-xl border border-slate-800/80 bg-[#050b16]/80 px-4 py-3.5 pl-10 text-sm text-white placeholder-slate-600 shadow-[inset_0_1px_3px_rgba(0,0,0,.4)] transition-all duration-200 focus:border-emerald-500/60 focus:bg-[#050b16] focus:shadow-[0_0_0_3px_rgba(16,185,129,.15),inset_0_1px_3px_rgba(0,0,0,.4)] focus:outline-none"
                    />
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
                      Envoi en cours...
                    </span>
                  ) : (
                    <>
                      Envoyer le lien
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
                  <ArrowLeft className="size-3.5" />
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