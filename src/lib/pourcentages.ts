/**
 * Arrondis de pourcentages qui tombent juste.
 *
 * Partage par la repartition des choix bonus (4 championnats) et par la
 * repartition 1/N/2 de chaque match de Ligue 1.
 */

/**
 * ARRONDIS QUI TOMBENT JUSTE.
 *
 * Arrondir chaque part séparément donne facilement 99 % ou 101 % au total
 * (1 joueur sur 3, trois fois : 33 + 33 + 33 = 99). On répartit donc les
 * points entiers par la méthode du plus fort reste : chacun reçoit sa part
 * entière, puis les unités restantes vont aux plus gros restes. La somme
 * vaut exactement 100 dès qu'au moins un joueur a choisi.
 *
 * Un candidat que personne n'a pris reste à 0 % — il n'a aucun reste à faire
 * valoir, il ne peut donc jamais récupérer une unité au passage.
 */
export function repartirCent(comptes: Record<string, number>): Record<string, number> {
  const cles = Object.keys(comptes);
  const total = cles.reduce((somme, cle) => somme + (comptes[cle] ?? 0), 0);

  const pourcentages: Record<string, number> = {};
  if (total <= 0) {
    for (const cle of cles) pourcentages[cle] = 0;
    return pourcentages;
  }

  const restes: { cle: string; reste: number }[] = [];
  let attribue = 0;

  for (const cle of cles) {
    const exact = ((comptes[cle] ?? 0) * 100) / total;
    const entier = Math.floor(exact);
    pourcentages[cle] = entier;
    attribue += entier;
    restes.push({ cle, reste: exact - entier });
  }

  restes.sort((a, b) => b.reste - a.reste || a.cle.localeCompare(b.cle));

  for (let i = 0; attribue < 100 && i < restes.length; i += 1) {
    // Un candidat sans aucun choix a un reste nul : il ne prend jamais
    // d'unité (sinon un match que personne n'a pris afficherait 1 %).
    if (restes[i].reste <= 0) continue;
    pourcentages[restes[i].cle] += 1;
    attribue += 1;
  }

  return pourcentages;
}
