/**
 * Répartition de la cagnotte en fin de saison : 50 / 30 / 20, arrondie à la
 * dizaine supérieure pour les deux premiers. Le troisième reçoit le solde,
 * de sorte que la somme des trois lots égale EXACTEMENT la cagnotte — un
 * arrondi sur les trois ferait apparaître ou disparaître quelques euros.
 *
 * Extrait de classement.tsx pour que l'Accueil affiche les mêmes montants :
 * deux calculs séparés auraient fini par diverger au premier ajustement.
 */
export function computePrizeByRank(prizePool: number): Record<number, number> {
  if (!Number.isFinite(prizePool) || prizePool <= 0) {
    return { 1: 0, 2: 0, 3: 0 };
  }

  const roundUpToTen = (value: number) => Math.ceil(value / 10) * 10;
  const first = roundUpToTen(prizePool * 0.5);
  const second = roundUpToTen(prizePool * 0.3);
  const third = Math.max(0, prizePool - first - second);

  return { 1: first, 2: second, 3: third };
}
