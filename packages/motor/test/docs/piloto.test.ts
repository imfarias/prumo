import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { gerarDocumentacao, type ResultadoDocs } from '../../src/docs/gerar.js';
import { lancarChromium } from '../../src/navegador/playwright.js';
import { lerFeatures } from '../../src/parser/ler.js';

/**
 * Piloto real (CA-02, CA-03, CA-07). Não roda no CI: o material do cliente não está no repositório.
 * PRUMO_PILOTO=<pasta Especificações> e, opcional, PRUMO_PILOTO_PIRILAMPO=<html/index.html do Pirilampo>.
 */
const specs = process.env.PRUMO_PILOTO;
const pirilampo = process.env.PRUMO_PILOTO_PIRILAMPO ?? (specs ? path.join(specs, '..', 'html', 'index.html') : undefined);
vi.setConfig({ testTimeout: 600_000, hookTimeout: 600_000 });

describe.skipIf(!specs)('piloto (Vale-Cultura)', () => {
  let r: ResultadoDocs;
  let temp: string;
  beforeAll(async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'prumo-piloto-'));
    r = await gerarDocumentacao(specs!, { saida: temp });
  });
  afterAll(() => rm(temp, { recursive: true, force: true }));

  it.skipIf(!pirilampo || !existsSync(pirilampo))('tudo o que o Pirilampo mostra está na documentação (RN-53)', async () => {
    const antigo = await readFile(pirilampo!, 'latin1');
    const corrigir = (t: string) => Buffer.from(t, 'latin1').toString('utf8').normalize('NFC');
    const templates = [...antigo.matchAll(/<script type="text\/ng-template" id="([^"]+)\.html">([\s\S]*?)<\/script>/g)]
      .map((m) => ({ endereco: corrigir(m[1]!), html: m[2]! }))
      .filter((t) => !['index', 'html', 'layout-modal'].includes(t.endereco) && !t.endereco.startsWith('master_'));
    expect(templates.length).toBe(44);
    for (const t of templates) {
      const pg = r.documentacao.paginas.find((x) => x.endereco === t.endereco);
      expect(pg, t.endereco).toBeDefined();
      const cenarios = new Set([...t.html.matchAll(/id="scenario-(\d+)"/g)].map((m) => Number(m[1])));
      expect(pg!.filhos.map((f) => f.posicao).sort((a, b) => a - b), t.endereco).toEqual([...cenarios].sort((a, b) => a - b));
      const tabelasAntigas = (t.html.match(/<table/g) ?? []).length;
      const tabelasNovas = pg!.filhos.reduce((s, f) => s + f.passos.filter((x) => x.tabela).length + f.exemplos.length, 0);
      expect(tabelasNovas, t.endereco).toBeGreaterThanOrEqual(tabelasAntigas);
      const imagens = (t.html.match(/<img(?![^>]*class="logo")/g) ?? []).length;
      if (imagens) expect(pg!.prototipo ?? pg!.filhos.some((f) => f.descricaoHtml.includes('<img')), t.endereco).toBeTruthy();
    }
  });

  it('todo link das features abre o destino certo (CA-02)', async () => {
    const { arquivos } = await lerFeatures(specs!);
    const links = [...new Map(arquivos.flatMap((a) => a.links).map((l) => [`#${l.alvo}`, l])).values()];
    const browser = await lancarChromium();
    try {
      const pg = await browser.newPage();
      const base = pathToFileURL(path.join(temp, 'index.html')).href;
      const falhas: string[] = [];
      for (const l of links) {
        await pg.goto(base + `#${l.alvo}`);
        await pg.waitForLoadState('load');
        const art = await pg.getAttribute('article.funcionalidade', 'data-endereco').catch(() => null);
        const ok = art === l.endereco.normalize('NFC') && (l.posicao === undefined || (await pg.getAttribute('.cenario.destacado', 'id')) === `c-${l.posicao}`);
        if (!ok) falhas.push(l.alvo);
      }
      expect(falhas).toEqual([]);
      expect(links.length).toBeGreaterThan(100);
    } finally {
      await browser.close();
    }
  });

  it('busca no piloto em menos de 200 ms (CA-07)', async () => {
    const browser = await lancarChromium();
    try {
      const pg = await browser.newPage();
      await pg.goto(pathToFileURL(path.join(temp, 'index.html')).href);
      const tempos = await pg.evaluate(() => {
        const busca = (window as unknown as { prumoBuscar: (q: string) => unknown[] }).prumoBuscar;
        busca('x');
        const qs = ['beneficiaria', 'certificado', 'cnpj receita', 'faixa salarial', 'responsavel', 'senha', 'analisar', 'divulgacao', 'telefone sac', 'relatorio'];
        return Array.from({ length: 50 }, (_, i) => {
          const t0 = performance.now();
          busca(qs[i % qs.length]!);
          return performance.now() - t0;
        }).sort((a, b) => a - b);
      });
      expect(tempos[47]!).toBeLessThan(200);
    } finally {
      await browser.close();
    }
  });
});
