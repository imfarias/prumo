import { readFile } from 'node:fs/promises';
import { BrowserWindow, session } from 'electron';
import { arquivoAxe, type Navegador, type ResultadoAxe } from '@prumo/motor';

/**
 * Porta Navegador com o Chromium do Electron (RN-71). Janela fora da tela (`offscreen`) porque janela oculta
 * comum não gera quadros: fontes e captura travam (sondagem do desenho técnico).
 */
export class NavegadorElectron implements Navegador {
  private janelas: BrowserWindow[] = [];
  private livres: BrowserWindow[] = [];
  private esperando: ((j: BrowserWindow) => void)[] = [];
  private inicio = 0;
  private static rede = false;
  private static fora: string[] = [];

  constructor(private readonly quantidade = 2) {}

  async abrir() {
    const s = session.fromPartition('prumo-render');
    if (!NavegadorElectron.rede) {
      NavegadorElectron.rede = true;
      s.webRequest.onBeforeRequest((d, cb) => {
        const ok = /^(file|data|blob|devtools|chrome-extension):/.test(d.url);
        if (!ok) NavegadorElectron.fora.push(d.url);
        cb({ cancel: !ok });
      });
    }
    this.inicio = NavegadorElectron.fora.length;
    for (let i = 0; i < this.quantidade; i++) {
      const j = new BrowserWindow({
        show: false,
        width: 1440,
        height: 900,
        useContentSize: true,
        webPreferences: { offscreen: true, backgroundThrottling: false, session: s, sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, spellcheck: false },
      });
      j.webContents.setFrameRate(30);
      j.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      j.webContents.on('will-navigate', (e, url) => !url.startsWith('file:') && e.preventDefault());
      this.janelas.push(j);
      this.livres.push(j);
    }
  }

  private pegar(): Promise<BrowserWindow> {
    const j = this.livres.pop();
    return j ? Promise.resolve(j) : new Promise((r) => this.esperando.push(r));
  }

  private devolver(j: BrowserWindow) {
    const prox = this.esperando.shift();
    if (prox) prox(j);
    else this.livres.push(j);
  }

  private async carregar(j: BrowserWindow, url: string, largura: number, altura = 900) {
    j.setContentSize(largura, altura);
    await j.loadURL(url);
    await j.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  }

  async capturar(url: string, o: { largura: number; altura?: number }): Promise<Buffer> {
    const j = await this.pegar();
    try {
      await this.carregar(j, url, o.largura, o.altura ?? 900);
      const h = Math.max(o.altura ?? 900, Number(await j.webContents.executeJavaScript('Math.ceil(document.documentElement.scrollHeight)')));
      j.setContentSize(o.largura, h);
      await j.webContents.executeJavaScript('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');
      await new Promise((r) => setTimeout(r, 120));
      const img = await j.webContents.capturePage({ x: 0, y: 0, width: o.largura, height: h });
      return img.toPNG();
    } finally {
      this.devolver(j);
    }
  }

  async pdf(url: string, o: { paisagem?: boolean; rodape?: string }): Promise<Buffer> {
    const j = await this.pegar();
    try {
      await this.carregar(j, url, 1200);
      return await j.webContents.printToPDF({
        pageSize: 'A4',
        landscape: !!o.paisagem,
        printBackground: true,
        displayHeaderFooter: !!o.rodape,
        headerTemplate: '<span></span>',
        footerTemplate: o.rodape ?? '<span></span>',
        margins: { top: 0.63, bottom: 0.79, left: 0.55, right: 0.55 },
      });
    } finally {
      this.devolver(j);
    }
  }

  async axe(url: string, o: { largura?: number } = {}): Promise<ResultadoAxe> {
    const j = await this.pegar();
    try {
      await this.carregar(j, url, o.largura ?? 1440);
      const fonte = await readFile(arquivoAxe(), 'utf8');
      await j.webContents.executeJavaScript(`${fonte};true`);
      const r = (await j.webContents.executeJavaScript(
        "axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }).then((r) => r.violations.map((v) => ({ id: v.id, impacto: v.impact, descricao: v.help, alvos: v.nodes.map((n) => n.target.join(' ')) })))",
      )) as ResultadoAxe['violacoes'];
      return { violacoes: r };
    } finally {
      this.devolver(j);
    }
  }

  bloqueados() {
    return NavegadorElectron.fora.slice(this.inicio);
  }

  async fechar() {
    for (const j of this.janelas) if (!j.isDestroyed()) j.destroy();
    this.janelas = [];
    this.livres = [];
  }
}
