import { app, BrowserWindow, dialog, session, shell, type WebContents } from 'electron';
import { registrar } from './registro.js';

/** CSP das telas do programa (RN-72). */
export const CSP_JANELA =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: prumo-arquivo:; font-src 'self'; frame-src prumo-arquivo:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

export const PREFERENCIAS_WEB = {
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  nodeIntegrationInSubFrames: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  spellcheck: false,
} as const;

/** Nada navega para fora do programa; links https abrem no navegador do sistema, com confirmação. */
export function blindar(wc: WebContents, origem: string) {
  wc.on('will-navigate', (e, url) => {
    if (!url.startsWith(origem)) {
      e.preventDefault();
      registrar('aviso', `navegação bloqueada: ${url.slice(0, 200)}`);
    }
  });
  wc.on('will-attach-webview', (e) => e.preventDefault());
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void abrirExterno(url);
    return { action: 'deny' };
  });
}

export async function abrirExterno(url: string) {
  const janela = BrowserWindow.getFocusedWindow();
  const opcoes = { type: 'question' as const, buttons: ['Abrir no navegador', 'Cancelar'], defaultId: 0, cancelId: 1, message: 'Abrir este endereço no navegador?', detail: url };
  const { response } = janela ? await dialog.showMessageBox(janela, opcoes) : await dialog.showMessageBox(opcoes);
  if (response === 0) await shell.openExternal(url);
}

/** Permissões (câmera, notificações, etc.) negadas em todas as sessões do programa. */
export function negarPermissoes() {
  for (const s of [session.defaultSession, session.fromPartition('prumo-render')]) {
    s.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
    s.setPermissionCheckHandler(() => false);
  }
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-attach-webview', (ev) => ev.preventDefault());
  });
}
