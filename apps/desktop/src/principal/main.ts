import { existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, Menu, nativeTheme } from 'electron';

// Recursos do motor (kits, fontes, axe) fora do pacote; antes de qualquer uso do motor.
const AQUI = path.dirname(fileURLToPath(import.meta.url));
process.env.PRUMO_RECURSOS = app.isPackaged ? path.join(process.resourcesPath, 'recursos') : path.join(AQUI, 'recursos');

const { Atualizador, formatoInstalado } = await import('./atualizacao.js');
const { registrarIpc } = await import('./ipc.js');
const { ArmazemPreferencias } = await import('./preferencias.js');
const { PreviaAoVivo } = await import('./previa.js');
const { atenderProtocolo, registrarEsquema } = await import('./protocolo.js');
const { iniciarRegistro, registrar } = await import('./registro.js');
const { blindar, negarPermissoes, PREFERENCIAS_WEB } = await import('./seguranca.js');
const { Servicos } = await import('./servicos.js');
const { NavegadorElectron } = await import('./navegador-electron.js');

registrarEsquema();

const userData = process.env.PRUMO_USERDATA ?? app.getPath('userData');
if (process.env.PRUMO_USERDATA) app.setPath('userData', userData);
iniciarRegistro(path.join(userData, 'logs'));
const prefs = new ArmazemPreferencias(path.join(userData, 'preferencias.json'));

/** Pasta pedida na linha de comando ("Abrir com o Prumo", FA-10). */
function pastaDosArgumentos(argv: string[]): string | undefined {
  const proprio = app.isPackaged ? undefined : path.resolve(app.getAppPath());
  return argv.slice(1).find((a) => !a.startsWith('-') && path.resolve(a) !== proprio && existsSync(a) && statSync(a).isDirectory());
}

const verificacao = process.argv.find((a) => a.startsWith('--verificar-instalacao'));
if (!verificacao && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let janela: BrowserWindow | undefined;
  const ARQ_JANELA = path.join(AQUI, 'janela', 'index.html');
  const ORIGEM = pathToFileURL(path.dirname(ARQ_JANELA)).href;
  // Eventos enviados antes de a janela registrar os ouvintes se perderiam; ficam guardados até 'janela:pronta'.
  let pronta = false;
  const guardados: [string, unknown][] = [];
  const enviar = (evento: string, dados: unknown) => {
    if (pronta) janela?.webContents.send(evento, dados);
    else guardados.push([evento, dados]);
  };
  const aoFicarPronta = () => {
    pronta = true;
    for (const [e, d] of guardados.splice(0)) janela?.webContents.send(e, d);
  };
  const servicos = new Servicos(prefs, path.join(userData, 'projetos'), enviar);
  const previa = new PreviaAoVivo(servicos, enviar);

  // Nos testes (não empacotado) o formato pode ser fixado para exercitar o download da atualização.
  const formato = (!app.isPackaged && (process.env.PRUMO_FORMATO as ReturnType<typeof formatoInstalado> | undefined)) || formatoInstalado(process.execPath);
  let atualizador: InstanceType<typeof Atualizador> | undefined;
  const obterAtualizador = () =>
    (atualizador ??= new Atualizador({ versaoAtual: app.getVersion(), url: process.env.PRUMO_ATUALIZACAO_URL || prefs.get().atualizacao.url, formato, pasta: path.join(userData, 'atualizacoes') }));
  const baixarAtualizacao = async () => {
    const arq = await obterAtualizador().baixar((feito, total) => enviar('tarefa:andamento', { id: 'atualizacao', tipo: 'atualizacao', etapa: 'Baixando a atualização', feito, total, estado: 'rodando' }));
    return { arquivo: path.basename(arq) };
  };

  app.on('second-instance', (_e, argv) => {
    const pasta = pastaDosArgumentos(argv);
    if (pasta) servicos.liberados.add(path.resolve(pasta));
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
      if (pasta) enviar('projeto:abrirPedido', { caminho: pasta });
    }
  });

  // Na verificação só há janelas fora da tela; fechá-las não pode encerrar antes do resultado.
  app.on('window-all-closed', () => {
    if (!verificacao) app.quit();
  });

  // Com ESM o Electron só emite 'ready' depois do script principal terminar; esperar aqui travaria.
  void app.whenReady().then(async () => {
    negarPermissoes();
    atenderProtocolo();
    Menu.setApplicationMenu(null);

    if (verificacao) {
      // Verificação da instalação (CI dos instaladores): motor carregado + captura no Chromium embutido.
      const destino = verificacao.split('=')[1];
      try {
        const nav = new NavegadorElectron(1);
        await nav.abrir();
        const png = await nav.capturar('data:text/html;charset=utf-8,<h1 style="font-family:sans-serif">Prumo ok</h1>', { largura: 400, altura: 200 });
        await nav.fechar();
        const motor = await import('@prumo/motor');
        const texto = `ok ${app.getVersion()} motor ${motor.VERSAO_MOTOR} png ${png.length}\n`;
        if (destino) await writeFile(destino, texto);
        process.stdout.write(texto);
        app.exit(png.length > 100 ? 0 : 1);
      } catch (e) {
        registrar('erro', 'verificação da instalação falhou', e);
        if (destino) await writeFile(destino, `erro ${(e as Error).message}\n`);
        app.exit(1);
      }
    } else {
      registrarIpc({ janela: () => janela, origem: ORIGEM, servicos, prefs, previa, atualizador: obterAtualizador, baixarAtualizacao, aoFicarPronta });
      janela = new BrowserWindow({
        width: 1320,
        height: 860,
        minWidth: 900,
        minHeight: 600,
        show: false,
        title: 'Prumo',
        backgroundColor: nativeTheme.shouldUseDarkColors ? '#14181f' : '#ffffff',
        icon: path.join(AQUI, 'icone.png'),
        webPreferences: { ...PREFERENCIAS_WEB, preload: path.join(AQUI, 'preload.cjs') },
      });
      blindar(janela.webContents, ORIGEM);
      janela.once('ready-to-show', () => janela?.show());
      await janela.loadFile(ARQ_JANELA);
      const pasta = pastaDosArgumentos(process.argv);
      if (pasta) {
        servicos.liberados.add(path.resolve(pasta));
        enviar('projeto:abrirPedido', { caminho: pasta });
      }
      void verificarAtualizacao();
    }
  });

  async function verificarAtualizacao() {
    const p = prefs.get().atualizacao;
    if (!p.ligada || process.env.PRUMO_ATUALIZACAO === 'desligada') return;
    const dia = 86_400_000;
    if (p.ultimaVerificacao && Date.now() - Date.parse(p.ultimaVerificacao) < dia && !process.env.PRUMO_ATUALIZACAO_URL) return;
    if (p.lembrarDepoisAte && Date.now() < Date.parse(p.lembrarDepoisAte)) return;
    try {
      const info = await obterAtualizador().verificar();
      await prefs.mudar((x) => (x.atualizacao.ultimaVerificacao = new Date().toISOString()));
      if (info) enviar('atualizacao:disponivel', info);
    } catch (e) {
      registrar('aviso', 'verificação de atualização falhou (silenciosa)', (e as Error).message);
    }
  }
}
