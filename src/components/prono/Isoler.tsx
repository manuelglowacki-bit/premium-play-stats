/**
 * ISOLER
 * ======
 * Une barrière : si le composant à l'intérieur tombe, il tombe seul.
 *
 * Écrit après un incident réel. Les messages privés levaient une erreur à
 * l'ouverture, et c'est TOUT le Vestiaire qui basculait sur « Something went
 * wrong » — chat commun compris, alors qu'il n'avait rien à voir. React se
 * comporte ainsi par défaut : une erreur non rattrapée pendant le rendu
 * démonte tout l'arbre au-dessus d'elle.
 *
 * La cause de cet incident-là est corrigée. Cette barrière ne la remplace pas :
 * elle limite ce que coûtera la prochaine. Une fonctionnalité annexe qui échoue
 * doit afficher son propre message d'erreur, à sa place, et laisser le reste
 * de la page utilisable.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Nommé dans le message affiché : « Les messages privés n'ont pas pu... ». */
  nom: string;
  /** Proposé au joueur pour sortir de l'écran en échec (fermer le panneau). */
  onFermer?: () => void;
};

type State = { erreur: Error | null };

export class Isoler extends Component<Props, State> {
  state: State = { erreur: null };

  static getDerivedStateFromError(erreur: Error): State {
    return { erreur };
  }

  componentDidCatch(erreur: Error, infos: ErrorInfo) {
    // Trace complète dans la console pour le diagnostic — le joueur, lui, ne
    // voit que le message lisible ci-dessous.
    console.error(`[${this.props.nom}] a échoué :`, erreur, infos.componentStack);
  }

  render() {
    if (!this.state.erreur) return this.props.children;

    return (
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#050c16] px-6 text-center">
        <p className="font-display text-base font-black text-white">
          {this.props.nom} n'a pas pu s'ouvrir.
        </p>
        <p className="max-w-xs text-sm text-slate-400">
          Le reste du Vestiaire fonctionne normalement. Réessaie plus tard, ou
          signale-le si ça se reproduit.
        </p>

        {/* Le detail exact, replie : illisible pour la plupart des joueurs,
            mais c'est ce qui permet de diagnostiquer sans avoir a reproduire. */}
        <details className="max-w-full">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-slate-600">
            Détail technique
          </summary>
          <p className="mt-2 max-h-32 overflow-auto break-words rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left font-mono text-[10px] text-red-300">
            {this.state.erreur.message}
          </p>
        </details>

        {this.props.onFermer && (
          <button
            type="button"
            onClick={this.props.onFermer}
            className="mt-1 rounded-xl border border-white/10 bg-white/[.05] px-4 py-2 text-xs font-bold text-slate-200 transition hover:text-white"
          >
            Revenir au Vestiaire
          </button>
        )}
      </div>
    );
  }
}
