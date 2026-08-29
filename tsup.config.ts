import { unlinkPlugin, postBuildProcessing } from '@logitech/plugin-toolkit';
import { esmShimPlugin } from '@logitech/plugin-toolkit/esbuild';
import { cpSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'tsup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const isWatchEnabled = process.argv.includes('--watch') || process.argv.includes('-w');

export default defineConfig({
  entry: ['index.ts'],
  format: ['esm'],
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  // On preserve dist/node_modules : le binaire natif de koffi est verrouille par
  // le plugin tant qu'il tourne, et le supprimer ferait echouer tout rebuild.
  clean: ['**/*', '!node_modules', '!node_modules/**'],
  bundle: true,
  platform: 'node',
  target: 'es2022',
  // Tout est empaquete dans index.mjs, sauf koffi : il charge un binaire natif
  // (.node) qui ne peut pas etre inline. Il est recopie dans dist ci-dessous.
  external: ['koffi'],
  noExternal: [/^(?!koffi$)/],
  minify: isProduction,
  sourcemap: !isProduction,
  onSuccess: async () => {
    console.log('✅ TS build completed.');
    await postBuildProcessing(__dirname, isWatchEnabled);
    copyNativeDependencies();

    if (isWatchEnabled) {
      console.log('👀 Watching for file changes... Press Ctrl+C to stop.');
    }
  },
  watch: isWatchEnabled,
  shims: true,
  esbuildPlugins: [
    esmShimPlugin({ require: true })
  ]
});

if (isWatchEnabled) {
  // Handle graceful shutdown
  const cleanup = async () => {
    try {
      console.log('🛑 Stopping watch mode...');
      console.log('🔓 Unlinking plugin...');
      await unlinkPlugin(true);
    } catch (error) {
      console.warn('⚠️ Failed to unlink plugin:', (error as Error).message);
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/**
 * Recopie koffi et son binaire natif dans `dist/node_modules`.
 *
 * `logitoolkit pack` empaquete `dist` tel quel : koffi doit s'y trouver, sinon le
 * plugin ne demarre pas.
 *
 * La copie ne remplace jamais un fichier existant (`force: false`) : le binaire
 * natif reste verrouille par le plugin tant qu'il tourne, et vouloir l'ecraser
 * ferait echouer le build. Apres une mise a jour de koffi, arreter le Logi
 * Plugin Service puis supprimer `dist/node_modules` a la main.
 */
function copyNativeDependencies() {
  const packages = ['koffi', join('@koromix', 'koffi-win32-x64')];

  for (const name of packages) {
    cpSync(join(__dirname, 'node_modules', name), join(__dirname, 'dist', 'node_modules', name), {
      recursive: true,
      force: false,
    });
  }

  console.log('📦 koffi et son binaire natif copies dans dist/node_modules');
}
