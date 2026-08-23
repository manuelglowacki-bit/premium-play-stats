import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // `vite dev` seul ne sait pas exécuter le dossier api/ (fonctions
      // Vercel) : sans ce proxy, un fetch("/api/...") est traité comme une
      // requête de fichier source et Vite renvoie le code TS transpilé de
      // la route en 200 (Content-Type text/javascript), que le client
      // essaie ensuite de parser comme du JSON — d'où des erreurs du type
      // "réponse invalide (200)" alors que la requête a bien abouti.
      // Lancer `npm run dev:api` (vercel dev --listen 3210) en parallèle
      // pour que /api/* fonctionne en local ; en prod sur Vercel le
      // routing est natif, ce proxy ne sert qu'au dev.
      '/api': {
        target: 'http://localhost:3210',
        changeOrigin: true,
      },
    },
  },
});
