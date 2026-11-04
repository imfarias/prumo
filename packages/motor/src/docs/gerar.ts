import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';
import nunjucks from 'nunjucks';
import type { Achado } from '../config/esquema.js';
import { preparar, verificarPreparado, type Preparado } from '../executar.js';
import { gerarPrototipos } from '../render/gerar.js';
import { gravarSeMudou } from '../render/recursos.js';
import { caminhoFonte, cssDosTokens, FONTES_EMBUTIDAS, fontesUsadas } from '../render/tokens-css.js';
import { dentroDe, relativoPosix } from '../util/caminhos.js';
import { ErroPrumo } from '../util/erros.js';
import { tituloDeArquivo } from '../util/texto.js';
import { VERSAO_MOTOR } from '../versao.js';
import { prepararVersaoAnterior, type VersaoAnterior } from './anterior.js';
import { OPCOES_INDICE } from './busca-config.js';
import { compararVersoes } from './comparar.js';
import { escapar } from './markdown.js';
import { modeloDaDocumentacao, rotaFuncionalidade } from './modelo.js';
import type { Documentacao, Modo, NoArvore, PaginaDoc } from './tipos.js';

export const KIT_DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../kits/docs');
const KIT_PROTOTIPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../kits/proprio');
const LISTA = '.prumo-arquivos';
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' };

export interface OpcoesDocs {
  projeto?: string;
  saida?: string;
  arquivoUnico?: boolean;
  comparar?: string | false;
  estrito?: boolean;
}

export interface ResultadoDocs {
  saida: string;
  modo: Modo;
  documentacao: Documentacao;
  preparado: Preparado;
  achados: Achado[];
  arquivos: string[]; // relativos à saída
  tamanho: number; // bytes
  avisos: string[];
}

const SEP_LINHA = new RegExp(String.fromCharCode(0x2028), 'g');
const SEP_PARAGRAFO = new RegExp(String.fromCharCode(0x2029), 'g');
const BARRA = String.fromCharCode(92);
/** JSON seguro dentro de <script>: '<' e os separadores de linha Unicode viram escapes. */
export const jsonSeguro = (v: unknown) =>
  JSON.stringify(v).replace(/</g, `${BARRA}u003c`).replace(SEP_LINHA, `${BARRA}u2028`).replace(SEP_PARAGRAFO, `${BARRA}u2029`);

function ambiente() {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(KIT_DOCS, { noCache: true }), { autoescape: true, trimBlocks: true, lstripBlocks: true, throwOnUndefined: false });
  const contem = (no: NoArvore, atual: string): boolean => no.endereco === atual || no.filhos.some((f) => contem(f, atual));
  env.addGlobal('contem', contem);
  return env;
}

/** Saída padrão: <specs>/../html (o lugar do Pirilampo) ou documentacao.saida do projeto.yml. */
export function saidaPadrao(p: Preparado): string {
  const cfg = p.config.documentacao.saida;
  return path.resolve(p.specs, typeof cfg === 'string' && cfg ? cfg : '../html');
}

async function dataUri(arquivo: string): Promise<string> {
  const tipo = MIME[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream';
  return `data:${tipo};base64,${(await readFile(arquivo)).toString('base64')}`;
}

/** Troca url(...) relativos de um CSS por data URIs (arquivo único). */
async function cssComDados(css: string, dirBase: string): Promise<string> {
  const partes: string[] = [];
  let ultimo = 0;
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    partes.push(css.slice(ultimo, m.index));
    ultimo = (m.index ?? 0) + m[0].length;
    const ref = m[2]!;
    const arq = path.resolve(dirBase, ref.split(/[?#]/)[0]!);
    partes.push(!/^(data:|https?:|#)/.test(ref) && existsSync(arq) ? `url("${await dataUri(arq)}")` : m[0]);
  }
  return partes.join('') + css.slice(ultimo);
}

/** Contexto comum dos templates: links dependem do modo e de a página estar na raiz ou em f/. */
function contexto(d: Documentacao, p: Preparado, raiz: '' | '../', logo: string | undefined) {
  const unico = d.modo === 'unico';
  const porEndereco = new Map(d.paginas.map((x) => [x.endereco, x]));
  const hrefPagina = (arquivo: string, endereco: string) => (unico ? rotaFuncionalidade(endereco) : raiz === '' ? `f/${encodeURIComponent(arquivo)}` : encodeURIComponent(arquivo));
  const marcas = new Set(d.matriz.marcas.map(([i, j]) => `${i},${j}`));
  return {
    projeto: d.projeto,
    versaoPrumo: VERSAO_MOTOR,
    arvore: d.arvore,
    comparacao: d.comparacao,
    numeros: d.numeros,
    achados: d.achados.map((a) => ({ ...a, href: a.href && !unico && raiz === '../' ? `../${a.href}` : a.href })),
    matriz: d.matriz,
    unico,
    raiz,
    logo,
    prototipoAberto: p.config.documentacao.prototipo_aberto,
    inicio: unico ? '#!/' : `${raiz}index.html`,
    hrefMatriz: unico ? '#!/matriz' : `${raiz}matriz.html`,
    hrefMudancas: unico ? '#!/mudancas' : `${raiz}mudancas.html`,
    hrefPagina,
    hrefEndereco: (e: string) => hrefPagina(porEndereco.get(e)?.arquivo ?? '', e),
    hrefPrevia: (chave: string) => {
      const pr = d.previas[chave];
      return !pr ? '#' : unico ? pr.href : raiz === '' ? `f/${pr.href}` : pr.href;
    },
    tituloDe: (e: string) => porEndereco.get(e)?.titulo ?? e,
    cenariosMudados: (e: string) => {
      const pg = porEndereco.get(e);
      const n = pg?.filhos.filter((f) => f.situacao === 'nova' || f.situacao === 'alterada').length ?? 0;
      const r = pg?.removidos.length ?? 0;
      return `${n} ${n === 1 ? 'cenário novo ou alterado' : 'cenários novos ou alterados'}${r ? `, ${r} removido${r > 1 ? 's' : ''}` : ''}`;
    },
    marca: (i: number, j: number) => marcas.has(`${i},${j}`),
    telasDoCodigo: (j: number) => d.matriz.marcas.filter(([, y]) => y === j).map(([i]) => d.matriz.telas[i]!),
  };
}

/** Arquivos com erro de sintaxe também entram na documentação (FA-11). */
async function arquivosComErro(p: Preparado, achados: Achado[]) {
  const vistos = new Set<string>();
  const saida: { relativo: string; fonte: string; linha?: number; mensagem: string }[] = [];
  for (const a of achados) {
    if (a.codigo !== 'sintaxe' || vistos.has(a.arquivo)) continue;
    vistos.add(a.arquivo);
    saida.push({ relativo: a.arquivo, fonte: (await readFile(path.join(p.specs, a.arquivo), 'utf8')).replace(/^﻿/, ''), linha: a.linha, mensagem: a.mensagem });
  }
  return saida;
}

export async function prepararDocumentacao(specs: string, o: OpcoesDocs & { modo?: Modo }) {
  const p = await preparar(specs, { projeto: o.projeto });
  const achados = verificarPreparado(p);
  const modo: Modo = o.modo ?? ((o.arquivoUnico ?? p.config.documentacao.arquivo_unico) ? 'unico' : 'pasta');
  const valor = o.comparar === false ? undefined : (o.comparar ?? (typeof p.config.documentacao.comparar_com === 'string' ? p.config.documentacao.comparar_com : undefined));
  let anterior: VersaoAnterior | undefined;
  if (valor) anterior = await prepararVersaoAnterior(p.specs, valor);
  const comparacao = anterior ? compararVersoes(p.arquivos, anterior.preparado.arquivos, anterior.rotulo) : undefined;
  const documentacao = modeloDaDocumentacao(p, { modo, comparacao, anterior: anterior?.preparado, achados, comErro: await arquivosComErro(p, achados) });
  return { p, achados, modo, anterior, documentacao };
}

export async function gerarDocumentacao(specs: string, o: OpcoesDocs = {}): Promise<ResultadoDocs> {
  const { p, achados, modo, anterior, documentacao: d } = await prepararDocumentacao(specs, o);
  try {
    const saida = path.resolve(o.saida ?? saidaPadrao(p));
    const gerados = new Set<string>();
    const avisos: string[] = [];
    const gravar = async (rel: string, conteudo: string | Buffer) => {
      const alvo = dentroDe(saida, path.join(saida, ...rel.split('/')));
      gerados.add(rel);
      await gravarSeMudou(alvo, conteudo);
    };

    // Index do Pirilampo no lugar: substitui só o index.html e avisa (RN-50).
    const indexAtual = path.join(saida, 'index.html');
    if (existsSync(indexAtual) && !existsSync(path.join(saida, LISTA))) {
      const cabeca = (await readFile(indexAtual, 'utf8')).slice(0, 4000);
      if (!cabeca.includes('content="Prumo')) avisos.push(`O ${relativoPosix(process.cwd(), indexAtual)} existente (Pirilampo) foi substituído; os demais arquivos da pasta foram mantidos.`);
    }

    const env = ambiente();
    const telasAlteradas = d.paginas.filter((x) => x.situacao === 'alterada' && x.prototipo?.anterior).map((x) => x.prototipo!.tela);
    const recursoLogo = p.config.projeto.logo ? path.resolve(p.specs, p.config.projeto.logo) : undefined;
    const logoExiste = recursoLogo && existsSync(recursoLogo);
    const cssTokens = cssDosTokens(p.config, [], p.arquivoConfig);
    const cssDocs = await readFile(path.join(KIT_DOCS, 'estilo.css'), 'utf8');
    const js = await readFile(path.join(KIT_DOCS, 'prumo-docs.js'), 'utf8').catch(() => {
      throw new ErroPrumo('DOC-09', 'O script da documentação não foi compilado. Rode `npm run build` no Prumo.');
    });
    const indice = new MiniSearch(OPCOES_INDICE as never);
    indice.addAll(d.busca as never);
    const dadosBase = { rotas: d.rotas, previas: d.previas, busca: indice.toJSON() };

    if (modo === 'pasta') {
      await gerarPrototipos(p.modelo, p.config, { specs: p.specs, saida: path.join(saida, 'prototipos'), arquivoConfig: p.arquivoConfig });
      if (anterior && telasAlteradas.length) {
        await gerarPrototipos(anterior.preparado.modelo, anterior.preparado.config, { specs: anterior.preparado.specs, saida: path.join(saida, 'prototipos-anterior'), recorte: { telas: telasAlteradas } });
      }
      for (const f of await listar(path.join(saida, 'prototipos'))) gerados.add(`prototipos/${f}`);
      for (const f of await listar(path.join(saida, 'prototipos-anterior'))) gerados.add(`prototipos-anterior/${f}`);
      for (const pg of d.paginas) if (pg.prototipo?.html) await gravar(pg.prototipo.html, await readFile(path.join(p.specs, pg.prototipo.modulo, path.basename(pg.prototipo.html))));

      await gravar('recursos/prumo-docs.css', cssTokens + cssDocs);
      for (const fam of fontesUsadas(p.config, [], p.arquivoConfig)) {
        for (const a of FONTES_EMBUTIDAS[fam]!.arquivos) await gravar(`recursos/fontes/${a.nome}`, await readFile(caminhoFonte(fam, a.nome)));
      }
      await gravar('recursos/prumo-docs.js', js);
      await gravar('recursos/dados.js', `window.PRUMO_DADOS=${jsonSeguro(dadosBase)};\n`);
      if (logoExiste) await gravar(`recursos/logo${path.extname(recursoLogo!).toLowerCase()}`, await readFile(recursoLogo!));
      for (const [abs, dest] of d.imagens) if (existsSync(abs)) await gravar(`recursos/${dest}`, await readFile(abs));

      const logo = (raiz: string) => (logoExiste ? `${raiz}recursos/logo${path.extname(recursoLogo!).toLowerCase()}` : undefined);
      const base = (raiz: '' | '../', pagina: string) => ({ ...contexto(d, p, raiz, logo(raiz)), config: { modo, raiz, pagina }, atual: pagina });
      await gravar('index.html', env.render('inicio.njk', { ...base('', '#inicio'), tituloPagina: 'Início' }));
      await gravar('matriz.html', env.render('matriz.njk', { ...base('', '#matriz'), tituloPagina: 'Matriz' }));
      if (d.comparacao) await gravar('mudancas.html', env.render('mudancas.njk', { ...base('', '#mudancas'), tituloPagina: 'O que mudou' }));
      for (const pg of d.paginas) {
        await gravar(`f/${pg.arquivo}`, env.render('funcionalidade.njk', { ...base('../', pg.endereco), tituloPagina: pg.titulo, pg }));
      }
    } else {
      const temp = await mkdtemp(path.join(os.tmpdir(), 'prumo-unico-'));
      try {
        await gerarPrototipos(p.modelo, p.config, { specs: p.specs, saida: path.join(temp, 'p'), arquivoConfig: p.arquivoConfig });
        if (anterior && telasAlteradas.length) await gerarPrototipos(anterior.preparado.modelo, anterior.preparado.config, { specs: anterior.preparado.specs, saida: path.join(temp, 'a'), recorte: { telas: telasAlteradas } });
        const prototipos: Record<string, string> = {};
        const usados = new Set<string>();
        for (const pg of d.paginas) {
          const pr = pg.prototipo;
          if (!pr) continue;
          if (pr.html) prototipos[`${pr.tela}/padrao`] = await paginaUnica(path.join(p.specs, pr.modulo, path.basename(pr.html)), path.join(temp, 'p', '_recursos'), usados);
          for (const e of pr.estados) prototipos[`${pr.tela}/${e.id}`] = await paginaUnica(path.join(temp, 'p', pr.modulo, pr.tela, `${e.id}.html`), path.join(temp, 'p', '_recursos'), usados);
          for (const e of pr.anterior?.estados ?? []) {
            const arq = path.join(temp, 'a', pr.modulo, pr.tela, `${e.id}.html`);
            if (existsSync(arq)) prototipos[`anterior:${pr.tela}/${e.id}`] = await paginaUnica(arq, path.join(temp, 'p', '_recursos'), usados);
          }
        }
        const recP = path.join(temp, 'p', '_recursos');
        let cssPrototipos = await cssComDados(await readFile(path.join(recP, 'prumo.css'), 'utf8'), recP);
        const adicional = path.join(recP, 'adicional');
        if (existsSync(adicional)) for (const f of await listar(adicional)) if (f.endsWith('.css')) cssPrototipos += '\n' + (await cssComDados((await readFile(path.join(adicional, f), 'utf8')).replace(/@import[^;]+;/g, ''), path.dirname(path.join(adicional, f))));
        const jsPrototipo = await readFile(path.join(KIT_PROTOTIPO, 'prumo-prototipo.js'), 'utf8');

        let cssFontes = cssTokens;
        for (const fam of fontesUsadas(p.config, [], p.arquivoConfig)) for (const a of FONTES_EMBUTIDAS[fam]!.arquivos) cssFontes = cssFontes.replace(`url("fontes/${a.nome}")`, `url("${await dataUri(caminhoFonte(fam, a.nome))}")`);
        const logo = logoExiste ? await dataUri(recursoLogo!) : undefined;
        const ctx = { ...contexto(d, p, '', logo), unico: true };
        const corpos: string[] = [];
        const tpl = (id: string, titulo: string, html: string) => corpos.push(`<template id="${id}" data-titulo="${escapar(titulo)}">${html}</template>`);
        tpl('pg-inicio', 'Início', env.render('inicio-corpo.njk', { ...ctx, atual: '#inicio' }));
        tpl('pg-matriz', 'Matriz', env.render('matriz-corpo.njk', { ...ctx, atual: '#matriz' }));
        if (d.comparacao) tpl('pg-mudancas', 'O que mudou', env.render('mudancas-corpo.njk', { ...ctx, atual: '#mudancas' }));
        for (const pg of d.paginas) tpl(`pg-${pg.arquivo}`, pg.titulo, env.render('funcionalidade-corpo.njk', { ...ctx, atual: pg.endereco, pg }));
        const recursosPrototipo: Record<string, string> = {};
        for (const nome of [...usados].sort()) recursosPrototipo[nome] = await dataUri(path.join(recP, nome));
        const dados = { ...dadosBase, prototipos, cssPrototipos, jsPrototipo, recursosPrototipo };
        let html = env.render('inicio.njk', {
          ...ctx, atual: '#inicio', tituloPagina: 'Início', config: { modo, raiz: '', pagina: '#inicio' },
          cssInline: cssFontes + cssDocs, jsInline: js.replace(/<\/script/gi, '<\\/script'),
          dadosUnico: `${corpos.join('\n')}\n<script>window.PRUMO_DADOS=${jsonSeguro(dados)};</script>`,
        });
        html = await trocarImagens(html, d);
        await gravar('index.html', html);
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    }

    // Limpeza segura (RN-50): remove só o que o Prumo gerou antes e não gerou agora.
    const listaAnterior = existsSync(path.join(saida, LISTA)) ? (await readFile(path.join(saida, LISTA), 'utf8')).split('\n').filter(Boolean) : [];
    for (const rel of listaAnterior) {
      if (gerados.has(rel)) continue;
      const alvo = path.join(saida, ...rel.split('/'));
      if (existsSync(alvo)) await unlink(dentroDe(saida, alvo));
    }
    const ordenados = [...gerados].sort();
    await gravarSeMudou(path.join(saida, LISTA), ordenados.join('\n') + '\n');
    let tamanho = 0;
    for (const rel of ordenados) tamanho += (await stat(path.join(saida, ...rel.split('/')))).size;
    if (modo === 'unico' && tamanho > 50 * 1024 * 1024) avisos.push(`O arquivo único tem ${(tamanho / 1048576).toFixed(1)} MB; para projetos com muitas imagens, prefira o modo pasta (sem --arquivo-unico).`);
    return { saida, modo, documentacao: d, preparado: p, achados, arquivos: ordenados, tamanho, avisos };
  } finally {
    await anterior?.limpar();
  }
}

async function listar(dir: string, base = dir): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const saida: string[] = [];
  for (const it of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) saida.push(...(await listar(p, base)));
    else saida.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return saida.sort();
}

/** Página do protótipo para o arquivo único: CSS e script no lugar dos links, imagens em data:, links entre telas viram mensagens. */
async function paginaUnica(arquivo: string, recursos: string, usados?: Set<string>): Promise<string> {
  let html = await readFile(arquivo, 'utf8');
  html = html
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; img-src data:">`)
    .replace(/<link rel="stylesheet" href="[^"]*_recursos\/prumo\.css">/, '<!--PRUMO-CSS-->')
    .replace(/<link rel="stylesheet" href="[^"]*_recursos\/adicional\/[^"]*">/g, '')
    .replace(/<script src="[^"]*_recursos\/prumo-prototipo\.js"><\/script>/, '<!--PRUMO-JS-->')
    .replace(/href="\.\.\/\.\.\/([^"/]+)\/([^"/]+)\/([^"/]+)\.html"/g, (_m, a: string, b: string, c: string) => `href="#" data-prumo-alvo="${decodeURIComponent(a)}/${decodeURIComponent(b)}/${decodeURIComponent(c)}"`)
    .replace(/href="\.\.\/\.\.\/index\.html"/g, 'href="#"');
  // Imagens dos recursos (logo, brasão) ficam uma vez só em dados.recursosPrototipo; aqui só a referência.
  return html.replace(/src="\.\.\/\.\.\/_recursos\/([^"]+)"/g, (m, rel: string) => {
    const nome = decodeURIComponent(rel);
    if (!existsSync(path.join(recursos, nome))) return m;
    usados?.add(nome);
    return `src="prumo-rec:${nome}"`;
  });
}

async function trocarImagens(html: string, d: Documentacao): Promise<string> {
  const porDestino = new Map([...d.imagens].map(([abs, dest]) => [dest, abs]));
  const partes: string[] = [];
  let ultimo = 0;
  for (const m of html.matchAll(/prumo-img:([^"'\s<>]+)/g)) {
    partes.push(html.slice(ultimo, m.index));
    ultimo = (m.index ?? 0) + m[0].length;
    const abs = porDestino.get(m[1]!);
    partes.push(abs && existsSync(abs) ? await dataUri(abs) : '');
  }
  return partes.join('') + html.slice(ultimo);
}

export { tituloDeArquivo };
export type { PaginaDoc };
