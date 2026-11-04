import type { ModeloTelas } from './tipos.js';

/** JSON estável: ordem de inserção já é determinística; campos indefinidos saem do arquivo. */
export function serializarModelo(m: ModeloTelas): string {
  return JSON.stringify(m, null, 2) + '\n';
}
