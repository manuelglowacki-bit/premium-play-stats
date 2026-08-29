/**
 * QUI DÉCLENCHE UNE FONCTION : la tâche programmée, ou un humain ?
 *
 * Une tâche pg_cron n'a aucune session utilisateur. Elle prouve son identité
 * avec un secret partagé, envoyé dans l'en-tête `x-cron-secret`. Tout ce qui
 * n'est pas reconnu comme tel doit repasser par la vérification admin
 * habituelle.
 *
 * LE PIÈGE, et c'est pour lui que cette décision est isolée ici :
 * si le secret n'est pas configuré côté serveur, une comparaison naïve
 * `recu === configure` compare deux chaînes vides et répond VRAI. Un projet
 * mal configuré accepterait alors n'importe quel appel anonyme comme venant
 * du cron. D'où l'exigence que le secret soit réellement renseigné.
 *
 * Vérifié par npm run verif-cron.
 */
export function estAppelCron(
  secretConfigure: string | null | undefined,
  secretRecu: string | null | undefined,
): boolean {
  if (typeof secretConfigure !== "string" || secretConfigure === "") return false;
  if (typeof secretRecu !== "string" || secretRecu === "") return false;
  return secretRecu === secretConfigure;
}
