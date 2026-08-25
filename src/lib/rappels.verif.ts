/**
 * RAPPELS DE PRONOSTICS — COHÉRENCE FENÊTRE / FRÉQUENCE
 * =====================================================
 * `npm run verif-rappels`
 *
 * Une tâche planifiée qui tourne moins souvent que sa fenêtre n'est large
 * laisse passer des matchs entre deux réveils. Personne n'est prévenu, et
 * RIEN ne le signale : pas d'erreur, pas de trace, juste des joueurs qui
 * n'ont pas reçu leur rappel.
 *
 * On simule donc le vrai cycle : la tâche se réveille toutes les N minutes,
 * et on vérifie que TOUT match, quelle que soit sa minute de coup d'envoi,
 * tombe dans la fenêtre d'au moins un réveil.
 */

import {
  DEMI_FENETRE_MINUTES,
  INTERVALLE_CRON_MINUTES,
  targetWindow,
} from "../../supabase/functions/_shared/fenetreRappel";

let echecs = 0;
function verifier(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`OK    ${nom}`);
    return;
  }
  echecs += 1;
  console.log(`ECHEC ${nom}${detail ? ` — ${detail}` : ""}`);
}

const MINUTE = 60_000;

// ---------- 1. La règle de base ----------
verifier(
  "la fenêtre est plus large que l'intervalle du cron",
  DEMI_FENETRE_MINUTES * 2 > INTERVALLE_CRON_MINUTES,
  `fenêtre ${DEMI_FENETRE_MINUTES * 2} min, cron toutes les ${INTERVALLE_CRON_MINUTES} min`,
);

// ---------- 2. Aucun match ne passe entre deux réveils ----------
{
  // Un coup d'envoi possible à chaque minute d'une journée entière.
  const depart = new Date("2026-08-28T00:00:00Z").getTime();
  const reveils: number[] = [];
  for (let m = 0; m < 24 * 60; m += INTERVALLE_CRON_MINUTES) {
    reveils.push(depart + m * MINUTE);
  }

  let rates = 0;
  let minRepetitions = Infinity;
  let premierRate: string | null = null;

  for (let m = 0; m < 24 * 60; m += 1) {
    const coupDEnvoi = depart + m * MINUTE;
    let vu = 0;
    reveils.forEach((instant) => {
      const { from, to } = targetWindow(new Date(instant));
      if (coupDEnvoi >= from.getTime() && coupDEnvoi <= to.getTime()) vu += 1;
    });
    // On ne compte que les coups d'envoi qu'un reveil de la journee pouvait
    // atteindre : ceux de la premiere heure sont vises par la veille.
    if (coupDEnvoi < depart + 61 * MINUTE) continue;
    if (vu === 0) {
      rates += 1;
      if (!premierRate) premierRate = new Date(coupDEnvoi).toISOString();
    }
    minRepetitions = Math.min(minRepetitions, vu);
  }

  verifier(
    "aucun coup d'envoi ne passe entre deux réveils",
    rates === 0,
    rates ? `${rates} rates, premier a ${premierRate}` : "",
  );
  verifier(
    "chaque match est vu au moins deux fois (marge de sécurité)",
    minRepetitions >= 2,
    `minimum observé : ${minRepetitions}`,
  );
}

// ---------- 3. Le rappel reste proche d'une heure avant ----------
{
  const maintenant = new Date("2026-08-28T17:00:00Z");
  const { from, to } = targetWindow(maintenant);
  const avanceMax = (to.getTime() - maintenant.getTime()) / MINUTE;
  const avanceMin = (from.getTime() - maintenant.getTime()) / MINUTE;
  verifier(
    "le rappel part entre 50 et 70 minutes avant le coup d'envoi",
    avanceMin >= 45 && avanceMax <= 75,
    `${avanceMin} à ${avanceMax} minutes`,
  );
}

// ---------- 4. Ce que ça économise ----------
{
  const avant = (24 * 60 * 30);
  const apres = (24 * 60 / INTERVALLE_CRON_MINUTES) * 30;
  console.log(
    `\nRéveils par mois : ${avant.toLocaleString("fr-FR")} avant → ${apres.toLocaleString("fr-FR")} maintenant ` +
      `(${Math.round((1 - apres / avant) * 100)} % de moins)`,
  );
}

console.log(echecs === 0 ? "\nTOUT PASSE" : `\n${echecs} ECHEC(S)`);
process.exit(echecs === 0 ? 0 : 1);
