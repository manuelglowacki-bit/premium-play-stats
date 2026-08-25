import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'
import { AuthProvider } from './context/AuthContext'

const router = createRouter({ routeTree })

// PWA — enregistrement du service worker existant (public/push-sw.js,
// jusqu'ici enregistré uniquement par PushNotificationsButton.tsx pour les
// notifications). Nécessaire indépendamment des notifications : Chrome
// exige un service worker actif comme critère d'installabilité. Même
// fichier réutilisé (pas de second service worker) — voir push-sw.js pour
// la portée stricte de son cache (assets statiques /assets/ uniquement).
// INSTALLATION SUR L'ECRAN D'ACCUEIL — capter l'invite du navigateur des le
// demarrage. Chrome emet `beforeinstallprompt` tres tot, bien avant que le
// composant qui propose l'installation ne soit monte : l'intro du site dure
// environ quatre secondes, l'evenement serait deja passe. On le retient donc
// ici, au premier instant, et le composant vient le chercher.
//
// preventDefault empeche le navigateur d'afficher SA banniere quand il le
// decide : l'installation est proposee dans le site, au moment choisi.
declare global {
  interface Window {
    inviteInstallation?: Event & { prompt: () => Promise<void> };
  }
}

window.addEventListener('beforeinstallprompt', (evenement) => {
  evenement.preventDefault();
  window.inviteInstallation = evenement as Window['inviteInstallation'];
  // Previent le composant s'il est deja monte.
  window.dispatchEvent(new CustomEvent('invite-installation-prete'));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/push-sw.js').catch(() => {
      // Non bloquant : l'app fonctionne normalement sans service worker
      // actif (juste sans installabilité PWA / notifications push).
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
    <RouterProvider router={router} />
</AuthProvider>
  </React.StrictMode>,
)

