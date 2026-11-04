import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

/** Executável do Electron instalado no monorepo (o pacote `electron` exporta o caminho). */
export function caminhoDoElectron(): string {
  return require('electron') as unknown as string;
}

export const APP_DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
