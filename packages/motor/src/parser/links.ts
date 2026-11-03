import type { LinkCitado, Origem } from './tipos.js';

const RE_LINK = /(?<!!)\[([^\]]*)\]\(\s*#(!?\/(scenario|feature)\/([^)\s]+))\s*\)/g;
const RE_IMAGEM = /!\[[^\]]*\]\(\s*([^)\s]+)\s*\)/g;

/** `[RNG-06](#/scenario/Pasta_Arquivo/6)` e `[x](#!/feature/Pasta_Arquivo)` dentro de um texto. */
export function extrairLinks(texto: string, origem: Origem): LinkCitado[] {
  const saida: LinkCitado[] = [];
  for (const m of texto.matchAll(RE_LINK)) {
    const tipo = m[3] === 'scenario' ? 'cenario' : 'feature';
    const resto = decodificar(m[4]!).replace(/\/+$/, '');
    let endereco = resto;
    let posicao: number | undefined;
    if (tipo === 'cenario') {
      const i = resto.lastIndexOf('/');
      endereco = i >= 0 ? resto.slice(0, i) : resto;
      const n = i >= 0 ? Number(resto.slice(i + 1)) : NaN;
      posicao = Number.isInteger(n) ? n : undefined;
    }
    saida.push({ rotulo: m[1]!.trim(), alvo: m[2]!, tipo, endereco, posicao, origem: { ...origem, coluna: (m.index ?? 0) + 1 } });
  }
  return saida;
}

export function extrairImagens(texto: string, origem: Origem) {
  return [...texto.matchAll(RE_IMAGEM)].map((m) => ({ alvo: decodificar(m[1]!), origem }));
}

function decodificar(t: string): string {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}
