import type { ConfigProjeto } from '../config/esquema.js';
import { normalizar } from '../util/texto.js';
import type { ArquivoFeature, Filho, Origem } from './tipos.js';

export type TipoReferencia = 'RNG' | 'LOV' | 'MSG' | 'EMAIL';

export interface Referencia {
  codigo: string; // 'RNG-06', 'E-mail-01'
  chave: string; // normalizada: 'RNG-06', 'EMAIL-01'
  tipo: TipoReferencia;
  titulo: string; // texto depois do código
  endereco: string; // 'Pasta_Arquivo/6'
  posicao: number;
  arquivo: ArquivoFeature;
  filho: Filho;
  origem: Origem;
  /** Opções (1ª coluna da 1ª tabela) — usado nas LOVs. */
  opcoes?: string[];
  /** Texto da mensagem (célula da tabela `Mensagem`), nas MSGs. */
  texto?: string;
}

export interface Indice {
  porEndereco: Map<string, { arquivo: ArquivoFeature; filho: Filho }>;
  porFeature: Map<string, ArquivoFeature>;
  porCodigo: Map<string, Referencia[]>;
  referencias: Referencia[];
}

const RE_CODIGO = /^\s*((RNG|LOV|MSG)\s*-\s*(\d+)|(E-?mail)\s*-\s*(\d+))\b\s*(?:[-–:]\s*)?(.*)$/i;

/** Chave normalizada de um código citado ou definido: "rng-6" → "RNG-06"; "E-mail-1" → "EMAIL-01". */
export function chaveCodigo(texto: string): { chave: string; tipo: TipoReferencia; codigo: string; resto: string } | undefined {
  const m = RE_CODIGO.exec(texto);
  if (!m) return undefined;
  if (m[2]) {
    const tipo = m[2].toUpperCase() as TipoReferencia;
    return { chave: `${tipo}-${m[3]!.padStart(2, '0')}`, tipo, codigo: `${tipo}-${m[3]}`, resto: m[6] ?? '' };
  }
  return { chave: `EMAIL-${m[5]!.padStart(2, '0')}`, tipo: 'EMAIL', codigo: `E-mail-${m[5]}`, resto: m[6] ?? '' };
}

function ehArquivoDeReferencia(a: ArquivoFeature, config: ConfigProjeto): boolean {
  const pastas = [...config.referencias.regras, ...config.referencias.mensagens].map(normalizar);
  return pastas.includes(normalizar(a.pasta));
}

/** Monta o índice: todo filho de todo arquivo por endereço, e cada RNG/LOV/MSG/E-mail por código (RN-04). */
export function montarIndice(arquivos: ArquivoFeature[], config: ConfigProjeto): Indice {
  const porEndereco: Indice['porEndereco'] = new Map();
  const porFeature: Indice['porFeature'] = new Map();
  const porCodigo: Indice['porCodigo'] = new Map();
  const referencias: Referencia[] = [];

  for (const arquivo of arquivos) {
    porFeature.set(arquivo.endereco, arquivo);
    for (const filho of arquivo.filhos) porEndereco.set(`${arquivo.endereco}/${filho.posicao}`, { arquivo, filho });
    if (!ehArquivoDeReferencia(arquivo, config)) continue;

    for (const filho of arquivo.filhos) {
      if (filho.tipo === 'Contexto') continue;
      const c = chaveCodigo(filho.titulo);
      if (!c) continue;
      const tabelaPrincipal = filho.passos.find((p) => p.tabela)?.tabela;
      const ref: Referencia = {
        codigo: c.codigo,
        chave: c.chave,
        tipo: c.tipo,
        titulo: c.resto.trim(),
        endereco: `${arquivo.endereco}/${filho.posicao}`,
        posicao: filho.posicao,
        arquivo,
        filho,
        origem: { arquivo: arquivo.relativo, linha: filho.linha },
      };
      if (c.tipo === 'LOV' && tabelaPrincipal) {
        // Coluna das opções: a de mesmo nome da LOV; senão a primeira que não é código/id.
        const cab = tabelaPrincipal.cabecalho.map(normalizar);
        let col = cab.findIndex((h) => h === normalizar(c.resto.trim()));
        if (col < 0) col = cab.findIndex((h) => !/^(cod(igo)?|id|sigla|n[ºo°]?|numero|ordem)$/.test(h));
        if (col < 0) col = 0;
        ref.opcoes = tabelaPrincipal.linhas.map((l) => l.celulas[col] ?? '').filter(Boolean).map(limparMarkdown);
      }
      if (c.tipo === 'MSG' && tabelaPrincipal) {
        const col = Math.max(0, tabelaPrincipal.cabecalho.findIndex((h) => /mensagem/i.test(h)));
        ref.texto = tabelaPrincipal.linhas.map((l) => l.celulas[col] ?? '').filter(Boolean).join(' ');
      }
      referencias.push(ref);
      const lista = porCodigo.get(c.chave) ?? [];
      lista.push(ref);
      porCodigo.set(c.chave, lista);
    }
  }
  return { porEndereco, porFeature, porCodigo, referencias };
}

function limparMarkdown(t: string): string {
  return t.replace(/[*`]/g, '').trim();
}
