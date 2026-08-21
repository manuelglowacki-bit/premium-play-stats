// En-têtes CORS partagés par les Edge Functions appelées depuis le
// navigateur (via supabase.functions.invoke). Sans ça, le préflight
// OPTIONS envoyé par le navigateur échoue avant même d'atteindre la
// logique de la fonction.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
