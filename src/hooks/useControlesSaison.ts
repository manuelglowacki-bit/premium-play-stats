import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { avecCache } from "@/lib/cacheRequetes";
import {
  compterAlertes,
  controlerSaison,
  type Controle,
  type EntreeControles,
  type JoueurControle,
  type JourneeControle,
  type MatchControle,
  type OptionBonusControle,
  type PaiementControle,
} from "@/lib/controlesSaison";

/**
 * Les deux informations que la page Admin n'a pas déjà en mémoire : les
 * tirages bonus et la liste des joueurs joignables par notification. Mises en
 * cache cinq minutes — l'onglet Contrôles, l'onglet Suivi et la pastille les
 * demandent, une seule requête part.
 */
const DUREE = 5 * 60_000;

async function chargerOptionsBonus(): Promise<OptionBonusControle[] | null> {
  const { data, error } = await supabase
    .from("bonus_options")
    .select("matchday_id, match_id, is_active");

  if (error) return null;
  return (data ?? []) as OptionBonusControle[];
}

async function chargerJoignables(): Promise<string[] | null> {
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) return null;

  const reponse = await fetch("/api/emails-joueurs", {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton}` },
  });
  if (!reponse.ok) return null;

  const corps = await reponse.json().catch(() => ({}));
  return Array.isArray(corps?.avecNotifications) ? corps.avecNotifications.map(String) : null;
}

export function useControlesSaison(entree: {
  joueurs: JoueurControle[];
  journees: JourneeControle[];
  matchs: MatchControle[];
  paiements: PaiementControle[];
}): { controles: Controle[]; alertes: number; pret: boolean } {
  const [optionsBonus, setOptionsBonus] = useState<OptionBonusControle[] | null>(null);
  const [joignables, setJoignables] = useState<Set<string> | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let annule = false;

    (async () => {
      // `null` reste `null` : une donnée qu'on n'a pas pu lire fait TAIRE le
      // contrôle correspondant, elle ne le fait pas répondre à tort.
      const [bonus, ids] = await Promise.all([
        avecCache("controles|bonus_options", chargerOptionsBonus, DUREE).catch(() => null),
        avecCache("controles|joignables", chargerJoignables, DUREE).catch(() => null),
      ]);

      if (annule) return;
      setOptionsBonus(bonus);
      setJoignables(ids ? new Set(ids) : null);
      setPret(true);
    })();

    return () => {
      annule = true;
    };
  }, []);

  const controles = useMemo(() => {
    const parametres: EntreeControles = {
      joueurs: entree.joueurs,
      journees: entree.journees,
      matchs: entree.matchs,
      paiements: entree.paiements,
      optionsBonus,
      joignables,
    };
    return controlerSaison(parametres);
  }, [entree.joueurs, entree.journees, entree.matchs, entree.paiements, optionsBonus, joignables]);

  return { controles, alertes: compterAlertes(controles), pret };
}
