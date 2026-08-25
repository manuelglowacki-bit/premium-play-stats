/**
 * MESSAGES PRIVÉS — VÉRIFICATIONS
 * ===============================
 * `npm run verif-prives`
 *
 * Deux choses sont testées ici, et une seule est du calcul.
 *
 * La première est un accident réel : la pastille de l'entête et le panneau
 * ouvert écoutent tous deux les messages reçus. Tant qu'ils demandaient le
 * même nom de canal, le second abonnement levait une erreur sur-le-champ et
 * faisait tomber tout le Vestiaire sur « Something went wrong » — au moment
 * précis où l'on cliquait sur le cadenas. Le test s'abonne donc deux fois, ce
 * que le site fait vraiment.
 *
 * La seconde est le regroupement en conversations : c'est lui qui décide ce
 * qu'on voit en tête de liste et combien de messages sont annoncés non lus.
 */

import {
  abonnerMessagesRecus,
  compterNonLus,
  filArrangeAvec,
  grouperEnConversations,
  type MessagePrive,
} from "./messagesPrives";

const MOI = "moi";
let echecs = 0;

function verifier(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`OK    ${nom}`);
    return;
  }
  echecs += 1;
  console.log(`ECHEC ${nom}${detail ? ` — ${detail}` : ""}`);
}

function message(partiel: Partial<MessagePrive> & { id: string }): MessagePrive {
  return {
    sender_id: MOI,
    recipient_id: "a",
    content: "coucou",
    created_at: "2026-08-25T10:00:00Z",
    read_at: null,
    ...partiel,
  };
}

// ---------- 1. Deux abonnements simultanés ----------
{
  let leve = "";
  let premier = () => {};
  let second = () => {};
  try {
    premier = abonnerMessagesRecus(MOI, () => {});
    second = abonnerMessagesRecus(MOI, () => {});
  } catch (erreur) {
    leve = (erreur as Error).message;
  }
  verifier(
    "deux abonnements simultanés ne font pas tomber la page",
    leve === "",
    leve,
  );
  premier();
  second();
}

// ---------- 2. Regroupement ----------
{
  const messages: MessagePrive[] = [
    // Du plus récent au plus ancien, comme la base les renvoie.
    message({ id: "5", sender_id: "b", recipient_id: MOI, created_at: "2026-08-25T12:00:00Z", read_at: null, content: "libre samedi ?" }),
    message({ id: "4", sender_id: "a", recipient_id: MOI, created_at: "2026-08-25T11:00:00Z", read_at: "2026-08-25T11:05:00Z", content: "bien vu" }),
    message({ id: "3", sender_id: MOI, recipient_id: "a", created_at: "2026-08-25T10:30:00Z", content: "j'ai mis Lens" }),
    message({ id: "2", sender_id: "b", recipient_id: MOI, created_at: "2026-08-25T09:00:00Z", read_at: null, content: "salut" }),
  ];

  const conversations = grouperEnConversations(messages, MOI);

  verifier("une conversation par interlocuteur", conversations.length === 2, `obtenu ${conversations.length}`);

  verifier(
    "celle qui a des non-lus passe devant",
    conversations[0]?.autreId === "b",
    `obtenu ${conversations[0]?.autreId}`,
  );

  verifier(
    "les non-lus sont comptés, pas devinés",
    conversations[0]?.nonLus === 2,
    `obtenu ${conversations[0]?.nonLus}`,
  );

  verifier(
    "mes propres envois ne comptent jamais comme non lus",
    conversations.find((c) => c.autreId === "a")?.nonLus === 0,
  );

  verifier(
    "le dernier message affiché est bien le plus récent",
    conversations[0]?.dernier?.id === "5",
    `obtenu ${conversations[0]?.dernier?.id}`,
  );

  verifier("total des non-lus", compterNonLus(messages, MOI) === 2);

  // ---------- 3. Le fil d'une conversation ----------
  const fil = filArrangeAvec(messages, MOI, "a");
  verifier("le fil ne contient que les échanges avec cette personne", fil.length === 2, `obtenu ${fil.length}`);
  verifier(
    "le fil est du plus ancien au plus récent",
    fil[0]?.id === "3" && fil[1]?.id === "4",
    `obtenu ${fil.map((m) => m.id).join(",")}`,
  );

  // La conversation d'un tiers ne doit jamais apparaitre ici. La base
  // l'empeche deja (voir la migration) ; on verifie que le tri non plus ne
  // melange pas deux fils.
  const avecInconnu = filArrangeAvec(messages, MOI, "z");
  verifier("aucun fil pour quelqu'un avec qui on n'a rien échangé", avecInconnu.length === 0);
}

console.log(echecs === 0 ? "\nTOUT PASSE" : `\n${echecs} ECHEC(S)`);
process.exit(echecs === 0 ? 0 : 1);
