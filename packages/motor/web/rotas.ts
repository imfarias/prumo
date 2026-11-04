/** Rotas aceitas no fragmento (RN-51): formatos do Pirilampo e os novos. */
export type Rota =
  | { tipo: 'f'; endereco: string; posicao?: number; termo?: string }
  | { tipo: 'busca'; termo: string }
  | { tipo: 'matriz' }
  | { tipo: 'mudancas' }
  | { tipo: 'inicio' };

const dec = (t: string) => {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
};

export function interpretar(hash: string): Rota | undefined {
  const h = hash.replace(/^#/, '');
  if (h === '' || h === '!' || h === '!/' || h === '/') return { tipo: 'inicio' };
  let m = /^!?\/(scenario|feature|f)\/([^/]+)(?:\/(?:c\/)?([^/]*))?\/?$/.exec(h);
  if (m) {
    const endereco = dec(m[2]!).normalize('NFC');
    const resto = m[3] === undefined ? undefined : dec(m[3]);
    if (m[1] === 'feature') return { tipo: 'f', endereco, termo: resto || undefined };
    const n = resto === undefined || resto === '' ? NaN : Number(resto);
    return { tipo: 'f', endereco, posicao: Number.isInteger(n) ? n : undefined };
  }
  m = /^!\/busca\/(.*)$/.exec(h);
  if (m) return { tipo: 'busca', termo: dec(m[1]!) };
  if (/^!\/matriz\/?$/.test(h)) return { tipo: 'matriz' };
  if (/^!\/mudancas\/?$/.test(h)) return { tipo: 'mudancas' };
  return undefined; // âncora comum (#c-3) ou desconhecida
}

export interface MapaRotas {
  [endereco: string]: { arquivo: string; filhos: number[] };
}

/** Acha o endereço no mapa: exato (NFC) ou ignorando caixa. */
export function resolver(endereco: string, mapa: MapaRotas): string | undefined {
  const e = endereco.normalize('NFC');
  if (mapa[e]) return e;
  const baixo = e.toLowerCase();
  return Object.keys(mapa).find((k) => k.toLowerCase() === baixo);
}

/** Sugestão para endereço inexistente: o de maior prefixo em comum. */
export function sugerir(endereco: string, mapa: MapaRotas): string | undefined {
  const e = endereco.normalize('NFC').toLowerCase();
  let melhor: string | undefined;
  let tam = 0;
  for (const k of Object.keys(mapa)) {
    const kk = k.toLowerCase();
    let i = 0;
    while (i < e.length && i < kk.length && e[i] === kk[i]) i++;
    if (i > tam) {
      tam = i;
      melhor = k;
    }
  }
  return tam >= 6 ? melhor : undefined;
}
