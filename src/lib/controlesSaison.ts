/**
 * CONTRÔLES DE LA SAISON — ce qui cloche, avant qu'un joueur ne le signale
 *
 * Tous les vrais problèmes rencontrés cette saison avaient un point commun :
 * ils étaient INVISIBLES depuis l'Admin. Un résultat non synchronisé, une
 * journée sans date limite, un bonus jamais publié — rien ne clignotait, et
 * on l'apprenait par un joueur qui trouvait ses points bizarres.
 *
 * Ce module ne fait que du calcul, sur des données déjà chargées par la page
 * Admin : aucune requête supplémentaire.
 *
 * RÈGLE DE CONCEPTION : on ne signale que ce sur quoi l'admin peut AGIR
 * MAINTENANT. Une journée passée sans date limite est regrettable mais close ;
 * l'afficher noierait les alertes qui comptent. De même, un contrôle dont la
 * donnée n'est pas disponible (notifications, options bonus) est SILENCIEUX
 * plutôt qu'alarmiste : ne pas savoir n'est pas une anomalie.
 */

export type Gravite = "critique" | "attention" | "info";

export type Controle = {
  id: string;
  gravite: Gravite;
  titre: string;
  /** Pourquoi ça compte — la conséquence concrète, pas la description. */
  consequence: string;
  /** Ce qu'il y a à faire. */
  quoiFaire: string;
  /** Onglet Admin où corriger, quand il y en a un. */
  onglet: string | null;
  /** Les éléments concernés, nommés. */
  elements: string[];
};

export type JourneeControle = {
  id: string;
  number: number;
  deadline?: string | null;
  deadline_mode?: "manual" | "auto_minus_1" | null;
};

export type MatchControle = {
  id: string;
  matchday_id?: string | null;
  kickoff?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  home_score?: number | null;
  away_score?: number | null;
};

export type JoueurControle = {
  id: string;
  pseudo?: string | null;
  favorite_team_id?: string | null;
};

export type PaiementControle = {
  user_id: string;
  paid: boolean;
  amount?: number | null;
};

export type OptionBonusControle = {
  matchday_id: string;
  match_id: string;
  is_active?: boolean | null;
};

export type EntreeControles = {
  joueurs: JoueurControle[];
  journees: JourneeControle[];
  matchs: MatchControle[];
  /** `null` = pas encore chargé : le contrôle du bonus est alors sauté. */
  optionsBonus: OptionBonusControle[] | null;
  paiements: PaiementControle[];
  /** `null` = information indisponible : le contrôle Push est alors sauté. */
  joignables: Set<string> | null;
  maintenant?: number;
};

/**
 * Délai après le coup d'envoi au-delà duquel un score manquant devient
 * anormal. Un match dure 105 minutes prolongations comprises ; trois heures
 * laissent de la marge à la synchronisation sans laisser passer un oubli.
 */
export const DELAI_RESULTAT_MS = 3 * 60 * 60_000;

function instant(valeur: string | null | undefined): number | null {
  if (!valeur) return null;
  const t = new Date(valeur).getTime();
  return Number.isFinite(t) ? t : null;
}

function nomJoueur(joueur: JoueurControle): string {
  const pseudo = (joueur.pseudo ?? "").trim();
  return pseudo === "" ? "Sans pseudo" : pseudo;
}

function nomMatch(match: MatchControle): string {
  const domicile = (match.home_team ?? "").trim() || "?";
  const exterieur = (match.away_team ?? "").trim() || "?";
  return `${domicile} – ${exterieur}`;
}

function parOrdreAlphabetique(a: string, b: string): number {
  return a.localeCompare(b, "fr");
}

export function controlerSaison(entree: EntreeControles): Controle[] {
  const maintenant = entree.maintenant ?? Date.now();
  const controles: Controle[] = [];

  const journeeParId = new Map(entree.journees.map((j) => [String(j.id), j]));

  // Un match « utilisé » est rattaché à une journée de Ligue 1, ou proposé
  // comme bonus. Les autres rencontres présentes en base (les championnats
  // étrangers dans leur intégralité) ne concernent personne : les signaler
  // noierait la liste sous des centaines de lignes sans objet.
  const idsBonus = new Set((entree.optionsBonus ?? []).map((o) => String(o.match_id)));
  const matchsUtilises = entree.matchs.filter(
    (m) => (m.matchday_id != null && m.matchday_id !== "") || idsBonus.has(String(m.id)),
  );

  // ---------- 1. Résultats manquants ----------
  const sansResultat = matchsUtilises
    .filter((match) => {
      const coupDEnvoi = instant(match.kickoff);
      if (coupDEnvoi === null) return false;
      if (maintenant - coupDEnvoi < DELAI_RESULTAT_MS) return false;
      return match.home_score == null || match.away_score == null;
    })
    .sort((a, b) => (instant(a.kickoff) ?? 0) - (instant(b.kickoff) ?? 0));

  if (sansResultat.length > 0) {
    controles.push({
      id: "resultats-manquants",
      gravite: "critique",
      titre: `${sansResultat.length} match${sansResultat.length > 1 ? "s" : ""} joué${
        sansResultat.length > 1 ? "s" : ""
      } sans score enregistré`,
      consequence:
        "Ces rencontres ne rapportent aucun point à personne. Le classement est faux tant qu'elles restent vides.",
      quoiFaire: "Synchronise les matchs, ou saisis le score à la main.",
      onglet: "matchs",
      elements: sansResultat.map((match) => {
        const journee = match.matchday_id ? journeeParId.get(String(match.matchday_id)) : undefined;
        return journee ? `J${journee.number} · ${nomMatch(match)}` : `Bonus · ${nomMatch(match)}`;
      }),
    });
  }

  // ---------- 2. Journées qui ne se verrouilleront jamais ----------
  // En mode manuel sans date limite, dateVerrouillage (journeeCourante.ts)
  // renvoie null, donc isMatchLocked vaut toujours false : la saisie reste
  // ouverte APRÈS le coup d'envoi. Sur un championnat qui met de l'argent en
  // jeu, c'est le trou le plus grave de la liste.
  const sansVerrou = entree.journees
    .filter((journee) => {
      const mode = journee.deadline_mode ?? "manual";
      if (mode === "auto_minus_1") return false;
      if (instant(journee.deadline) !== null) return false;

      // Seules les journées encore à jouer sont corrigeables.
      return entree.matchs.some((match) => {
        if (String(match.matchday_id ?? "") !== String(journee.id)) return false;
        const coupDEnvoi = instant(match.kickoff);
        return coupDEnvoi !== null && coupDEnvoi > maintenant;
      });
    })
    .sort((a, b) => a.number - b.number);

  if (sansVerrou.length > 0) {
    controles.push({
      id: "journees-sans-verrou",
      gravite: "critique",
      titre: `${sansVerrou.length} journée${sansVerrou.length > 1 ? "s" : ""} sans date limite`,
      consequence:
        "En mode manuel sans date, les pronostics ne se ferment jamais : un joueur peut encore jouer après le coup d'envoi.",
      quoiFaire: "Passe la journée en fermeture automatique, ou fixe une date limite.",
      onglet: "verrouillage",
      elements: sansVerrou.map((journee) => `Journée ${journee.number}`),
    });
  }

  // ---------- 3. Bonus non publié ----------
  if (entree.optionsBonus !== null) {
    const journeesAvecBonus = new Set(
      entree.optionsBonus
        .filter((option) => option.is_active !== false)
        .map((option) => String(option.matchday_id)),
    );

    const sansBonus = entree.journees
      .filter((journee) => {
        if (journeesAvecBonus.has(String(journee.id))) return false;
        return entree.matchs.some((match) => {
          if (String(match.matchday_id ?? "") !== String(journee.id)) return false;
          const coupDEnvoi = instant(match.kickoff);
          return coupDEnvoi !== null && coupDEnvoi > maintenant;
        });
      })
      .sort((a, b) => a.number - b.number);

    if (sansBonus.length > 0) {
      controles.push({
        id: "bonus-manquant",
        gravite: "attention",
        titre: `${sansBonus.length} journée${sansBonus.length > 1 ? "s" : ""} à venir sans match bonus`,
        consequence:
          "Personne ne peut choisir de bonus sur ces journées : c'est jusqu'à 3 points en moins pour tout le monde.",
        quoiFaire: "Publie une sélection bonus pour chacune.",
        onglet: "bonus",
        elements: sansBonus.map((journee) => `Journée ${journee.number}`),
      });
    }
  }

  // ---------- 4. Équipe de cœur non choisie ----------
  const sansFavori = entree.joueurs
    .filter((joueur) => !joueur.favorite_team_id)
    .map(nomJoueur)
    .sort(parOrdreAlphabetique);

  if (sansFavori.length > 0) {
    controles.push({
      id: "sans-equipe-coeur",
      gravite: "attention",
      titre: `${sansFavori.length} joueur${sansFavori.length > 1 ? "s" : ""} sans équipe de cœur`,
      consequence:
        "Leur match club de cœur ne leur rapporte rien : ils jouent la saison avec un handicap permanent.",
      quoiFaire: "Préviens-les, ou renseigne l'équipe depuis l'onglet Joueurs.",
      onglet: "joueurs",
      elements: sansFavori,
    });
  }

  // ---------- 5. Rappels qui n'arrivent nulle part ----------
  if (entree.joignables !== null) {
    const joignables = entree.joignables;
    const injoignables = entree.joueurs
      .filter((joueur) => !joignables.has(String(joueur.id)))
      .map(nomJoueur)
      .sort(parOrdreAlphabetique);

    if (injoignables.length > 0) {
      controles.push({
        id: "sans-notifications",
        gravite: "info",
        titre: `${injoignables.length} joueur${
          injoignables.length > 1 ? "s ne reçoivent" : " ne reçoit"
        } aucune notification`,
        consequence:
          "Tes rappels ne leur parviennent pas. Tu peux relancer dix fois, ils ne verront rien.",
        quoiFaire:
          "Demande-leur d'activer les notifications depuis leur profil, ou relance-les par message.",
        onglet: "suivi",
        elements: injoignables,
      });
    }
  }

  // ---------- 6. Paiements en attente ----------
  const impayes = entree.paiements.filter((paiement) => !paiement.paid);
  if (impayes.length > 0) {
    const nomParId = new Map(
      entree.joueurs.map((joueur) => [String(joueur.id), nomJoueur(joueur)]),
    );
    const total = impayes.reduce((somme, paiement) => somme + (Number(paiement.amount) || 0), 0);

    controles.push({
      id: "paiements-en-attente",
      gravite: "info",
      titre: `${impayes.length} paiement${impayes.length > 1 ? "s" : ""} en attente${
        total > 0 ? ` · ${total} €` : ""
      }`,
      consequence: "Le pot annoncé aux joueurs n'est pas encore réuni.",
      quoiFaire: "Relance les retardataires depuis l'onglet Paiements.",
      onglet: "paiements",
      elements: impayes
        .map((paiement) => nomParId.get(String(paiement.user_id)) ?? "Joueur inconnu")
        .sort(parOrdreAlphabetique),
    });
  }

  return controles;
}

/** Combien d'alertes méritent la pastille rouge de l'onglet. */
export function compterAlertes(controles: Controle[]): number {
  return controles.filter((controle) => controle.gravite !== "info").length;
}
