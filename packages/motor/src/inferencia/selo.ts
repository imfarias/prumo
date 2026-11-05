import { normalizar } from '../util/texto.js';
import type { Campo } from '../modelo/tipos.js';

export type CorSelo = 'sucesso' | 'erro' | 'aviso' | 'neutro';
export const CORES_SELO: readonly CorSelo[] = ['sucesso', 'erro', 'aviso', 'neutro'];

// Os de erro vêm antes: "Não autorizada" contém "autoriz".
const GRUPOS: [CorSelo, RegExp][] = [
  ['erro', /\b(nao autoriz|nao aprov|inativ|reprov|indeferid|cancel|bloque|recusad|negad|suspens|vencid|expirad)/],
  ['aviso', /\b(aguard|analise|pendent|em andamento|em processamento|rascunho|parcial)/],
  ['sucesso', /\b(autoriz|ativ|aprov|conclu|deferid|finaliz|pag[oa]|valid|regular|habilitad)/],
];

/** Cor do selo pelo sentido do valor (RN-86). */
export function classificarSelo(valor: string): CorSelo {
  const v = normalizar(valor);
  return GRUPOS.find(([, re]) => re.test(v))?.[0] ?? 'neutro';
}

/** Coluna Situação/Status com valores de uma LOV (RN-86). */
export function colunaComSelo(c: Campo, opcoes = c.opcoes): boolean {
  return /\b(situacao|status)\b/.test(normalizar(c.nome)) && !!opcoes?.length;
}
