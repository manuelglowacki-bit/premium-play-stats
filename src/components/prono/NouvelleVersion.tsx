import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  VERSION_EMBARQUEE,
  doitVerifier,
  lireVersionPubliee,
  nouvelleVersion,
} from "@/lib/versionSite";

/**
 * Bandeau « Nouvelle version disponible ».
 *
 * Verifie au retour au premier plan (et une fois au demarrage), au plus une
 * fois toutes les cinq minutes. Ne recharge jamais tout seul : un joueur en
 * train de saisir ses pronostics perdrait sa saisie.
 *
 * Voir src/lib/versionSite.ts pour le mecanisme et npm run verif-version pour
 * les regles de decision.
 */
export function NouvelleVersion() {
  const [disponible, setDisponible] = useState(false);
  const [rechargement, setRechargement] = useState(false);
  const derniereVerification = useRef(0);

  const verifier = useCallback(async () => {
    const maintenant = Date.now();
    if (!doitVerifier(maintenant, derniereVerification.current)) return;
    derniereVerification.current = maintenant;

    const publiee = await lireVersionPubliee(fetch, "/version.json", maintenant);
    if (nouvelleVersion(VERSION_EMBARQUEE, publiee)) setDisponible(true);
  }, []);

  useEffect(() => {
    // Une fois au demarrage : un onglet laisse ouvert toute la nuit sans jamais
    // repasser en arriere-plan ne declencherait sinon aucune verification.
    void verifier();

    function auRetour() {
      if (document.visibilityState === "visible") void verifier();
    }

    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, [verifier]);

  if (!disponible) return null;

  return (
    <div className="fixed inset-x-3 z-[60] flex justify-center bottom-[calc(var(--app-nav-h,72px)+env(safe-area-inset-bottom)+12px)] sm:bottom-5">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-emerald-400/30 bg-[#07131f]/95 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <RefreshCw size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-black text-white">Nouvelle version</div>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
            Recharge pour en profiter. Tes pronostics enregistrés ne bougent pas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setRechargement(true);
            window.location.reload();
          }}
          disabled={rechargement}
          className="shrink-0 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 px-3.5 py-2 font-display text-xs font-black uppercase tracking-wide text-[#03100a] transition hover:from-emerald-300 hover:to-green-400 disabled:opacity-60"
        >
          {rechargement ? "…" : "Recharger"}
        </button>
      </div>
    </div>
  );
}

export default NouvelleVersion;
