import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Recursos do motor (kits, fontes, axe). Em desenvolvimento e na CLI vêm do pacote; no programa de computador,
 * empacotado sem node_modules, vêm de PRUMO_RECURSOS (pasta com kits/, fontes/ e axe.min.js).
 */
const require = createRequire(import.meta.url);
const PACOTE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function raizRecursos(): string | undefined {
  return process.env.PRUMO_RECURSOS || undefined;
}

export function diretorioKits(): string {
  const r = raizRecursos();
  return r ? path.join(r, 'kits') : path.join(PACOTE, 'kits');
}

export function arquivoFonte(pacote: string, nome: string): string {
  const r = raizRecursos();
  return r ? path.join(r, 'fontes', nome) : path.join(path.dirname(require.resolve(`${pacote}/package.json`)), 'files', nome);
}

export function arquivoAxe(): string {
  const r = raizRecursos();
  return r ? path.join(r, 'axe.min.js') : require.resolve('axe-core/axe.min.js');
}
