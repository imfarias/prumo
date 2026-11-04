import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Browser, BrowserContext } from 'playwright-core';
import { arquivoAxe } from '../util/recursos.js';
import { ErroPrumo } from '../util/erros.js';
import type { Navegador, ResultadoAxe } from './navegador.js';

export const MENSAGEM_SEM_NAVEGADOR =
  'Nenhum Chrome, Edge ou Chromium encontrado. Instale o Edge ou o Chrome, defina PRUMO_CHROMIUM com o caminho do executável, ou rode pela imagem Docker.';

/** Ordem: PRUMO_CHROMIUM → Edge → Chrome (desenho técnico, seção 7). */
export async function lancarChromium(canais: string[] = ['msedge', 'chrome']): Promise<Browser> {
  // Importado sob demanda: o programa de computador não inclui o playwright-core (usa o Chromium do Electron).
  const { chromium } = await import('playwright-core');
  const exe = process.env.PRUMO_CHROMIUM;
  if (exe) {
    if (!existsSync(exe)) throw new ErroPrumo('CLI-05', `PRUMO_CHROMIUM aponta para ${exe}, que não existe. ${MENSAGEM_SEM_NAVEGADOR}`);
    return chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--font-render-hinting=none'] });
  }
  for (const channel of canais) {
    try {
      return await chromium.launch({ channel, args: ['--font-render-hinting=none'] });
    } catch {
      // tenta o próximo
    }
  }
  throw new ErroPrumo('CLI-05', MENSAGEM_SEM_NAVEGADOR);
}

export class NavegadorPlaywright implements Navegador {
  private browser?: Browser;
  private contexto?: BrowserContext;
  private contextoAxe?: BrowserContext;
  private fora: string[] = [];

  constructor(private readonly canais?: string[]) {}

  async abrir() {
    this.browser = await lancarChromium(this.canais);
  }

  private async novoContexto(bypassCSP: boolean) {
    const c = await this.browser!.newContext({ deviceScaleFactor: 1, bypassCSP, locale: 'pt-BR', reducedMotion: 'reduce' });
    await c.route('**/*', (rota) => {
      const url = rota.request().url();
      if (url.startsWith('file:') || url.startsWith('data:')) return rota.continue();
      this.fora.push(url);
      return rota.abort();
    });
    return c;
  }

  async capturar(url: string, o: { largura: number; altura?: number }): Promise<Buffer> {
    this.contexto ??= await this.novoContexto(false);
    const p = await this.contexto.newPage();
    await p.setViewportSize({ width: o.largura, height: o.altura ?? 900 });
    try {
      await p.goto(url, { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready.then(() => undefined));
      return await p.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
    } finally {
      await p.close();
    }
  }

  async axe(url: string, o: { largura?: number } = {}): Promise<ResultadoAxe> {
    this.contextoAxe ??= await this.novoContexto(true);
    const p = await this.contextoAxe.newPage();
    await p.setViewportSize({ width: o.largura ?? 1440, height: 900 });
    try {
      await p.goto(url, { waitUntil: 'load' });
      await p.addScriptTag({ content: await readFile(arquivoAxe(), 'utf8') });
      const r = await p.evaluate(async () => {
        const axe = (globalThis as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; impact: string | null; help: string; nodes: { target: string[] }[] }[] }> } }).axe;
        return axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
      });
      return { violacoes: r.violations.map((v) => ({ id: v.id, impacto: v.impact, descricao: v.help, alvos: v.nodes.map((n) => n.target.join(' ')) })) };
    } finally {
      await p.close();
    }
  }

  async pdf(url: string, o: { paisagem?: boolean; rodape?: string }): Promise<Buffer> {
    this.contexto ??= await this.novoContexto(false);
    const p = await this.contexto.newPage();
    try {
      await p.goto(url, { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready.then(() => undefined));
      return await p.pdf({
        format: 'A4',
        landscape: !!o.paisagem,
        printBackground: true,
        displayHeaderFooter: !!o.rodape,
        headerTemplate: '<span></span>',
        footerTemplate: o.rodape ?? '<span></span>',
        margin: { top: '16mm', bottom: '20mm', left: '14mm', right: '14mm' },
      });
    } finally {
      await p.close();
    }
  }

  bloqueados() {
    return [...this.fora];
  }

  async fechar() {
    await this.browser?.close();
  }
}
