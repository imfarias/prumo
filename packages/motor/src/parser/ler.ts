import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator, type Comment, type DataTable, type GherkinDocument, type Step, type Tag } from '@cucumber/messages';
import type { Achado } from '../config/esquema.js';
import { relativoPosix } from '../util/caminhos.js';
import { extrairImagens, extrairLinks } from './links.js';
import type { ArquivoFeature, Filho, LinkCitado, Passo, Tabela } from './tipos.js';

const IGNORAR = new Set(['node_modules', '.git', 'html', 'saida']);

/** Lista os .feature em ordem estável de caminho (compara sem depender do locale do sistema). */
export async function descobrirFeatures(specs: string): Promise<string[]> {
  const saida: string[] = [];
  async function andar(dir: string) {
    const itens = await readdir(dir, { withFileTypes: true });
    itens.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const it of itens) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) {
        if (!IGNORAR.has(it.name) && !it.name.startsWith('.')) await andar(p);
      } else if (it.isFile() && it.name.endsWith('.feature')) {
        saida.push(p);
      }
    }
  }
  await andar(specs);
  return saida;
}

function tabela(dt: DataTable | undefined): Tabela | undefined {
  if (!dt || !dt.rows.length) return undefined;
  const [cab, ...resto] = dt.rows;
  return {
    cabecalho: cab!.cells.map((c) => c.value.trim()),
    linhas: resto.map((r) => ({ celulas: r.cells.map((c) => c.value.trim()), linha: r.location.line })),
    linha: dt.location.line,
  };
}

function passo(s: Step): Passo {
  return { palavra: s.keyword, texto: s.text, linha: s.location.line, tabela: tabela(s.dataTable), docString: s.docString?.content };
}

const RE_ANOTACAO = /^#\s*([\p{L}][\p{L} ]{0,30}?)\s*:\s*(.+?)\s*$/u;

function anotacoes(comentarios: readonly Comment[], de: number, ate: number) {
  return comentarios
    .filter((c) => c.location.line > de && c.location.line < ate)
    .map((c) => ({ m: RE_ANOTACAO.exec(c.text.trim()), linha: c.location.line }))
    .filter((x) => x.m)
    .map((x) => ({ chave: x.m![1]!.trim(), valor: x.m![2]!.trim(), linha: x.linha }));
}

/** Converte o documento do Gherkin no formato interno, com a posição Pirilampo de cada filho (RN-02). */
export function converter(doc: GherkinDocument, caminho: string, specs: string, fonte = ''): ArquivoFeature | undefined {
  const f = doc.feature;
  if (!f) return undefined;
  const relativo = relativoPosix(specs, caminho);
  const pasta = path.basename(path.dirname(caminho));
  const nome = path.basename(caminho, '.feature');
  const comentarios = doc.comments;

  // Achata `Regra:` (não usada hoje) na mesma contagem, como o Pirilampo faria com os filhos visíveis.
  const brutos = f.children.flatMap((c) => (c.rule ? c.rule.children : [c]));
  const linhasFilhos = brutos.map((c) => (c.background ?? c.scenario)!.location.line);
  const filhos: Filho[] = brutos.map((c, i) => {
    const fim = linhasFilhos[i + 1] ?? Number.MAX_SAFE_INTEGER;
    if (c.background) {
      const b = c.background;
      return {
        posicao: i, tipo: 'Contexto', titulo: b.name, tags: [], descricao: b.description,
        passos: b.steps.map(passo), exemplos: [], linha: b.location.line, anotacoes: anotacoes(comentarios, b.location.line, fim),
      };
    }
    const s = c.scenario!;
    return {
      posicao: i,
      tipo: s.examples.length ? 'Esquema' : 'Cenário',
      titulo: s.name,
      tags: s.tags.map((t: Tag) => t.name),
      descricao: s.description,
      passos: s.steps.map(passo),
      exemplos: s.examples.map((e) => {
        if (!e.tableHeader) return undefined;
        return {
          cabecalho: e.tableHeader.cells.map((x) => x.value.trim()),
          linhas: e.tableBody.map((r) => ({ celulas: r.cells.map((x) => x.value.trim()), linha: r.location.line })),
          linha: e.location.line,
        } satisfies Tabela;
      }).filter((t): t is Tabela => !!t),
      linha: s.location.line,
      anotacoes: anotacoes(comentarios, s.location.line, fim),
    };
  });

  const primeiroFilho = linhasFilhos[0] ?? Number.MAX_SAFE_INTEGER;
  const metadados: ArquivoFeature['metadados'] = {};
  for (const a of anotacoes(comentarios, 0, primeiroFilho)) metadados[a.chave] ??= { valor: a.valor, linha: a.linha };

  // Links e imagens: descrição da feature, descrições, passos e células, com a linha de cada ocorrência.
  const links: LinkCitado[] = [];
  const imagens: ArquivoFeature['imagens'] = [];
  const linhasFonte = fonte.split(/\r?\n/);
  const coletar = (texto: string, linha: number) => {
    links.push(...extrairLinks(texto, { arquivo: relativo, linha }));
    imagens.push(...extrairImagens(texto, { arquivo: relativo, linha }));
  };
  coletarDescricao(f.description, f.location.line + 1, linhasFonte, coletar);
  for (const fi of filhos) {
    coletarDescricao(fi.descricao, fi.linha + 1, linhasFonte, coletar);
    for (const p of fi.passos) {
      coletar(p.texto, p.linha);
      for (const l of p.tabela?.linhas ?? []) for (const c of l.celulas) coletar(c, l.linha);
    }
    for (const t of fi.exemplos) for (const l of t.linhas) for (const c of l.celulas) coletar(c, l.linha);
  }

  return {
    caminho, relativo, pasta, nome, endereco: `${pasta}_${nome}`,
    titulo: f.name, descricao: f.description, linha: f.location.line, tags: f.tags.map((t) => t.name),
    metadados, filhos, links, imagens,
  };
}

/** A descrição vem como um bloco; a linha real de cada trecho é achada no texto-fonte, a partir do título. */
function coletarDescricao(texto: string, linhaInicial: number, fonte: string[], coletar: (t: string, l: number) => void) {
  if (!texto) return;
  let cursor = linhaInicial - 1;
  for (const t of texto.split('\n')) {
    const alvo = t.trim();
    if (!alvo) continue;
    let achou = -1;
    for (let i = cursor; i < fonte.length && i < cursor + 200; i++) {
      if (fonte[i]!.trim() === alvo) {
        achou = i;
        break;
      }
    }
    if (achou >= 0) cursor = achou + 1;
    coletar(t, achou >= 0 ? achou + 1 : cursor + 1);
  }
}

export interface ResultadoLeitura {
  arquivos: ArquivoFeature[];
  achados: Achado[];
}

export async function lerFeatures(specs: string): Promise<ResultadoLeitura> {
  const arquivos: ArquivoFeature[] = [];
  const achados: Achado[] = [];
  for (const caminho of await descobrirFeatures(specs)) {
    const texto = (await readFile(caminho, 'utf8')).replace(/^﻿/, '');
    const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
    try {
      const a = converter(parser.parse(texto), caminho, specs, texto);
      if (a) arquivos.push(a);
    } catch (e) {
      const erros = (e as { errors?: { message: string; location?: { line: number; column?: number } }[] }).errors ?? [e as Error];
      for (const er of erros) {
        const loc = 'location' in er ? er.location : undefined;
        achados.push({
          severidade: 'erro',
          codigo: 'sintaxe',
          arquivo: relativoPosix(specs, caminho),
          linha: loc?.line,
          coluna: loc?.column,
          mensagem: `Erro de sintaxe Gherkin: ${traduzirErro(er.message)}`,
        });
      }
    }
  }
  return { arquivos, achados };
}

function traduzirErro(m: string): string {
  const semPos = m.replace(/^\(\d+:\d+\):\s*/, '');
  return semPos
    .replace(/expected:/, 'esperado:')
    .replace(/got '(.*)'$/, "encontrado '$1'")
    .replace(/unexpected end of file/, 'fim inesperado do arquivo')
    .replace(/inconsistent cell count within the table/, 'quantidade de células diferente entre as linhas da tabela');
}
