import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { gerarDocumentacao, type ResultadoDocs } from '../../src/docs/gerar.js';
import { gerarPdf, paginasDosDestinos } from '../../src/docs/pdf.js';
import { arquivoDaPagina } from '../../src/docs/modelo.js';
import { lancarChromium, NavegadorPlaywright } from '../../src/navegador/playwright.js';
import { lerFeatures } from '../../src/parser/ler.js';
import { criarProjeto, type ProjetoTemp } from '../fabricas/projeto.js';
import { aplicarMudancas } from '../fabricas/repositorio-git.js';
import { criarEspecificacaoGrande } from '../fabricas/especificacao-grande.js';

let browser: Browser | undefined;
try {
  browser = await lancarChromium();
} catch (e) {
  if (process.env.PRUMO_EXIGIR_NAVEGADOR) throw e;
}
const comNavegador = describe.skipIf(!browser);
vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

let p: ProjetoTemp;
let anterior: ProjetoTemp;
let pasta: ResultadoDocs;
let unico: ResultadoDocs;
let comparado: ResultadoDocs;

beforeAll(async () => {
  if (!browser) return;
  p = await criarProjeto();
  pasta = await gerarDocumentacao(p.dir);
  unico = await gerarDocumentacao(p.dir, { arquivoUnico: true, saida: path.join(p.dir, '..', 'unico') });
  anterior = await criarProjeto();
  const atual = await criarProjeto();
  await aplicarMudancas(atual);
  comparado = await gerarDocumentacao(atual.dir, { comparar: anterior.dir });
  (comparado as ResultadoDocs & { limpar?: () => Promise<void> }).limpar = atual.limpar;
});
afterAll(async () => {
  await browser?.close();
  await p?.limpar();
  await anterior?.limpar();
  await (comparado as unknown as { limpar?: () => Promise<void> })?.limpar?.();
});

interface Aberta {
  pg: Page;
  ctx: BrowserContext;
  fora: string[];
  erros: string[];
}
async function abrir(arquivo: string, hash = '', o: { largura?: number; js?: boolean } = {}): Promise<Aberta> {
  const ctx = await browser!.newContext({ viewport: { width: o.largura ?? 1440, height: 900 }, javaScriptEnabled: o.js ?? true, bypassCSP: false });
  const fora: string[] = [];
  const erros: string[] = [];
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (/^(file|data|blob):/.test(u)) return r.continue();
    fora.push(u);
    return r.abort();
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(String(e)));
  await pg.goto(pathToFileURL(arquivo).href + hash);
  await pg.waitForLoadState('load');
  await pg.waitForTimeout(150);
  return { pg, ctx, fora, erros };
}
const index = (r: ResultadoDocs) => path.join(r.saida, 'index.html');
const fPagina = (r: ResultadoDocs, end: string) => path.join(r.saida, 'f', arquivoDaPagina(end));

comNavegador('links antigos e novos (CT-P01, CT-P02, CA-02)', () => {
  it('todo link das features abre a funcionalidade e o cenário certos, nos dois modos', async () => {
    const { arquivos } = await lerFeatures(p.dir);
    const links = [...new Map(arquivos.flatMap((a) => a.links).map((l) => [`#${l.alvo}`, l])).values()];
    expect(links.length).toBeGreaterThan(10);
    for (const r of [pasta, unico]) {
      const a = await abrir(index(r));
      for (const l of links) {
        await a.pg.goto(pathToFileURL(index(r)).href + `#${l.alvo}`);
        await a.pg.waitForTimeout(r.modo === 'pasta' ? 60 : 30);
        const art = await a.pg.getAttribute('article.funcionalidade', 'data-endereco');
        expect(art, `${r.modo} ${l.alvo}`).toBe(l.endereco.normalize('NFC'));
        if (l.posicao !== undefined) expect(await a.pg.getAttribute('.cenario.destacado', 'id'), l.alvo).toBe(`c-${l.posicao}`);
      }
      expect(a.erros).toEqual([]);
      await a.ctx.close();
    }
  });

  it('rota nova (copiável) e busca antiga com termo destacado', async () => {
    const a = await abrir(index(pasta), '#!/f/01_Portal_02_Portal_Lista_Parceiras/c/2');
    expect(decodeURIComponent(a.pg.url())).toMatch(/f\/01-portal-02-portal-lista-parceiras-[a-z0-9]+\.html#c-2$/);
    await a.pg.goto(pathToFileURL(index(pasta)).href + '#!/feature/01_Portal_02_Portal_Lista_Parceiras/razão social');
    await a.pg.waitForTimeout(200);
    expect(await a.pg.$$eval('mark', (l) => l.map((x) => x.textContent))).toEqual(expect.arrayContaining(['razão', 'social']));
    await a.ctx.close();
  });

  it('endereço inexistente mostra "Não encontrado" com sugestão', async () => {
    const a = await abrir(index(pasta), '#/scenario/01_Portal_02_Portal_Lista_Parceira/9');
    await a.pg.waitForTimeout(150);
    expect(await a.pg.isVisible('[data-testid="docs-nao-encontrado"]')).toBe(true);
    expect(await a.pg.textContent('.sugestao a')).toBe('01_Portal_02_Portal_Lista_Parceiras');
    await a.ctx.close();
  });
});

comNavegador('prévia, copiar link e protótipo (CT-P03, CT-P04, CT-P07, CT-P08)', () => {
  it('prévia abre, Esc fecha e o foco volta ao link; Abrir leva à regra', async () => {
    const a = await abrir(fPagina(pasta, '01_Portal_03_Portal_Contato'));
    const link = a.pg.locator('a[data-previa]', { hasText: 'RNG-03' }).first();
    await link.focus();
    await a.pg.keyboard.press('Enter');
    expect(await a.pg.isVisible('[data-testid="docs-previa"]')).toBe(true);
    expect(await a.pg.textContent('#previa-titulo')).toBe('RNG-03 - Validação de e-mail');
    await a.pg.keyboard.press('Escape');
    expect(await a.pg.isVisible('[data-testid="docs-previa"]')).toBe(false);
    expect(await a.pg.evaluate(() => (document.activeElement as HTMLElement).textContent)).toBe('RNG-03');
    await link.click();
    await a.pg.click('[data-testid="docs-previa-abrir"]');
    await a.pg.waitForTimeout(150);
    expect(await a.pg.getAttribute('.cenario.destacado', 'id')).toBe('c-3');
    await a.ctx.close();
  });

  it('copiar link: endereço novo que abre o cenário', async () => {
    const a = await abrir(fPagina(pasta, '01_Portal_02_Portal_Lista_Parceiras'));
    await a.pg.click('[data-testid="docs-copiar-2"]');
    await a.pg.waitForSelector('[data-testid="docs-copiar-2"][data-copiado]');
    const url = (await a.pg.getAttribute('[data-testid="docs-copiar-2"]', 'data-copiado'))!;
    expect(url).toMatch(/index\.html#!\/f\/01_Portal_02_Portal_Lista_Parceiras\/c\/2$/);
    await a.pg.waitForFunction(() => document.querySelector('[data-testid="docs-anuncio"]')?.textContent === 'Link do cenário copiado.', undefined, { timeout: 5000 });
    await a.pg.goto(url);
    await a.pg.waitForTimeout(150);
    expect(await a.pg.getAttribute('.cenario.destacado', 'id')).toBe('c-2');
    await a.ctx.close();
  });

  for (const modo of ['pasta', 'unico'] as const) {
    it(`protótipo embutido (${modo}): carrega, troca de estado, zoom, sem rede`, async () => {
      const r = modo === 'pasta' ? pasta : unico;
      const a = modo === 'pasta' ? await abrir(fPagina(r, '01_Portal_03_Portal_Contato')) : await abrir(index(r), '#!/f/01_Portal_03_Portal_Contato');
      await a.pg.waitForTimeout(500);
      const quadro = () => a.pg.frames().find((f) => f !== a.pg.mainFrame())!;
      expect(await quadro().textContent('h1')).toBe('Contato');
      await a.pg.click('[data-testid="docs-prototipo-estado-erro-2"]');
      await a.pg.waitForTimeout(500);
      expect(await quadro().isVisible('[role="alert"]')).toBe(true);
      expect(await quadro().evaluate(() => [document.compatMode, [...document.fonts].some((f) => f.status === 'loaded')])).toEqual(['CSS1Compat', true]);
      const escala = () => a.pg.evaluate(() => getComputedStyle(document.querySelector('.moldura iframe')!).transform);
      expect(await escala()).toMatch(/^matrix\(0\.\d+/);
      await a.pg.click('[data-testid="docs-prototipo-zoom-100"]');
      expect(await escala()).toBe('none');
      expect(a.fora).toEqual([]);
      expect(a.erros).toEqual([]);
      await a.ctx.close();
    });
  }
});

comNavegador('busca (CT-P05, CT-P06, CA-07)', () => {
  it('sem acento, prefixo, erro de digitação, código e teclado', async () => {
    const a = await abrir(index(pasta));
    const buscar = (q: string) => a.pg.evaluate((x) => (window as unknown as { prumoBuscar: (q: string) => { titulo: string; codigo?: string }[] }).prumoBuscar(x).map((d) => d.codigo ?? d.titulo), q);
    expect(await buscar('pesquisa sem resultado')).toContain('02. Pesquisa sem resultado');
    expect(await buscar('parcei')).toContain('Portal Lista Parceiras');
    expect(await buscar('parcerias')).toContain('Portal Lista Parceiras');
    expect(await buscar('validacao')).toContain('RNG-01');
    expect(await buscar('rng 3')).toEqual(['RNG-03']);
    await a.pg.keyboard.press('Control+k');
    expect(await a.pg.evaluate(() => document.activeElement?.id)).toBe('busca');
    await a.pg.keyboard.type('e-mails diferentes');
    await a.pg.waitForTimeout(150);
    expect(await a.pg.getAttribute('#busca', 'aria-expanded')).toBe('true');
    expect(await a.pg.textContent('#busca-status')).toMatch(/\d+ resultados/);
    await a.pg.keyboard.press('ArrowDown');
    expect(await a.pg.getAttribute('#busca', 'aria-activedescendant')).toBe('res-0');
    await a.pg.keyboard.press('Enter');
    await a.pg.waitForTimeout(300);
    expect(await a.pg.getAttribute('.cenario.destacado', 'id')).toBe('c-2');
    expect((await a.pg.textContent('.cenario.destacado mark'))!.toLowerCase()).toMatch(/mails|diferentes/);
    await a.ctx.close();
  });

  it('menos de 200 ms por consulta numa especificação 5× o piloto', async () => {
    const g = await criarEspecificacaoGrande();
    try {
      const r = await gerarDocumentacao(g.dir);
      expect(r.documentacao.paginas.length).toBeGreaterThan(200);
      expect(r.documentacao.busca.length).toBeGreaterThan(1200);
      const a = await abrir(index(r));
      const tempos = await a.pg.evaluate(() => {
        const busca = (window as unknown as { prumoBuscar: (q: string) => unknown[] }).prumoBuscar;
        busca('aquecer');
        const qs = ['beneficiaria', 'certificado operadora', 'faixa salarial', 'responsavel cadastro', 'divulgacao', 'municipio', 'trabalhador', 'inscricao', 'relatorio', 'analise situacao'];
        const t: number[] = [];
        for (let i = 0; i < 50; i++) {
          const t0 = performance.now();
          busca(qs[i % qs.length]! + (i >= 10 ? ' ' + qs[(i * 3) % qs.length]!.slice(0, 4) : ''));
          t.push(performance.now() - t0);
        }
        return t.sort((x, y) => x - y);
      });
      expect(tempos[Math.floor(tempos.length * 0.95)]!).toBeLessThan(200);
      await a.ctx.close();
    } finally {
      await g.limpar();
    }
  });
});

comNavegador('comparação, matriz, sem JS e contraste (CT-P09, CT-P10, CT-P13, CT-P15)', () => {
  it('menu marca nova/alterada; Ver mudanças e Ver versão anterior', async () => {
    const a = await abrir(fPagina(comparado, '01_Portal_03_Portal_Contato'));
    expect(await a.pg.textContent(`[data-testid="docs-menu"] a[data-endereco="01_Portal_04_Portal_Ajuda"] + .situacao`)).toBe('nova');
    expect(await a.pg.isVisible('[data-testid="docs-faixa-mudanca"]')).toBe(true);
    await a.pg.click('[data-testid="docs-mudancas-1"] summary');
    expect(await a.pg.textContent('[data-testid="docs-mudancas-1"] ins')).toContain('mensagem');
    expect(await a.pg.isVisible('[data-testid="docs-versao-anterior"]')).toBe(false);
    await a.pg.click('[data-testid="docs-ver-anterior"]');
    expect(await a.pg.isVisible('[data-testid="docs-versao-anterior"]')).toBe(true);
    expect(await a.pg.isVisible('[data-testid="docs-removidos"]')).toBe(true);
    await a.ctx.close();
  });

  it('matriz filtra por texto e por tipo', async () => {
    const a = await abrir(path.join(pasta.saida, 'matriz.html'));
    const visiveis = () => a.pg.$$eval('[data-testid="docs-matriz-tabela"] tbody tr', (l) => l.filter((x) => !(x as HTMLElement).hidden).length);
    expect(await visiveis()).toBe(7);
    await a.pg.fill('[data-testid="docs-matriz-filtro"]', 'contato');
    expect(await visiveis()).toBe(1);
    await a.pg.selectOption('[data-testid="docs-matriz-tipo"]', 'MSG');
    expect(await a.pg.$$eval('thead th.cod', (l) => l.filter((x) => !(x as HTMLElement).hidden).map((x) => x.textContent))).toEqual(['MSG-01', 'MSG-02', 'MSG-03', 'MSG-04']);
    await a.ctx.close();
  });

  it('sem JavaScript a página da funcionalidade mostra o conteúdo completo', async () => {
    const a = await abrir(fPagina(pasta, '01_Portal_03_Portal_Contato'), '', { js: false });
    expect(await a.pg.isVisible('#c-1')).toBe(true);
    expect(await a.pg.textContent('#c-1 h2')).toContain('01. Enviar mensagem');
    await a.ctx.close();
  });

  it('alto contraste é lembrado ao trocar de página', async () => {
    const a = await abrir(index(pasta));
    await a.pg.click('[data-testid="docs-contraste"]');
    expect(await a.pg.getAttribute('html', 'data-tema')).toBe('contraste');
    await a.pg.goto(pathToFileURL(path.join(pasta.saida, 'matriz.html')).href);
    expect(await a.pg.getAttribute('html', 'data-tema')).toBe('contraste');
    expect(await a.pg.getAttribute('[data-testid="docs-contraste"]', 'aria-pressed')).toBe('true');
    await a.ctx.close();
  });
});

comNavegador('acessibilidade e teclado (CT-P11, CT-P12, CT-P14, CA-13)', () => {
  it('axe sem violações sérias ou críticas em todas as páginas, a 1440 e a 390 px', async () => {
    const nav = new NavegadorPlaywright();
    await nav.abrir();
    try {
      const paginas = [
        index(pasta), path.join(pasta.saida, 'matriz.html'), ...pasta.arquivos.filter((f) => f.startsWith('f/')).map((f) => path.join(pasta.saida, f)),
        index(comparado), path.join(comparado.saida, 'mudancas.html'), fPagina(comparado, '01_Portal_03_Portal_Contato'), index(unico),
      ];
      const problemas: string[] = [];
      for (const largura of [1440, 390]) {
        for (const arq of paginas) {
          const r = await nav.axe(pathToFileURL(arq).href, { largura });
          for (const v of r.violacoes.filter((x) => x.impacto === 'serious' || x.impacto === 'critical')) problemas.push(`${largura} ${path.basename(arq)}: ${v.id} ${v.alvos.slice(0, 2).join(' | ')}`);
        }
      }
      expect(problemas).toEqual([]);
    } finally {
      await nav.fechar();
    }
  });

  it('o 1º Tab é "Pular para o conteúdo" e o foco é visível; sem rolagem horizontal a 390 px', async () => {
    const a = await abrir(fPagina(pasta, '01_Portal_02_Portal_Lista_Parceiras'));
    await a.pg.keyboard.press('Tab');
    expect(await a.pg.evaluate(() => (document.activeElement as HTMLElement).dataset.testid)).toBe('docs-pular');
    for (let i = 0; i < 6; i++) {
      await a.pg.keyboard.press('Tab');
      expect(await a.pg.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe('none');
    }
    await a.ctx.close();
    for (const arq of [index(pasta), fPagina(pasta, '03_Cadastro_01_Parceira_Cadastrar')]) {
      const m = await abrir(arq, '', { largura: 390 });
      expect(await m.pg.evaluate(() => document.documentElement.scrollWidth), arq).toBeLessThanOrEqual(390);
      expect(m.fora).toEqual([]);
      await m.ctx.close();
    }
  });
});

comNavegador('PDF (CT-I15, CT-I16, CT-U06, CA-10)', () => {
  it('módulo: capa, sumário com as páginas exatas de cada funcionalidade', async () => {
    const saida = path.join(p.dir, '..', 'portal.pdf');
    const r = await gerarPdf(p.dir, { saida, recorte: { modulos: ['01_Portal'] } });
    const doc = await PDFDocument.load(await readFile(saida));
    expect(doc.getPageCount()).toBe(r.paginas);
    expect(r.paginas).toBeGreaterThanOrEqual(5);
    const destinos = (await paginasDosDestinos(await readFile(saida))) as Map<string, number>;
    const funcs = [...destinos].filter(([k]) => k.startsWith('f-'));
    expect(funcs).toHaveLength(3);
    expect(new Map(funcs)).toEqual(r.sumario);
    expect(Math.min(...funcs.map(([, n]) => n))).toBe(3); // capa = 1, sumário = 2
  });

  it('paisagem, recorte por tela capturando o PNG que falta, e recorte vazio', async () => {
    const q = await criarProjeto({ semPngs: true });
    try {
      const saida = path.join(q.dir, '..', 'tela.pdf');
      const r = await gerarPdf(q.dir, { saida, recorte: { telas: ['03_Portal_Contato'] }, orientacao: 'paisagem' });
      const doc = await PDFDocument.load(await readFile(saida));
      const { width, height } = doc.getPage(0).getSize();
      expect(width).toBeGreaterThan(height);
      expect(r.sumario.size).toBe(1);
      await expect(gerarPdf(q.dir, { saida, recorte: { telas: ['Nao_Existe'] } })).rejects.toMatchObject({ codigo: 'DOC-11' });
    } finally {
      await q.limpar();
    }
  });

  it('só mudanças exige comparação e traz só novas/alteradas', async () => {
    await expect(gerarPdf(p.dir, { saida: path.join(p.dir, '..', 'x.pdf'), soMudancas: true })).rejects.toMatchObject({ codigo: 'DOC-10' });
    const atual = await criarProjeto();
    try {
      await aplicarMudancas(atual);
      const r = await gerarPdf(atual.dir, { saida: path.join(atual.dir, '..', 'm.pdf'), soMudancas: true, comparar: anterior.dir });
      expect([...r.sumario.keys()].sort()).toEqual(['f-' + arquivoDaPagina('01_Portal_03_Portal_Contato'), 'f-' + arquivoDaPagina('01_Portal_04_Portal_Ajuda'), 'f-' + arquivoDaPagina('04_Gestão_02_Gestão_Empresas')].map((x) => x.replace(/\.html$/, '')).sort());
    } finally {
      await atual.limpar();
    }
  });
});
