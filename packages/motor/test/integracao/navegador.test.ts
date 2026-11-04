import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compararComAtuais, gerar, gerarECapturar } from '../../src/executar.js';
import { lancarChromium, NavegadorPlaywright } from '../../src/navegador/playwright.js';
import type { PaginaGerada } from '../../src/render/gerar.js';
import { criarProjeto, EXEMPLO, type ProjetoTemp } from '../fabricas/projeto.js';

/**
 * Testes com o Chromium real. Pulados só se não houver navegador na máquina;
 * no CI o Chromium é instalado e PRUMO_EXIGIR_NAVEGADOR=1 transforma a ausência em falha.
 */
let browser: Browser | undefined;
try {
  browser = await lancarChromium();
} catch (e) {
  if (process.env.PRUMO_EXIGIR_NAVEGADOR) throw e;
}
const comNavegador = describe.skipIf(!browser);
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let p: ProjetoTemp;
let paginas: PaginaGerada[];
const saida = () => path.join(p.dir, '..', 'saida', 'prototipos');

beforeAll(async () => {
  if (!browser) return;
  p = await criarProjeto();
  paginas = (await gerar(p.dir, { saida: saida() })).paginas;
});
afterAll(async () => {
  await browser?.close();
  await p?.limpar();
});

async function abrir(arquivo: string, largura = 1440) {
  const ctx = await browser!.newContext({ viewport: { width: largura, height: 900 } });
  const fora: string[] = [];
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
    fora.push(u);
    return r.abort();
  });
  const pg = await ctx.newPage();
  await pg.goto(pathToFileURL(arquivo).href);
  await pg.evaluate(() => document.fonts.ready.then(() => undefined));
  return { pg, fora, fechar: () => ctx.close() };
}

comNavegador('páginas geradas (CT-P01 a CT-P08, CA-10)', () => {
  it('axe sem violações sérias ou críticas em todas as telas e estados (CT-P07)', async () => {
    const nav = new NavegadorPlaywright();
    await nav.abrir();
    try {
      const problemas: string[] = [];
      for (const pg of paginas) {
        const r = await nav.axe(pathToFileURL(pg.arquivo).href);
        for (const v of r.violacoes.filter((x) => x.impacto === 'serious' || x.impacto === 'critical')) {
          problemas.push(`${pg.tela}/${pg.estado}: ${v.id} (${v.impacto}) em ${v.alvos.slice(0, 3).join(', ')}`);
        }
      }
      expect(problemas).toEqual([]);
    } finally {
      await nav.fechar();
    }
  });

  it('todo campo tem rótulo ligado e obrigatório com aria-required (CT-P01, CT-P02)', async () => {
    for (const pg of paginas.filter((x) => x.estado === 'padrao')) {
      const { pg: page, fechar } = await abrir(pg.arquivo);
      const r = await page.evaluate(() => {
        const campos = [...document.querySelectorAll('input:not([type=file]), select, textarea, output')];
        const semRotulo = campos.filter((c) => !c.id || !document.querySelector(`label[for="${CSS.escape(c.id)}"]`)).map((c) => c.outerHTML.slice(0, 80));
        const marcas = [...document.querySelectorAll('label .obrig')].map((m) => m.closest('label')!.getAttribute('for'));
        const semAria = marcas.filter((id) => document.getElementById(id!)?.getAttribute('aria-required') !== 'true');
        return { semRotulo, semAria, ocultas: [...document.querySelectorAll('.obrig')].every((m) => m.getAttribute('aria-hidden') === 'true') };
      });
      expect(r, pg.tela).toEqual({ semRotulo: [], semAria: [], ocultas: true });
      await fechar();
    }
  });

  it('estado de erro: resumo role=alert com links e campo com aria-describedby válido (CT-P03)', async () => {
    const pg = paginas.find((x) => x.tela === '03_Portal_Contato' && x.estado === 'erro-2')!;
    const { pg: page, fechar } = await abrir(pg.arquivo);
    const r = await page.evaluate(() => {
      const resumo = document.querySelector('[data-testid="03-portal-contato-resumo-erros"]');
      const link = resumo?.querySelector('a')?.getAttribute('href');
      const campo = document.getElementById((link ?? '#x').slice(1));
      const desc = campo?.getAttribute('aria-describedby');
      return { role: resumo?.getAttribute('role'), link, invalido: campo?.getAttribute('aria-invalid'), descricaoExiste: !!(desc && document.getElementById(desc)) };
    });
    expect(r).toEqual({ role: 'alert', link: '#03-portal-contato-confirme-o-e-mail', invalido: 'true', descricaoExiste: true });
    await fechar();
  });

  it('estado vazio com role=status (CT-P04)', async () => {
    const pg = paginas.find((x) => x.tela === '01_Gestão_Parceiras' && x.estado === 'vazio')!;
    const { pg: page, fechar } = await abrir(pg.arquivo);
    expect(await page.getAttribute('[data-testid="01-gestao-parceiras-vazio"]', 'role')).toBe('status');
    await fechar();
  });

  it('teclado: Tab segue a ordem do documento e o foco é visível (CT-P05)', async () => {
    const pg = paginas.find((x) => x.tela === '03_Portal_Contato' && x.estado === 'padrao')!;
    const { pg: page, fechar } = await abrir(pg.arquivo);
    const esperada = await page.evaluate(() =>
      [...document.querySelectorAll('a[href], button, input:not([type=file]):not([type=hidden]), select, textarea')].map((e) => e.id || e.textContent!.trim()),
    );
    const visitados: string[] = [];
    for (let i = 0; i < esperada.length; i++) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement;
        const s = getComputedStyle(e);
        return { id: e.id || e.textContent!.trim(), contorno: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 };
      });
      expect(r.contorno, `foco visível em ${r.id}`).toBe(true);
      visitados.push(r.id);
    }
    expect(visitados).toEqual(esperada);
    await fechar();
  });

  it('casca autenticada: item atual do menu com aria-current (CT-P06)', async () => {
    const pg = paginas.find((x) => x.tela === '01_Gestão_Parceiras' && x.estado === 'padrao')!;
    const { pg: page, fechar } = await abrir(pg.arquivo);
    expect(await page.textContent('[data-testid="casca-menu"] [aria-current="page"]')).toBe('Gestão de Parceiras');
    await fechar();
  });

  it('fontes embutidas carregadas sem nenhuma requisição de rede (CT-P08, CT-I21, CA-12)', async () => {
    for (const pg of paginas) {
      const { pg: page, fora, fechar } = await abrir(pg.arquivo);
      const fontes = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
      if (pg.estado === 'padrao') expect(new Set(fontes)).toEqual(new Set(['Jost', 'Atkinson Hyperlegible']));
      expect(fora).toEqual([]);
      await fechar();
    }
  });

  it('sem rolagem horizontal a 1440 px', async () => {
    for (const pg of paginas) {
      const { pg: page, fechar } = await abrir(pg.arquivo);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${pg.tela}/${pg.estado}`).toBeLessThanOrEqual(1440);
      await fechar();
    }
  });
});

comNavegador('captura (CT-I20, CT-I22, CT-P09)', () => {
  it('grava os PNGs ao lado das features, a 1440 px, e não regrava sem mudança', async () => {
    const q = await criarProjeto({ semPngs: true });
    try {
      const r1 = await gerarECapturar(q.dir, { saida: path.join(q.dir, '..', 'saida') });
      expect(r1.capturas.map((c) => c.situacao)).toEqual(Array(7).fill('gravado'));
      expect(r1.bloqueados).toEqual([]);
      const png = PNG.sync.read(await readFile(path.join(q.dir, '01_Portal', '02_Portal_Lista_Parceiras.png')));
      expect(png.width).toBe(1440);
      const antes = (await stat(path.join(q.dir, '05_API', '01_API_Indicadores.png'))).mtimeMs;
      const r2 = await gerarECapturar(q.dir, { saida: path.join(q.dir, '..', 'saida') });
      expect(r2.capturas.map((c) => c.situacao)).toEqual(Array(7).fill('sem-mudanca'));
      expect((await stat(path.join(q.dir, '05_API', '01_API_Indicadores.png'))).mtimeMs).toBe(antes);
    } finally {
      await q.limpar();
    }
  });

  it('PNGs do exemplo batem com a referência aprovada (tolerância 0,5% dos pixels)', async () => {
    const q = await criarProjeto({ semPngs: true });
    try {
      await gerarECapturar(q.dir, { saida: path.join(q.dir, '..', 'saida') });
      const tolerancia = Number(process.env.PRUMO_TOLERANCIA_VISUAL ?? 0.5);
      for (const rel of ['01_Portal/02_Portal_Lista_Parceiras.png', '03_Cadastro/01_Parceira_Cadastrar.png', '04_Gestão/01_Gestão_Parceiras.png', '01_Portal/03_Portal_Contato.png']) {
        const ref = PNG.sync.read(await readFile(path.join(EXEMPLO, rel)));
        const novo = PNG.sync.read(await readFile(path.join(q.dir, rel)));
        expect([novo.width, novo.height], rel).toEqual([ref.width, ref.height]);
        const n = pixelmatch(ref.data, novo.data, null, ref.width, ref.height, { threshold: 0.1 });
        expect((n / (ref.width * ref.height)) * 100, rel).toBeLessThanOrEqual(tolerancia);
      }
    } finally {
      await q.limpar();
    }
  });

  it('comparar-png gera o relatório com % por tela (CA-13)', async () => {
    const q = await criarProjeto();
    try {
      await q.substituir('projeto.yml', 'primaria: "#1D3F8F"', 'primaria: "#8F1D3F"');
      const rel = path.join(q.dir, '..', 'comparacao');
      const r = await compararComAtuais(q.dir, { saida: rel });
      expect(r.itens).toHaveLength(7);
      expect(r.itens.find((i) => i.tela === '02_Portal_Lista_Parceiras')!.diferenca).toBeGreaterThan(0);
      expect(existsSync(r.relatorio)).toBe(true);
      expect(await readFile(r.relatorio, 'utf8')).toContain('% diferente');
    } finally {
      await q.limpar();
    }
  });
});
