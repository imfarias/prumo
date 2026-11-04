import { diffLines, diffWordsWithSpace } from 'diff';
import type { ArquivoFeature, Filho } from '../parser/tipos.js';
import { normalizar } from '../util/texto.js';
import { escapar } from './markdown.js';
import type { Situacao } from './tipos.js';

export interface MudancaFilho {
  situacao: Situacao;
  diffHtml?: string;
}

export interface MudancaPagina {
  situacao: Situacao;
  descricaoDiff?: string;
  filhos: Map<number, MudancaFilho>; // posição atual → mudança
  removidos: { titulo: string; texto: string }[];
  anterior?: ArquivoFeature;
}

export interface ResultadoComparacao {
  versao: string;
  paginas: Map<string, MudancaPagina>; // endereço atual → mudança
  removidas: ArquivoFeature[];
  renomeadas: { de: string; para: string }[];
}

const limpar = (t: string) => t.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').trim();

/** Texto canônico de um filho para comparar: título, tags, descrição, passos e células sem alinhamento (RN-64). */
export function textoDoFilho(f: Filho): string {
  const linhas = [`${f.tipo}: ${f.titulo}`];
  if (f.tags.length) linhas.push(f.tags.join(' '));
  if (f.descricao.trim()) linhas.push(...f.descricao.split('\n').map((l) => l.trim()).filter(Boolean));
  for (const p of f.passos) {
    linhas.push(`${p.palavra.trim()} ${p.texto.trim()}`);
    if (p.tabela) {
      linhas.push(`| ${p.tabela.cabecalho.join(' | ')} |`);
      for (const l of p.tabela.linhas) linhas.push(`| ${l.celulas.join(' | ')} |`);
    }
    if (p.docString) linhas.push(p.docString.trim());
  }
  for (const t of f.exemplos) {
    linhas.push(`| ${t.cabecalho.join(' | ')} |`);
    for (const l of t.linhas) linhas.push(`| ${l.celulas.join(' | ')} |`);
  }
  return limpar(linhas.join('\n'));
}

/** HTML do diff por palavra: inclusões em <ins>, exclusões em <del>, com texto para leitores de tela. */
export function diffHtml(antes: string, depois: string): string {
  return diffWordsWithSpace(antes, depois)
    .map((p) => {
      const t = escapar(p.value).replace(/\n/g, '<br>');
      if (p.added) return `<ins><span class="sr">incluído: </span>${t}</ins>`;
      if (p.removed) return `<del><span class="sr">excluído: </span>${t}</del>`;
      return t;
    })
    .join('');
}

/** Pareia filhos pelo título normalizado; títulos repetidos, pela ordem (RN-63). */
function parear(atual: Filho[], anterior: Filho[]) {
  const filas = new Map<string, Filho[]>();
  for (const f of anterior) {
    const k = `${f.tipo === 'Contexto' ? 'ctx' : ''}${normalizar(f.titulo)}`;
    filas.set(k, [...(filas.get(k) ?? []), f]);
  }
  const pares = atual.map((f) => {
    const k = `${f.tipo === 'Contexto' ? 'ctx' : ''}${normalizar(f.titulo)}`;
    const fila = filas.get(k);
    return { atual: f, anterior: fila?.shift() };
  });
  const sobras = [...filas.values()].flat();
  return { pares, removidos: sobras };
}

function semelhanca(a: string, b: string): number {
  let iguais = 0;
  for (const p of diffLines(a, b)) if (!p.added && !p.removed) iguais += p.value.length;
  return iguais / Math.max(a.length, b.length, 1);
}

export function compararVersoes(atual: ArquivoFeature[], anterior: ArquivoFeature[], versao: string): ResultadoComparacao {
  const porEndereco = new Map(anterior.map((a) => [a.endereco.normalize('NFC'), a]));
  const paginas = new Map<string, MudancaPagina>();
  for (const a of atual) {
    const ant = porEndereco.get(a.endereco.normalize('NFC'));
    porEndereco.delete(a.endereco.normalize('NFC'));
    if (!ant) {
      paginas.set(a.endereco, { situacao: 'nova', filhos: new Map(a.filhos.map((f) => [f.posicao, { situacao: 'nova' as Situacao }])), removidos: [] });
      continue;
    }
    if (limpar(ant.fonte) === limpar(a.fonte)) {
      paginas.set(a.endereco, { situacao: 'igual', filhos: new Map(), removidos: [], anterior: ant });
      continue;
    }
    const { pares, removidos } = parear(a.filhos, ant.filhos);
    const filhos = new Map<number, MudancaFilho>();
    for (const p of pares) {
      if (!p.anterior) {
        filhos.set(p.atual.posicao, { situacao: 'nova' });
        continue;
      }
      const [x, y] = [textoDoFilho(p.anterior), textoDoFilho(p.atual)];
      filhos.set(p.atual.posicao, x === y ? { situacao: 'igual' } : { situacao: 'alterada', diffHtml: diffHtml(x, y) });
    }
    const descA = limpar(ant.descricao);
    const descB = limpar(a.descricao);
    const mudou = descA !== descB || removidos.length > 0 || [...filhos.values()].some((f) => f.situacao !== 'igual');
    paginas.set(a.endereco, {
      situacao: mudou ? 'alterada' : 'igual',
      descricaoDiff: descA !== descB ? diffHtml(descA, descB) : undefined,
      filhos,
      removidos: removidos.map((f) => ({ titulo: f.titulo, texto: textoDoFilho(f) })),
      anterior: ant,
    });
  }
  const removidas = [...porEndereco.values()];
  const renomeadas: ResultadoComparacao['renomeadas'] = [];
  for (const r of removidas) {
    const candidata = atual.find((a) => paginas.get(a.endereco)?.situacao === 'nova' && semelhanca(limpar(r.fonte), limpar(a.fonte)) >= 0.8);
    if (candidata) renomeadas.push({ de: r.endereco, para: candidata.endereco });
  }
  return { versao, paginas, removidas, renomeadas };
}
