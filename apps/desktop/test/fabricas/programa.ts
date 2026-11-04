import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, type ElectronApplication, type Page } from 'playwright-core';
import { APP_DESKTOP, caminhoDoElectron } from './electron.js';

const require = createRequire(import.meta.url);
export const EXEMPLO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../exemplos/exemplo-ficticio');
export const EDITOR_FALSO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'editor-falso.mjs');

export interface Programa {
  app: ElectronApplication;
  w: Page;
  raiz: string;
  specs: string;
  userData: string;
  editorSaida: string;
  /** Endereços que a janela pediu (para provar que nada sai para a rede). */
  pedidos: string[];
  erros: string[];
  abrirExemplo(): Promise<void>;
  ir(tela: string): Promise<void>;
  /** Espera a tarefa acabar e devolve o texto da mensagem. */
  aguardarTarefa(): Promise<string>;
  mensagem(): Promise<string>;
  axe(): Promise<{ id: string; impact: string; nodes: number }[]>;
  fechar(): Promise<void>;
}

/**
 * Abre o programa (dist/) com um projeto de exemplo copiado, userData próprio e diálogos com respostas fixas.
 * `dialogos` segue PRUMO_TESTE_DIALOGOS: { abrirPasta: [...], escolherPasta: [...], salvarComo: [...] }.
 */
export async function abrirPrograma(o: { dialogos?: Record<string, string[]> | ((pastas: { specs: string; raiz: string }) => Record<string, string[]>); env?: Record<string, string>; preparar?: (specs: string) => Promise<void>; semProjeto?: boolean } = {}): Promise<Programa> {
  const raiz = await mkdtemp(path.join(tmpdir(), 'prumo-e2e-'));
  const specs = path.join(raiz, '3 - Requisitos', 'Especificações');
  if (!o.semProjeto) await cp(EXEMPLO, specs, { recursive: true });
  await o.preparar?.(specs);
  const userData = path.join(raiz, 'userData');
  const editorSaida = path.join(raiz, 'editor.txt');
  const dialogos = { abrirPasta: [specs], ...(typeof o.dialogos === 'function' ? o.dialogos({ specs, raiz }) : o.dialogos) };
  const app = await _electron.launch({
    executablePath: caminhoDoElectron(),
    args: [APP_DESKTOP],
    env: {
      ...(process.env as Record<string, string>),
      PRUMO_USERDATA: userData,
      PRUMO_TESTE_DIALOGOS: JSON.stringify(dialogos),
      PRUMO_EDITOR_TESTE: EDITOR_FALSO,
      PRUMO_EDITOR_SAIDA: editorSaida,
      PRUMO_ATUALIZACAO: 'desligada',
      ...o.env,
    },
  });
  const w = await app.firstWindow();
  const pedidos: string[] = [];
  const erros: string[] = [];
  w.on('request', (r) => pedidos.push(r.url()));
  w.on('pageerror', (e) => erros.push(e.message));
  w.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });
  await w.waitForSelector('[data-testid="projetos-abrir"]');
  const p: Programa = {
    app,
    w,
    raiz,
    specs,
    userData,
    editorSaida,
    pedidos,
    erros,
    async abrirExemplo() {
      await w.click('[data-testid="projetos-abrir"]');
      await w.waitForSelector('[data-testid="app-projeto"]');
    },
    async ir(tela) {
      await w.click(`[data-testid="app-menu-${tela}"]`);
      await w.waitForFunction((t) => document.querySelector(`[data-testid="app-menu-${t}"]`)?.getAttribute('aria-current') === 'page', tela);
    },
    async aguardarTarefa() {
      await w.waitForFunction(() => !document.querySelector('[data-testid="tarefa-andamento"] [data-testid="tarefa-cancelar"]'), null, { timeout: 120_000 });
      return p.mensagem();
    },
    async mensagem() {
      return (await w.locator('[data-testid="app-mensagem"]').textContent({ timeout: 5000 })) ?? '';
    },
    async axe() {
      const fonte = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
      await w.evaluate(fonte);
      return w.evaluate(async () => {
        // @ts-expect-error axe é injetado acima
        const r = await window.axe.run(document, { resultTypes: ['violations'] });
        return (r.violations as { id: string; impact: string; nodes: unknown[] }[]).map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
      });
    },
    async fechar() {
      await app.close().catch(() => undefined);
      await rm(raiz, { recursive: true, force: true, maxRetries: 5 }).catch(() => undefined);
    },
  };
  return p;
}
