/**
 * EXPORT DU CLASSEMENT — un tableau à garder, à imprimer, à envoyer
 *
 * Sert au moment qui compte : la remise des gains. Un classement affiché à
 * l'écran ne prouve rien six mois plus tard ; un fichier daté, si. Et pour le
 * groupe du travail, où les récompenses sont des lots, il faudra pouvoir
 * montrer noir sur blanc qui termine où.
 *
 * Format CSV, ouvrable dans Excel, LibreOffice, Google Sheets ou Numbers.
 */

export type LigneClassement = {
  rang: number;
  pseudo: string | null;
  points: number;
  scoresExacts: number;
  pronosticsJoues: number;
  pronosticsAttendus: number;
  equipeCoeur?: string | null;
};

/**
 * SÉPARATEUR POINT-VIRGULE, et non la virgule.
 *
 * Excel en configuration française lit un fichier .csv en attendant le
 * point-virgule : avec des virgules, toutes les colonnes atterrissent dans la
 * première case et le fichier semble cassé. C'est la configuration de la
 * quasi-totalité des gens à qui ce fichier sera envoyé.
 */
export const SEPARATEUR = ";";

/**
 * Marque d'ordre des octets. Sans elle, Excel lit le fichier en ANSI et
 * affiche « JournÃ©e » au lieu de « Journée ». Trois octets qui évitent une
 * question à chaque envoi.
 */
export const BOM = "﻿";

const COLONNES = [
  "Rang",
  "Joueur",
  "Points",
  "Scores exacts",
  "Pronostics joués",
  "Pronostics possibles",
  "Participation",
  "Équipe de cœur",
];

/**
 * Échappe une valeur pour le CSV.
 *
 * Un pseudo peut contenir n'importe quoi — un point-virgule, un guillemet, un
 * retour à la ligne collé depuis un téléphone. Sans échappement, une seule de
 * ces valeurs décale toutes les colonnes de la ligne, et le fichier devient
 * faux sans prévenir.
 */
export function echapper(valeur: unknown): string {
  const texte = valeur === null || valeur === undefined ? "" : String(valeur);
  if (!/[";\n\r]/.test(texte)) return texte;
  return `"${texte.replace(/"/g, '""')}"`;
}

function pourcentage(joues: number, attendus: number): string {
  if (attendus <= 0) return "";
  return `${Math.round((joues / attendus) * 100)}%`;
}

export function versCSV(lignes: LigneClassement[]): string {
  const entete = COLONNES.join(SEPARATEUR);

  const corps = lignes.map((ligne) =>
    [
      ligne.rang,
      (ligne.pseudo ?? "").trim() || "Sans pseudo",
      ligne.points,
      ligne.scoresExacts,
      ligne.pronosticsJoues,
      ligne.pronosticsAttendus,
      pourcentage(ligne.pronosticsJoues, ligne.pronosticsAttendus),
      ligne.equipeCoeur ?? "",
    ]
      .map(echapper)
      .join(SEPARATEUR),
  );

  // Fins de ligne Windows : c'est ce qu'attendent Excel et la majorite des
  // tableurs pour un CSV, et aucun autre outil n'en souffre.
  return BOM + [entete, ...corps].join("\r\n") + "\r\n";
}

/** `classement-prono-ligue-1-2026-08-28.csv` */
export function nomFichier(saison: string | null | undefined, date: Date = new Date()): string {
  const jour = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  const etiquette = (saison ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return etiquette === "" ? `classement-${jour}.csv` : `classement-${etiquette}-${jour}.csv`;
}
