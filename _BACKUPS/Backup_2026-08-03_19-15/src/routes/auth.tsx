import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Mail, User, ArrowRight, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { pseudo },
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Inscription réussie ! Tu peux maintenant te connecter.");
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate({ to: "/pronostics" });
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de l'authentification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060b16] text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-slate-800 bg-[#0d1322] p-8 shadow-2xl">
        {/* En-tête */}
        <div className="text-center space-y-2">
          <div className="inline-grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mx-auto shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Trophy className="size-7" />
          </div>
          <h1 className="font-display text-2xl uppercase tracking-tight text-white">
            {isSignUp ? "Créer un compte" : "Connexion"}
          </h1>
          <p className="text-xs text-slate-400">
            {isSignUp
              ? "Rejoins la ligue de pronostics et affronte tes amis"
              : "Connecte-toi pour enregistrer tes pronos sur Supabase"}
          </p>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400 text-center font-medium">
            ❌ {error}
          </div>
        )}

        {/* Message de succès */}
        {message && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-400 text-center font-medium">
            ✅ {message}
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Pseudo</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  placeholder="Ton pseudo"
                  className="w-full rounded-xl bg-[#060b16] border border-slate-800 px-4 py-3 pl-10 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Adresse e-mail</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@email.com"
                className="w-full rounded-xl bg-[#060b16] border border-slate-800 px-4 py-3 pl-10 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-[#060b16] border border-slate-800 px-4 py-3 pl-10 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-400 text-slate-950 font-display font-bold text-sm hover:bg-emerald-500 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 mt-2"
          >
            {loading ? "Chargement..." : isSignUp ? "S'inscrire" : "Se connecter"}
            <ArrowRight className="size-4" />
          </button>
        </form>

        {/* Bascule Connexion / Inscription */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
            }}
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
          >
            {isSignUp
              ? "Déjà un compte ? Connecte-toi"
              : "Pas encore de compte ? Inscris-toi"}
          </button>
        </div>
      </div>
    </div>
  );
}