import type { ArquivoFeature, Filho } from '../parser/tipos.js';
import { extrairLinks } from '../parser/links.js';
import { normalizar, slug, tituloDeArquivo } from '../util/texto.js';
import type { Acao } from '../modelo/tipos.js';

/** RN-21: negrito só é ação depois de um verbo de acionamento. */
const RE_ACAO = /\b(?:aciona(?:r)?|clica(?:r)?|seleciona(?:r)?|pressiona(?:r)?)\s+(?:(?:n?a|n?o)\s+)?(?:op[çc][ãa]o|bot[ãa]o|link|aba|item|em)?\s*\*\*([^*]+)\*\*/giu;

export interface AcaoBruta {
  rotulo: string;
  filho: Filho;
  passoIndice: number;
  texto: string;
  linha: number;
}

export function detectarAcoes(texto: string): string[] {
  return [...texto.matchAll(RE_ACAO)].map((m) => m[1]!.trim());
}

const VAZIAS = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'para', 'tela', 'opcao']);
const tokens = (t: string) => normalizar(t).split(/[^a-z0-9]+/).filter((x) => x && !VAZIAS.has(x));

/**
 * Tela de destino de uma ação: link `#!/feature/…` no mesmo passo, ou título de outra funcionalidade
 * que contém todas as palavras da ação (a com menos palavras sobrando; empate = sem destino).
 */
export function destinoDaAcao(rotulo: string, textoPasso: string, telas: ArquivoFeature[], propria: ArquivoFeature): string | undefined {
  const link = extrairLinks(textoPasso, { arquivo: '', linha: 0 }).find((l) => l.tipo === 'feature');
  if (link) return telas.find((t) => t.endereco === link.endereco)?.nome ?? `?${link.endereco}`;

  const ta = tokens(rotulo);
  if (!ta.length) return undefined;
  let melhor: { nome: string; sobra: number } | undefined;
  let empate = false;
  for (const t of telas) {
    const tt = tokens(tituloDeArquivo(t.nome));
    if (!ta.every((x) => tt.includes(x))) continue;
    // "Contato" casa exatamente com "Portal Contato" sem a 1ª palavra (o módulo).
    const exata = tt.slice(1).join(' ') === ta.join(' ') || tt.join(' ') === ta.join(' ');
    const sobra = exata ? 0 : tt.length - ta.length;
    if (!melhor || sobra < melhor.sobra) {
      melhor = { nome: t.nome, sobra };
      empate = false;
    } else if (sobra === melhor.sobra) empate = true;
  }
  if (!melhor || empate || melhor.nome === propria.nome) return undefined;
  // Exige ao menos duas palavras em comum, ou correspondência exata, para não ligar "Filtrar" a uma tela "Filtrar Exemplo".
  if (ta.length < 2 && melhor.sobra > 0) return undefined;
  return melhor.nome;
}

/**
 * Ações da tela (RN-21). O primeiro passo "Dado" do Contexto descreve como se chega à tela
 * (a ação pertence à tela anterior) e não entra.
 */
export function acoesDaTela(arquivo: ArquivoFeature, telas: ArquivoFeature[]): Acao[] {
  const brutas: AcaoBruta[] = [];
  for (const f of arquivo.filhos) {
    f.passos.forEach((p, i) => {
      if (f.tipo === 'Contexto' && i === 0) return;
      // O destino pode estar no passo seguinte ("Então o sistema apresenta a tela [X](#!/feature/…)").
      const seguinte = f.passos[i + 1]?.texto ?? '';
      const texto = /^\s*(ent[ãa]o|e)\b/i.test(f.passos[i + 1]?.palavra ?? '') ? `${p.texto}\n${seguinte}` : p.texto;
      for (const rotulo of detectarAcoes(p.texto)) brutas.push({ rotulo, filho: f, passoIndice: i, texto, linha: p.linha });
    });
  }
  const principal = arquivo.filhos.find((f) => f.tags.includes('@fluxo-principal'));
  const primeiraPrincipal = brutas.find((b) => b.filho === principal);
  const vistos = new Map<string, Acao>();
  for (const b of brutas) {
    const id = slug(b.rotulo);
    if (vistos.has(id)) continue;
    vistos.set(id, {
      id,
      rotulo: b.rotulo,
      primaria: primeiraPrincipal ? b === primeiraPrincipal : vistos.size === 0,
      destino: destinoDaAcao(b.rotulo, b.texto, telas, arquivo),
      origem: { arquivo: arquivo.relativo, linha: b.linha },
    });
  }
  return [...vistos.values()];
}
