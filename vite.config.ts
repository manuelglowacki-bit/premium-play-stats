import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// IDENTIFIANT DE VERSION
// ======================
// Ecrit dans le bundle (__BUILD_ID__) ET dans /version.json. L'application
// compare les deux au retour au premier plan : s'ils different, c'est qu'un
// nouveau deploiement est passe depuis l'ouverture de l'onglet, et un bandeau
// « Recharger » s'affiche. Voir src/lib/versionSite.ts.
//
// Sur Vercel, le SHA du commit identifie le deploiement sans ambiguite ; en
// local on retombe sur l'horodatage du build.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || String(Date.now());

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss(),
    {
      // Le fichier doit exister a la racine du site et ne JAMAIS etre mis en
      // cache : c'est lui la source de verite sur la version publiee. Il est
      // minuscule (une cinquantaine d'octets) et n'est lu qu'au retour au
      // premier plan, au plus une fois toutes les cinq minutes.
      name: 'version-publiee',
      apply: 'build' as const,
      generateBundle(this: { emitFile: (f: unknown) => void }) {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ version: BUILD_ID }),
        });
      },
    },
  ],

  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3210',
        changeOrigin: true,
      },
    },
  },
});
