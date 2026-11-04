import path from 'node:path';
import { ErroPrumo } from './erros.js';

/** Caminho relativo com barras normais, para mensagens e para o modelo. */
export function relativoPosix(base: string, alvo: string): string {
  return path.relative(base, alvo).split(path.sep).join('/');
}

/** Garante que `alvo` fica dentro de `base`; o motor nunca escreve fora da pasta escolhida. */
export function dentroDe(base: string, alvo: string): string {
  const b = path.resolve(base);
  const a = path.resolve(alvo);
  const rel = path.relative(b, a);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new ErroPrumo('CAMINHO', `O caminho ${a} fica fora de ${b}; o Prumo não grava fora da pasta escolhida.`);
  }
  return a;
}
