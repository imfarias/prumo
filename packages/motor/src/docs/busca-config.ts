/** Configuração do índice de busca, compartilhada pelo build (Node) e pelo navegador (web/). */

export function normalizarBusca(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export const OPCOES_INDICE = {
  idField: 'id',
  fields: ['titulo', 'texto', 'caminho', 'codigo'],
  storeFields: ['titulo', 'caminho', 'tipo', 'destino', 'texto', 'codigo'],
  processTerm: (t: string) => normalizarBusca(t),
  searchOptions: {
    boost: { titulo: 3, codigo: 5, caminho: 1.5 },
    prefix: true,
    fuzzy: (termo: string) => (termo.length >= 5 ? 0.2 : 0),
    combineWith: 'AND' as const,
  },
};

/** "RNG-06", "rng 6", "E-mail-1", "lov6" → chave normalizada ("RNG-06", "EMAIL-01"); outros textos → undefined. */
export function codigoDaConsulta(q: string): string | undefined {
  const m = /^\s*(rng|lov|msg|e-?mail)\s*-?\s*(\d{1,3})\s*$/i.exec(q);
  if (!m) return undefined;
  const tipo = /^e/i.test(m[1]!) ? 'EMAIL' : m[1]!.toUpperCase();
  return `${tipo}-${m[2]!.padStart(2, '0')}`;
}
