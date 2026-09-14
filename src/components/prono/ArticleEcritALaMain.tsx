import { morceaux } from "@/lib/recitDebrief";
import { titreDeUne, type BlocArticle } from "@/lib/articleManuel";

/**
 * L'ARTICLE ECRIT PAR L'ORGANISATEUR.
 *
 * Il l'a colle dans Admin ; on le transcrit ici avec l'allure du reste du
 * site. Aucune phrase n'est reecrite, aucun chiffre n'est verifie : c'est
 * son texte, affiche tel qu'il l'a ecrit. La seule chose qu'on ajoute est la
 * mise en page — titres, listes, tableaux, mises en exergue.
 *
 * Le gras `**...**` passe par `morceaux()`, la meme fonction que le texte
 * calcule : une seule facon de mettre un chiffre en avant sur cette page.
 */
export function ArticleEcritALaMain({
  blocs,
  journee,
  compact = false,
}: {
  blocs: BlocArticle[];
  journee: number | null;
  /** Apercu dans l'Admin : meme rendu, dans une boite plus etroite. */
  compact?: boolean;
}) {
  const une = titreDeUne(blocs);
  // Le titre de une est deja affiche en en-tete : on ne le repete pas dans
  // le corps de l'article.
  const premierTitre = blocs.findIndex((b) => b.type === "titre");
  const corps = une && premierTitre >= 0 ? blocs.filter((_, i) => i !== premierTitre) : blocs;

  const enGras = (texte: string, couleur: string) =>
    morceaux(texte).map((bout, i) =>
      bout.accent ? (
        <strong key={i} className={`font-black ${couleur}`}>
          {bout.texte}
        </strong>
      ) : (
        <span key={i}>{bout.texte}</span>
      ),
    );

  return (
    <>
      {une && (
        <section className={`relative overflow-hidden border-b border-slate-800 bg-gradient-to-br from-emerald-500/[.10] via-transparent to-fuchsia-500/[.06] ${compact ? "px-4 py-5" : "px-5 py-9 md:px-10 md:py-12"}`}>
          {journee ? (
            <p className="font-mono text-[10px] font-black uppercase tracking-[.24em] text-emerald-300">
              Journée {journee}
            </p>
          ) : null}
          <h2 className={`mt-2 max-w-[24ch] font-display font-black uppercase leading-[1] tracking-[-.03em] text-white ${compact ? "text-lg" : "mt-3 text-[1.75rem] md:text-[3rem]"}`}>
            {une.emoji && (
              <span className="mr-2" aria-hidden>
                {une.emoji}
              </span>
            )}
            {une.texte}
          </h2>
        </section>
      )}

      <section className={compact ? "px-4 py-5" : "px-5 py-8 md:px-10 md:py-10"}>
        <div className="max-w-[68ch] space-y-4">
          {corps.map((bloc, index) => {
            if (bloc.type === "separateur") {
              return <hr key={index} className="!my-7 border-slate-800" />;
            }

            if (bloc.type === "titre") {
              return (
                <div key={index} className="!mt-8 flex items-center gap-2.5 first:!mt-0">
                  {bloc.emoji && (
                    <span className="text-2xl leading-none md:text-3xl" aria-hidden>
                      {bloc.emoji}
                    </span>
                  )}
                  <h3 className="min-w-0 font-display text-xl font-black uppercase tracking-[-.02em] text-white md:text-2xl">
                    {bloc.texte}
                  </h3>
                </div>
              );
            }

            if (bloc.type === "citation") {
              return (
                <blockquote
                  key={index}
                  className="rounded-2xl border-l-2 border-amber-400/60 bg-amber-400/[.06] px-4 py-3 text-[15px] font-semibold leading-[1.7] text-amber-100 md:text-base"
                >
                  {enGras(bloc.texte, "text-amber-300")}
                </blockquote>
              );
            }

            if (bloc.type === "liste") {
              return (
                <ul key={index} className="space-y-1.5">
                  {bloc.elements.map((element, i) => (
                    <li
                      key={i}
                      className="flex min-w-0 gap-2.5 text-[15px] leading-[1.7] text-slate-300 md:text-base"
                    >
                      <span className="mt-[.45em] size-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                      <span className="min-w-0">{enGras(element, "text-emerald-300")}</span>
                    </li>
                  ))}
                </ul>
              );
            }

            if (bloc.type === "tableau") {
              return (
                // Un tableau peut etre plus large que l'ecran : il defile
                // dans sa propre boite, jamais la page entiere.
                <div key={index} className="-mx-1 overflow-x-auto">
                  <table className="w-full min-w-[18rem] border-collapse text-left">
                    <tbody>
                      {bloc.lignes.map((ligne, i) => (
                        <tr
                          key={i}
                          className={i === 0 ? "border-b border-slate-700" : "border-b border-slate-800/60"}
                        >
                          {ligne.map((cellule, j) => (
                            <td
                              key={j}
                              className={`px-2.5 py-2 align-middle ${
                                i === 0
                                  ? "font-mono text-[9px] font-black uppercase tracking-[.14em] text-slate-500"
                                  : `text-sm ${j === 0 ? "font-black text-white" : "text-slate-300"}`
                              }`}
                            >
                              {enGras(cellule, "text-emerald-300")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            return (
              <p
                key={index}
                // `whitespace-pre-line` : les retours a la ligne de l'auteur
                // sont conserves — c'est ainsi qu'il aligne un parcours.
                className="whitespace-pre-line text-[15px] leading-[1.75] text-slate-300 md:text-base"
              >
                {enGras(bloc.texte, "text-emerald-300")}
              </p>
            );
          })}
        </div>
      </section>
    </>
  );
}

