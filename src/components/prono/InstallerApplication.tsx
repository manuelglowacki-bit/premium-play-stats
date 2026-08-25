import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

/**
 * INSTALLER L'APPLICATION SUR L'ÉCRAN D'ACCUEIL
 * =============================================
 * Le site remplit déjà tous les critères d'une application installable
 * (manifeste, icônes, service worker). Mais l'installation reste enfouie dans
 * le menu du navigateur : en pratique, personne ne la trouve.
 *
 * Ce bloc la propose directement, et diffère selon le téléphone :
 *
 *   Android / Chrome — le navigateur prévient AVANT d'afficher sa propre
 *   invite (`beforeinstallprompt`). On la retient et on la déclenche nous-
 *   mêmes au clic, au moment choisi par le joueur.
 *
 *   iPhone — Apple ne fournit aucune invite : l'installation passe forcément
 *   par Partager → « Sur l'écran d'accueil ». On affiche donc la marche à
 *   suivre, faute de pouvoir la déclencher.
 *
 * Une fois installé, le bloc disparaît de lui-même : `display-mode:
 * standalone` est vrai, il n'y a plus rien à proposer.
 */

type InviteInstallation = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CLE_REFUS = "installation-refusee";

export function InstallerApplication({ compact = false }: { compact?: boolean }) {
  const [invite, setInvite] = useState<InviteInstallation | null>(null);
  const [installee, setInstallee] = useState(false);
  const [refusee, setRefusee] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const surIphone =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    const dejaInstallee =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setInstallee(Boolean(dejaInstallee));

    try {
      setRefusee(localStorage.getItem(CLE_REFUS) === "1");
    } catch {
      // Navigation privée : on propose l'installation, quitte à la reproposer.
    }

    // L'invite a pu etre emise AVANT que ce composant existe : elle est
    // captee des le demarrage (voir src/main.tsx) et deposee sur `window`.
    // Sans cela, l'evenement passait pendant les quatre secondes d'intro et
    // le bouton n'apparaissait jamais sur Android.
    const dejaCaptee = (window as { inviteInstallation?: unknown }).inviteInstallation;
    if (dejaCaptee) setInvite(dejaCaptee as InviteInstallation);

    function capturer(evenement: Event) {
      evenement.preventDefault();
      setInvite(evenement as InviteInstallation);
    }
    function invitePrete() {
      const invitation = (window as { inviteInstallation?: unknown }).inviteInstallation;
      if (invitation) setInvite(invitation as InviteInstallation);
    }
    function installation() {
      setInstallee(true);
      setInvite(null);
    }

    window.addEventListener("beforeinstallprompt", capturer);
    window.addEventListener("invite-installation-prete", invitePrete);
    window.addEventListener("appinstalled", installation);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturer);
      window.removeEventListener("invite-installation-prete", invitePrete);
      window.removeEventListener("appinstalled", installation);
    };
  }, []);

  async function installer() {
    if (!invite || enCours) return;
    setEnCours(true);
    try {
      await invite.prompt();
      const choix = await invite.userChoice;
      if (choix.outcome === "accepted") setInstallee(true);
      delete (window as { inviteInstallation?: unknown }).inviteInstallation;
      // Une invite ne peut servir qu'une fois : le navigateur en emettra une
      // nouvelle si le joueur revient sans avoir installe.
      setInvite(null);
    } catch (erreur) {
      console.error("Installation :", erreur);
    } finally {
      setEnCours(false);
    }
  }

  function refuser() {
    setRefusee(true);
    try {
      localStorage.setItem(CLE_REFUS, "1");
    } catch {
      // Rien a garder : le bloc reviendra au prochain passage, sans plus.
    }
  }

  // Rien a proposer : deja installee, ou navigateur qui n'offre pas
  // l'installation (ordinateur sans support, navigateur integre d'une autre
  // application...).
  if (installee) return null;
  if (!invite && !surIphone) return null;

  // Le refus ne vaut que pour la proposition spontanee de l'Accueil. La
  // version `compact` vit dans le Profil, ou l'on va CHERCHER l'information :
  // l'y masquer rendrait l'installation introuvable des le premier refus.
  if (refusee && !compact) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-400/[0.10] via-[#0b1725]/90 to-[#08131f]/95 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      {!compact && (
        <button
          type="button"
          onClick={refuser}
          className="absolute right-2 top-2 grid size-6 place-items-center rounded-full text-slate-500 transition hover:bg-white/[.06] hover:text-white"
          aria-label="Ne plus proposer"
        >
          <X size={13} />
        </button>
      )}

      <div className={`flex items-start gap-3 ${compact ? "" : "pr-6"}`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <Download size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-black text-white">
            Installe l'application
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Une icône sur ton écran d'accueil, l'écran entier sans la barre du navigateur,
            et tu restes connecté.
          </p>

          {surIphone && !invite ? (
            <div className="mt-2.5 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-2.5 py-2 text-[11px] leading-relaxed text-amber-100">
              Touche <Share size={11} className="mx-0.5 inline align-[-1px]" />
              <span className="font-black">Partager</span> en bas de Safari, puis{" "}
              <span className="font-black">« Sur l'écran d'accueil »</span>.
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void installer()}
              disabled={enCours}
              className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 px-4 py-2 font-display text-xs font-black uppercase tracking-wide text-[#03100a] transition hover:from-emerald-300 hover:to-green-400 disabled:opacity-50"
            >
              <Download size={14} />
              {enCours ? "Installation…" : "Installer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
