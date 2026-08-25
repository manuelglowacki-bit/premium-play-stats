import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * `hideWhenEnabled` : n'affiche rien tant que l'etat n'est pas connu, puis
 * rien non plus si les notifications sont deja actives. Sert a proposer
 * l'activation sur la page Pronos UNIQUEMENT aux joueurs concernes, sans
 * encombrer ceux qui ont deja accepte.
 */
export default function PushNotificationsButton({
  hideWhenEnabled = false,
}: {
  hideWhenEnabled?: boolean;
} = {}) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Sans cet etat, le bloc apparaitrait une fraction de seconde chez ceux
  // qui ont deja active, le temps de la verification.
  const [verifie, setVerifie] = useState(false);

  /**
   * Le joueur a ferme la proposition. Elle occupait une grande carte en haut
   * de la page Pronos, y compris pour quelqu'un ayant deja refuse les
   * notifications : une invitation qu'on ne peut pas ecarter finit par etre
   * lue comme du bruit, et c'est toute la page qui en patit.
   *
   * Le refus est garde sur l'appareil. Il ne coupe rien : les notifications
   * restent activables depuis le Profil, ou le meme bloc est toujours affiche.
   */
  const [refuse, setRefuse] = useState(() => {
    try {
      return localStorage.getItem("rappels-proposition-fermee") === "1";
    } catch {
      return false;
    }
  });

  function fermerProposition() {
    setRefuse(true);
    try {
      localStorage.setItem("rappels-proposition-fermee", "1");
    } catch {
      // Navigation privee : la proposition reviendra au prochain passage.
    }
  }

  /**
   * iPhone : les notifications Push n'existent PAS dans Safari. Apple ne les
   * autorise que depuis un site AJOUTE A L'ECRAN D'ACCUEIL (iOS 16.4+).
   *
   * Sans ce test, un joueur sur iPhone voyait un badge rouge « Desactivees »
   * et un bouton « Activer » qui echouait avec « pas disponibles sur cet
   * appareil » — une phrase qui laisse croire que son telephone est trop
   * vieux, alors qu'il lui manque juste une manipulation de dix secondes.
   */
  const surIphone =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const applicationInstallee =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);
  const iphoneSansInstallation = surIphone && !applicationInstallee;

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEnabled(false);
        setVerifie(true);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/push-sw.js");
        const subscription = await registration.pushManager.getSubscription();

        // "ACTIVÉ" doit refléter un état réellement fonctionnel, pas
        // seulement "un objet PushSubscription existe dans ce navigateur"
        // (bug identifié en Phase 2 — diagnostic notification : le
        // navigateur ne désabonne jamais automatiquement une subscription
        // simplement parce que la clé VAPID serveur a changé, ni parce que
        // la permission a pu être révoquée entre-temps dans certains cas.
        // Un ancien abonnement orphelin pouvait donc rester "présent" côté
        // navigateur — et afficher "ACTIVÉ" — tout en étant inutilisable :
        // aucune notification ne pouvait jamais arriver). On vérifie donc
        // successivement : permission toujours accordée, subscription
        // toujours présente, ET cette subscription précise (même endpoint)
        // réellement enregistrée côté Supabase pour l'utilisateur connecté
        // — c'est notre source de vérité, pas la simple présence locale.
        if (
          typeof Notification === "undefined" ||
          Notification.permission !== "granted" ||
          !subscription
        ) {
          setEnabled(false);
          setVerifie(true);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setEnabled(false);
          setVerifie(true);
          return;
        }

        const { data: existingRow } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();

        if (existingRow) {
          setEnabled(true);
        } else {
          // Abonnement local orphelin (obsolète ou désynchronisé de
          // Supabase, ex. nettoyé côté serveur après un envoi en échec) :
          // désabonnement propre plutôt que d'afficher un "ACTIVÉ" trompeur
          // qui ne mènera jamais à un rappel reçu. L'utilisateur peut alors
          // recliquer "ACTIVER" pour recréer un abonnement à jour.
          try {
            await subscription.unsubscribe();
          } catch (unsubError) {
            console.warn("Nettoyage abonnement Push orphelin :", unsubError);
          }
          setEnabled(false);
        }
      } catch (error) {
        console.error("Push init:", error);
        setEnabled(false);
      } finally {
        setVerifie(true);
      }
    })();
  }, []);

  async function enablePush() {
    if (busy) return;
    setBusy(true);
    setMessage("");

    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error(
          iphoneSansInstallation
            ? "Sur iPhone, les notifications ne marchent que depuis l'application installée. Touche le bouton Partager en bas de Safari, puis « Sur l'écran d'accueil » — et rouvre le site depuis cette icône."
            : "Les notifications Push ne sont pas disponibles sur cet appareil.",
        );
      }

      if (!VAPID_PUBLIC_KEY) {
        // Ce message s'affiche a l'organisateur comme aux joueurs : il doit
        // dire ou est le probleme, pas ou il serait sur un ordinateur de
        // developpement. `.env.local` n'existe pas sur le site en ligne — la
        // cle publique s'y ajoute dans les variables d'environnement de
        // l'hebergeur, et elle n'est prise en compte qu'au BUILD SUIVANT.
        throw new Error(
          "La clé publique des notifications (VITE_VAPID_PUBLIC_KEY) manque " +
            "dans la configuration du site. À ajouter dans les variables " +
            "d'environnement de Vercel, puis redéployer.",
        );
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tu dois être connecté pour activer les notifications.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permission de notification refusée.");

      const registration = await navigator.serviceWorker.register("/push-sw.js");

      // On repart toujours d'un abonnement neuf ici : si l'utilisateur voit
      // ce bouton "ACTIVER" (pas "ACTIVÉ"), c'est justement qu'on n'a pas pu
      // confirmer qu'un abonnement existant est valide et à jour (voir
      // l'effet de montage ci-dessus). Réutiliser un éventuel abonnement
      // résiduel renverrait potentiellement une clé/endpoint périmés.
      const staleSubscription = await registration.pushManager.getSubscription();
      if (staleSubscription) {
        try {
          await staleSubscription.unsubscribe();
        } catch (unsubError) {
          console.warn("Désabonnement préalable impossible :", unsubError);
        }
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = subscription.toJSON();
      const endpoint = json.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        throw new Error("Abonnement Push incomplet.");
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,endpoint" }
        );

      if (error) throw error;

      setEnabled(true);
      setMessage("Notifications activées ✓");
    } catch (error) {
      console.error("Activation Push:", error);
      setMessage(error instanceof Error ? error.message : "Impossible d'activer les notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (busy) return;
    setBusy(true);
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const subscription = await registration?.pushManager.getSubscription();

      if (user && subscription) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      if (subscription) await subscription.unsubscribe();

      setEnabled(false);
      setMessage("Notifications désactivées.");
    } catch (error) {
      console.error("Désactivation Push:", error);
      setMessage("Impossible de désactiver les notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (hideWhenEnabled && (!verifie || enabled)) return null;
  // `hideWhenEnabled` marque la proposition spontanee (page Pronos). Ailleurs
  // — le Profil — on va CHERCHER le reglage : l'y masquer le rendrait
  // introuvable des le premier refus.
  if (hideWhenEnabled && refuse) return null;

  return (
    <div className="relative mx-3 my-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
      {hideWhenEnabled && (
        <button
          type="button"
          onClick={fermerProposition}
          className="absolute right-2 top-2 grid size-6 place-items-center rounded-full text-slate-500 transition hover:bg-white/[.06] hover:text-white"
          aria-label="Ne plus proposer"
          title="Ne plus proposer — reste disponible dans le Profil"
        >
          <X size={13} />
        </button>
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-black text-white">🔔 Rappels de pronostics</div>
          <div className="mt-1 text-xs leading-relaxed text-slate-400">
            Reçois une notification 1 h avant un match si tu n'as pas encore fait ton prono.
          </div>
          {/* La marche a suivre AVANT le clic : un joueur sur iPhone ne doit
              pas avoir a echouer une fois pour apprendre ce qui lui manque. */}
          {iphoneSansInstallation && (
            <div className="mt-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-2.5 py-2 text-[11px] leading-relaxed text-amber-100">
              <span className="font-black">Sur iPhone,</span> les notifications ne fonctionnent
              qu'une fois le site installé. Touche <span className="font-black">Partager</span> en
              bas de Safari, puis <span className="font-black">« Sur l'écran d'accueil »</span>, et
              rouvre le site depuis cette icône.
            </div>
          )}
          {message && message !== "Notifications activées ✓" && (
            <div className="mt-2 text-xs text-emerald-300">{message}</div>
          )}
        </div>

        {/* Le bouton affichait l'ETAT ("ACTIVÉ") alors qu'un clic dessus fait
            l'inverse : on croyait lire une information, on declenchait une
            desactivation. L'etat est desormais annonce a gauche, et le bouton
            ne porte plus que l'action. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {/* L'etat se lit a la couleur : vert quand les rappels fonctionnent,
              ROUGE quand ils sont coupes — un gris discret laissait croire que
              tout allait bien alors que le joueur ne recevra jamais rien. */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[.14em] ${
              enabled
                ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                : "border-red-400/40 bg-red-500/15 text-red-300"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                enabled
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]"
                  : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,.8)]"
              }`}
            />
            {enabled ? "Activées" : "Désactivées"}
          </span>

          <button
            type="button"
            disabled={busy}
            onClick={() => void (enabled ? disablePush() : enablePush())}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              enabled
                ? "border border-slate-700 bg-slate-800/70 text-slate-400 hover:border-red-400/40 hover:text-red-300"
                : "bg-emerald-400 text-[#06101c] shadow-[0_0_20px_rgba(52,211,153,.35)] hover:bg-emerald-300"
            } disabled:opacity-50`}
          >
            {busy ? "..." : enabled ? "Désactiver" : "Activer"}
          </button>
        </div>
      </div>
    </div>
  );
}
