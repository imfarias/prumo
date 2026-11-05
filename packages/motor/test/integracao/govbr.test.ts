import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { gerar } from '../../src/executar.js';
import { lancarChromium, NavegadorPlaywright } from '../../src/navegador/playwright.js';
import type { PaginaGerada } from '../../src/render/gerar.js';
import { criarProjeto, type ProjetoTemp } from '../fabricas/projeto.js';

/** Kit govbr e protótipo clicável (0004) no Chromium real. */
let browser: Browser | undefined;
try {
  browser = await lancarChromium();
} catch (e) {
  if (process.env.PRUMO_EXIGIR_NAVEGADOR) throw e;
}
const comNavegador = describe.skipIf(!browser);
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let proprio: ProjetoTemp;
let govbr: ProjetoTemp;
let pgProprio: PaginaGerada[];
let pgGovbr: PaginaGerada[];

beforeAll(async () => {
  if (!browser) return;
  proprio = await criarProjeto();
  govbr = await criarProjeto();
  await govbr.substituir('projeto.yml', 'design_system: proprio', 'design_system: govbr');
  pgProprio = (await gerar(proprio.dir, { saida: path.join(proprio.dir, '..', 'saida') })).paginas;
  pgGovbr = (await gerar(govbr.dir, { saida: path.join(govbr.dir, '..', 'saida') })).paginas;
});
afterAll(async () => {
  await browser?.close();
  await proprio?.limpar();
  await govbr?.limpar();
});

async function abrir(url: string, largura = 1440) {
  const ctx = await browser!.newContext({ viewport: { width: largura, height: 900 } });
  const fora: string[] = [];
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
    fora.push(u);
    return r.abort();
  });
  const pg = await ctx.newPage();
  await pg.goto(url);
  await pg.evaluate(() => document.fonts.ready.then(() => undefined));
  return { pg, fora, fechar: () => ctx.close() };
}
const url = (p: PaginaGerada) => pathToFileURL(p.arquivo).href;
const achar = (l: PaginaGerada[], tela: string, estado = 'padrao') => l.find((x) => x.tela === tela && x.estado === estado)!;

comNavegador('kit govbr (CT-I01 a CT-I04)', () => {
  it('mesmos id e data-testid do kit proprio em todas as páginas (RN-82) e nenhum pedido de rede', async () => {
    expect(pgGovbr.map((x) => `${x.tela}/${x.estado}`)).toEqual(pgProprio.map((x) => `${x.tela}/${x.estado}`));
    const ids = async (p: PaginaGerada) => {
      const { pg, fora, fechar } = await abrir(url(p) + '#captura');
      const r = await pg.evaluate(() => ({
        ids: [...document.querySelectorAll('main [id]')].map((e) => e.id).sort(),
        // O selo só sai no proprio com padroes.selo_situacao; o resto é igual (RN-82).
        testids: [...document.querySelectorAll('main [data-testid]')].map((e) => e.getAttribute('data-testid')!).filter((t) => !t.endsWith('-selo')).sort(),
      }));
      await fechar();
      return { ...r, fora };
    };
    for (const p of pgGovbr) {
      const g = await ids(p);
      const o = await ids(achar(pgProprio, p.tela, p.estado));
      expect(g.fora, p.tela).toEqual([]);
      expect(g.ids, `${p.tela}/${p.estado}`).toEqual(o.ids);
      expect(g.testids, `${p.tela}/${p.estado}`).toEqual(o.testids);
    }
  });

  it('axe sem violações sérias ou críticas, a 1440 e a 390 px, em todas as páginas e estados', async () => {
    const nav = new NavegadorPlaywright();
    await nav.abrir();
    try {
      const problemas: string[] = [];
      for (const largura of [1440, 390]) {
        for (const p of pgGovbr) {
          const r = await nav.axe(url(p), { largura });
          for (const v of r.violacoes.filter((x) => x.impacto === 'serious' || x.impacto === 'critical')) problemas.push(`${largura} ${p.tela}/${p.estado}: ${v.id} em ${v.alvos.slice(0, 2).join(', ')}`);
        }
      }
      expect(problemas).toEqual([]);
    } finally {
      await nav.fechar();
    }
  });

  it('a 390 px nenhuma página rola na horizontal (CA-10)', async () => {
    const largas: string[] = [];
    for (const p of pgGovbr.filter((x) => x.estado === 'padrao')) {
      const { pg, fechar } = await abrir(url(p) + '#captura', 390);
      const w = await pg.evaluate(() => document.documentElement.scrollWidth);
      if (w > 390) largas.push(`${p.tela}: ${w}px`);
      await fechar();
    }
    expect(largas).toEqual([]);
  });

  it('selo de situação com texto e cor pelo sentido (CT-I11)', async () => {
    const { pg, fechar } = await abrir(url(achar(pgGovbr, '01_Gestão_Parceiras')));
    const selos = await pg.$$eval('.br-tag.selo', (l) => l.map((s) => `${s.textContent}:${[...s.classList].find((c) => c.startsWith('selo-'))}`));
    await fechar();
    expect(selos).toContain('Autorizada:selo-sucesso');
    expect(selos).toContain('Não autorizada:selo-erro');
    expect(selos).toContain('Aguardando análise:selo-aviso');
  });
});

comNavegador('protótipo clicável (CT-I08, CT-I09)', () => {
  it('Enviar leva ao sucesso; Simular erro leva ao erro; Voltar refaz o percurso; ação sem destino avisa', async () => {
    const { pg, fechar } = await abrir(url(achar(pgProprio, '01_Portal_Início')));
    await pg.click('[data-testid="01-portal-inicio-acao-contato"]');
    await pg.waitForURL(/03_Portal_Contato\/padrao\.html/);
    await pg.click('[data-testid="03-portal-contato-acao-enviar"]');
    await pg.waitForURL(/sucesso-1\.html/);
    await pg.click('[data-testid="prumo-barra-voltar"]');
    await pg.waitForURL(/03_Portal_Contato\/padrao\.html/);
    await pg.click('[data-testid="prumo-barra-simular"]');
    expect(await pg.getAttribute('[data-testid="prumo-barra-simular"]', 'aria-pressed')).toBe('true');
    await pg.click('[data-testid="03-portal-contato-acao-enviar"]');
    await pg.waitForURL(/erro-2\.html/);
    await pg.click('[data-testid="prumo-barra-voltar"]');
    await pg.waitForURL(/03_Portal_Contato\/padrao\.html/);
    await pg.click('[data-testid="prumo-barra-voltar"]');
    await pg.waitForURL(/01_Portal_In%C3%ADcio\/padrao\.html|01_Portal_Início\/padrao\.html/);
    await fechar();
  });

  it('com #captura a barra não aparece; aberta direto, aparece', async () => {
    const p = achar(pgProprio, '03_Portal_Contato');
    const a = await abrir(url(p) + '#captura');
    expect(await a.pg.$('[data-testid="prumo-barra"]')).toBeNull();
    await a.fechar();
    const b = await abrir(url(p));
    expect(await b.pg.$('[data-testid="prumo-barra"]')).not.toBeNull();
    await b.fechar();
  });
});
