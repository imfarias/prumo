import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nunjucks from 'nunjucks';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import type { Navegador } from '../navegador/navegador.js';
import { NavegadorPlaywright } from '../navegador/playwright.js';
import { gerarPrototipos, type Recorte } from '../render/gerar.js';
import { gravarSeMudou } from '../render/recursos.js';
import { caminhoFonte, cssDosTokens, FONTES_EMBUTIDAS, fontesUsadas } from '../render/tokens-css.js';
import { ErroPrumo } from '../util/erros.js';
import { mesmoTexto } from '../util/texto.js';
import { kitDocs, prepararDocumentacao } from './gerar.js';
import { escapar } from './markdown.js';
import type { PaginaDoc } from './tipos.js';
import { andar, type OpcoesExecucao } from '../util/execucao.js';

/** Página de cada destino nomeado (`/Dests`) do PDF gerado pelo Chromium (CT-U06). */
export function paginasDosDestinos(pdf: Uint8Array | PDFDocument): Promise<Map<string, number>> | Map<string, number> {
  const ler = (doc: PDFDocument) => {
    const indice = new Map(doc.getPages().map((pg, i) => [pg.ref.toString(), i + 1]));
    const dests = doc.catalog.lookupMaybe(PDFName.of('Dests'), PDFDict);
    const saida = new Map<string, number>();
    if (!dests) return saida;
    for (const [nome, valor] of dests.entries()) {
      let d: unknown = valor;
      if (d instanceof PDFRef) d = doc.context.lookup(d);
      if (d instanceof PDFDict) d = d.lookup(PDFName.of('D'));
      if (d instanceof PDFArray) {
        const pg = indice.get(d.get(0).toString());
        if (pg) saida.set(decodificarNome(nome.asString()), pg);
      }
    }
    return saida;
  };
  if (pdf instanceof PDFDocument) return ler(pdf);
  return PDFDocument.load(pdf).then(ler);
}

/** Nomes do PDF vêm como "/f-abc" com #xx para bytes especiais. */
function decodificarNome(n: string): string {
  return n.replace(/^\//, '').replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** Ids e links da página para um documento único: c-3 → {id}-c-3; outra.html#c-2 → #{outra}-c-2. */
function prefixarAncoras(html: string, id: string, ids: Map<string, string>): string {
  return html
    .replace(/\b(id|aria-labelledby)="(c-\d+(?:-titulo)?|prototipo-titulo|citadas-titulo|removidos-titulo|fonte-titulo)"/g, (_m, a: string, v: string) => `${a}="${id}-${v}"`)
    .replace(/href="([^"#]*?\.html)?(#c-\d+)?"/g, (m, arq: string | undefined, ancora: string | undefined) => {
      if (!arq && !ancora) return m;
      const alvo = arq ? ids.get(decodeURIComponent(arq)) : id;
      if (!alvo) return m;
      return ancora ? `href="#${alvo}-${ancora.slice(1)}"` : `href="#f-${alvo}"`;
    });
}

export interface OpcoesPdf extends OpcoesExecucao {
  projeto?: string;
  saida: string;
  recorte?: Recorte;
  orientacao?: 'retrato' | 'paisagem';
  soMudancas?: boolean;
  comparar?: string | false;
  navegador?: Navegador;
}

/** PDF em duas passadas: a 1ª descobre a página de cada funcionalidade; a 2ª escreve o sumário (RN-60). */
export async function gerarPdf(specs: string, o: OpcoesPdf): Promise<{ arquivo: string; paginas: number; sumario: Map<string, number> }> {
  const { p, documentacao: d, anterior } = await prepararDocumentacao(specs, { projeto: o.projeto, comparar: o.comparar, modo: 'pasta', sinal: o.sinal, aoAndamento: o.aoAndamento });
  const temp = await mkdtemp(path.join(os.tmpdir(), 'prumo-pdf-'));
  const nav = o.navegador ?? new NavegadorPlaywright();
  try {
    if (o.soMudancas && !d.comparacao) throw new ErroPrumo('DOC-10', 'Para --so-mudancas, informe a versão anterior com --comparar (ou documentacao.comparar_com).');
    const r = o.recorte;
    let paginas = d.paginas.filter((pg) => !pg.erroSintaxe);
    if (r?.modulos?.length) paginas = paginas.filter((pg) => r.modulos!.some((m) => mesmoTexto(m, pg.pasta)));
    if (r?.telas?.length) paginas = paginas.filter((pg) => r.telas!.some((t) => mesmoTexto(t, pg.nomeFeature)));
    if (o.soMudancas) paginas = paginas.filter((pg) => pg.situacao === 'nova' || pg.situacao === 'alterada');
    if (!paginas.length) throw new ErroPrumo('DOC-11', 'Nenhuma funcionalidade no recorte pedido para o PDF.');

    // Recursos: CSS, fontes, imagens e o PNG de cada tela (capturado quando não existe nas especificações).
    const rec = path.join(temp, 'recursos');
    await gravarSeMudou(path.join(rec, 'prumo-docs.css'), cssDosTokens(p.config, [], p.arquivoConfig) + (await readFile(path.join(kitDocs(), 'estilo.css'), 'utf8')));
    await gravarSeMudou(path.join(rec, 'impressao.css'), await readFile(path.join(kitDocs(), 'impressao.css'), 'utf8'));
    for (const fam of fontesUsadas(p.config, [], p.arquivoConfig)) for (const a of FONTES_EMBUTIDAS[fam]!.arquivos) await gravarSeMudou(path.join(rec, 'fontes', a.nome), await readFile(caminhoFonte(fam, a.nome)));
    for (const [abs, dest] of d.imagens) if (existsSync(abs)) await gravarSeMudou(path.join(rec, ...dest.split('/')), await readFile(abs));
    const logoAbs = p.config.projeto.logo ? path.resolve(p.specs, p.config.projeto.logo) : undefined;
    const logo = logoAbs && existsSync(logoAbs) ? `recursos/logo${path.extname(logoAbs)}` : undefined;
    if (logo) await gravarSeMudou(path.join(temp, logo), await readFile(logoAbs!));

    andar(o, 'Preparando o PDF');
    await nav.abrir();
    const faltam = paginas.filter((pg) => pg.prototipo && !existsSync(pngDe(pg, p.specs)));
    const capturados = new Map<string, string>();
    if (faltam.length) {
      const g = await gerarPrototipos(p.modelo, p.config, { specs: p.specs, saida: path.join(temp, 'prototipos'), recorte: { telas: faltam.map((x) => x.prototipo!.tela) } });
      for (const pg of g.paginas.filter((x) => x.estado === 'padrao')) {
        const destino = path.join(rec, 'capturas', `${pg.tela}.png`);
        await gravarSeMudou(destino, await nav.capturar(pathToFileURL(pg.arquivo).href + '#captura', { largura: p.config.largura_captura }));
        capturados.set(pg.tela, `recursos/capturas/${encodeURIComponent(pg.tela)}.png`);
      }
    }

    const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(kitDocs(), { noCache: true }), { autoescape: true, trimBlocks: true, lstripBlocks: true });
    env.addGlobal('contem', () => false);
    const ids = new Map(d.paginas.map((pg) => [pg.arquivo, pg.arquivo.replace(/\.html$/, '')]));
    const corpo = paginas.map((pg) => {
      const id = ids.get(pg.arquivo)!;
      const pngImpressao = pg.prototipo ? (capturados.get(pg.prototipo.tela) ?? pngRelativo(pg)) : undefined;
      const html = env.render('funcionalidade-corpo.njk', { pg, imprimir: true, raiz: '', inicio: '#capa', comparacao: d.comparacao, unico: false, prototipoAberto: true, pngImpressao });
      return { id, titulo: pg.titulo, modulo: pg.apoio ? 'Regras e mensagens' : pg.modulo, html: prefixarAncoras(html.replace(/"\.\.\/recursos\//g, '"recursos/'), id, ids) };
    });
    const grupos: { titulo: string; paginas: typeof corpo }[] = [];
    for (const c of corpo) {
      const g = grupos.find((x) => x.titulo === c.modulo) ?? (grupos.push({ titulo: c.modulo, paginas: [] }), grupos[grupos.length - 1]!);
      g.paginas.push(c);
    }
    const recorte = r?.modulos?.length ? `Módulos: ${r.modulos.join(', ')}` : r?.telas?.length ? `Funcionalidades: ${r.telas.join(', ')}` : o.soMudancas ? 'Só o que mudou' : undefined;
    const htmlImpressao = env.render('impressao.njk', { projeto: d.projeto, logo, recorte, comparacao: d.comparacao, grupos, paginas: corpo });
    const arquivoHtml = path.join(temp, 'impressao.html');
    const rodape = `<div style="font:8px sans-serif;color:#555;width:100%;padding:0 14mm;display:flex;justify-content:space-between"><span>${escapar(d.projeto.nome)} ${escapar(d.projeto.versao)}</span><span>página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`;
    const paisagem = (o.orientacao ?? (p.config.documentacao.pdf === 'paisagem' ? 'paisagem' : 'retrato')) === 'paisagem';

    await writeFile(arquivoHtml, htmlImpressao, 'utf8');
    andar(o, 'Montando o PDF (1ª passada)', 1, 2);
    const primeira = await nav.pdf!(pathToFileURL(arquivoHtml).href, { paisagem, rodape });
    const destinos = (await paginasDosDestinos(primeira)) as Map<string, number>;
    const numerado = htmlImpressao.replace(/<span class="pg" data-alvo="([^"]+)">0000<\/span>/g, (_m, alvo: string) => `<span class="pg" data-alvo="${alvo}">${destinos.get(alvo) ?? '—'}</span>`);
    await writeFile(arquivoHtml, numerado, 'utf8');
    andar(o, 'Numerando o sumário (2ª passada)', 2, 2);
    const final = await nav.pdf!(pathToFileURL(arquivoHtml).href, { paisagem, rodape });
    const saida = path.resolve(o.saida);
    await gravarSeMudou(saida, final);
    const doc = await PDFDocument.load(final);
    return { arquivo: saida, paginas: doc.getPageCount(), sumario: new Map([...destinos].filter(([k]) => k.startsWith('f-'))) };
  } finally {
    await nav.fechar().catch(() => {});
    await anterior?.limpar();
    await rm(temp, { recursive: true, force: true });
  }
}

function pngDe(pg: PaginaDoc, specs: string): string {
  const rel = pg.prototipo?.png?.replace(/^\.\.\/recursos\/img\//, '');
  return rel ? path.join(specs, ...rel.split('/').map(decodeURIComponent)) : '';
}

function pngRelativo(pg: PaginaDoc): string | undefined {
  return pg.prototipo?.png?.replace(/^\.\.\/recursos\//, 'recursos/');
}
