import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, dialog, ipcMain, shell, type BrowserWindow, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { ErroPrumo, VERSAO_MOTOR } from '@prumo/motor';
import { ErroCanal, ehCanal, validar, type Canal, type DadosDe } from '../comum/canais.js';
import type { Sobre } from '../comum/tipos.js';
import type { Atualizador } from './atualizacao.js';
import { comandoDoEditor, rodar } from './editor.js';
import { definirMenuContexto } from './menu-contexto.js';
import type { ArmazemPreferencias } from './preferencias.js';
import type { PreviaAoVivo } from './previa.js';
import { abrirExterno } from './seguranca.js';
import { caminhoRegistro, registrar } from './registro.js';
import type { Servicos } from './servicos.js';
import { urlDe } from './protocolo.js';

interface Contexto {
  janela: () => BrowserWindow | undefined;
  origem: string;
  servicos: Servicos;
  prefs: ArmazemPreferencias;
  previa: PreviaAoVivo;
  atualizador: () => Atualizador;
  baixarAtualizacao: () => Promise<{ arquivo: string }>;
  /** A janela registrou os ouvintes: os eventos guardados até aqui podem ir. */
  aoFicarPronta: () => void;
}

/** Diálogos nativos; nos testes (programa não empacotado) respostas fixas de PRUMO_TESTE_DIALOGOS. */
const filaTeste: Record<string, string[]> | undefined = !app.isPackaged && process.env.PRUMO_TESTE_DIALOGOS ? JSON.parse(process.env.PRUMO_TESTE_DIALOGOS) : undefined;
function respostaTeste(tipo: string): string | undefined | null {
  if (!filaTeste) return null;
  return filaTeste[tipo]?.shift();
}

async function escolher(j: BrowserWindow | undefined, o: OpenDialogOptions, tipo: string): Promise<string | undefined> {
  const t = respostaTeste(tipo);
  if (t !== null) return t;
  const r = j ? await dialog.showOpenDialog(j, o) : await dialog.showOpenDialog(o);
  return r.canceled ? undefined : r.filePaths[0];
}

async function salvarComo(j: BrowserWindow | undefined, o: SaveDialogOptions): Promise<string | undefined> {
  const t = respostaTeste('salvarComo');
  if (t !== null) return t;
  const r = j ? await dialog.showSaveDialog(j, o) : await dialog.showSaveDialog(o);
  return r.canceled ? undefined : r.filePath;
}

export function registrarIpc(c: Contexto) {
  ipcMain.handle('prumo', async (e, canal: unknown, dados: unknown) => {
    // Só a janela do programa fala com o principal.
    const j = c.janela();
    if (!j || e.sender !== j.webContents || !e.senderFrame?.url.startsWith(c.origem)) throw new Error('remetente não autorizado');
    if (!ehCanal(canal)) throw new Error(`canal desconhecido: ${String(canal)}`);
    try {
      return await atender(c, canal, validar(canal, dados));
    } catch (erro) {
      if (erro instanceof ErroPrumo) throw new Error(`[${erro.codigo}] ${erro.message}`);
      if (erro instanceof ErroCanal) throw new Error(`[CANAL] ${erro.message}`);
      registrar('erro', `canal ${canal}`, erro);
      throw erro;
    }
  });
}

async function atender(c: Contexto, canal: Canal, d: unknown): Promise<unknown> {
  const s = c.servicos;
  const j = c.janela();
  switch (canal) {
    case 'projeto:abrirDialogo': {
      const pasta = await escolher(j, { title: 'Abrir pasta de especificações', properties: ['openDirectory'] }, 'abrirPasta');
      if (!pasta) return undefined;
      const v = await s.abrir(pasta);
      if (c.prefs.get().previaAoVivo) await c.previa.ligar(v.specs);
      return v;
    }
    case 'projeto:abrir': {
      // Abrir só lê; vale para recentes, pasta solta na janela e pasta entregue pelo sistema (botão direito).
      const { caminho } = d as DadosDe<'projeto:abrir'>;
      const v = await s.abrir(caminho);
      if (c.prefs.get().previaAoVivo) await c.previa.ligar(v.specs);
      return v;
    }
    case 'projeto:criar': {
      const dd = d as DadosDe<'projeto:criar'>;
      if (!s.liberado(dd.pasta)) throw new ErroPrumo('DSK-11', 'Escolha a pasta pelo botão.');
      const v = await s.criar(dd);
      if (c.prefs.get().previaAoVivo) await c.previa.ligar(v.specs);
      return v;
    }
    case 'projeto:atual':
      return s.preparado ? s.visao() : undefined;
    case 'projeto:recentes':
      return c.prefs.get().recentes.map((r) => ({ ...r, existe: existsSync(r.caminho) }));
    case 'projeto:esquecer':
      return (await c.prefs.esquecer((d as DadosDe<'projeto:esquecer'>).caminho)).recentes;
    case 'config:ler':
      return s.lerConfig((d as DadosDe<'config:ler'>).arquivo);
    case 'config:previa': {
      const dd = d as DadosDe<'config:previa'>;
      const r = s.previaConfig(dd.arquivo, dd.mudancas);
      return { diff: r.diff.filter((x) => x.tipo !== 'igual'), mudou: r.mudou };
    }
    case 'config:salvar':
      return s.salvarConfig(d as DadosDe<'config:salvar'>);
    case 'config:criarProjetoYml':
      return s.criarProjetoYml();
    case 'tarefa:iniciar': {
      const dd = d as DadosDe<'tarefa:iniciar'>;
      if (dd.tipo === 'capturar') {
        const terceiros = s.pngsDeTerceiros(dd.parametros);
        if (terceiros.length && !dd.parametros.forcar) return { confirmar: { quantidade: terceiros.length, exemplos: terceiros.slice(0, 5).map((x) => path.relative(s.specs, x)) } };
      }
      return s.iniciarTarefa(dd.tipo, dd.parametros);
    }
    case 'tarefa:cancelar':
      s.cancelar((d as DadosDe<'tarefa:cancelar'>).id);
      return true;
    case 'verificacao:abrirNoEditor': {
      const dd = d as DadosDe<'verificacao:abrirNoEditor'>;
      const arquivo = path.resolve(s.specs, dd.arquivo);
      if (!s.liberado(arquivo) || !existsSync(arquivo)) throw new ErroPrumo('DSK-11', 'Arquivo fora do projeto.');
      const cmd = comandoDoEditor(c.prefs.get().editor, arquivo, dd.linha);
      if (cmd && (await rodar(cmd))) return { abriu: 'editor' };
      const erro = await shell.openPath(arquivo);
      if (erro) throw new ErroPrumo('DSK-07', `Nenhum editor encontrado para abrir ${dd.arquivo}. Configure o editor em Preferências.`);
      return { abriu: 'sistema', linha: dd.linha };
    }
    case 'verificacao:exportar': {
      const destino = await salvarComo(j, { title: 'Exportar verificação', defaultPath: 'verificacao.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (!destino) return undefined;
      await writeFile(destino, s.exportarVerificacao(), 'utf8');
      return destino;
    }
    case 'prototipos:listar':
      return s.listarPrototipos();
    case 'docs:abrirNoNavegador': {
      const alvo = (d as DadosDe<'docs:abrirNoNavegador'>).alvo;
      const arq = alvo === 'docs' ? path.join(s.ultimaDocs ?? '', 'index.html') : alvo === 'prototipos' ? path.join(s.cache('prototipos'), 'index.html') : path.join(s.cache('comparacao-png'), 'index.html');
      if (!existsSync(arq)) throw new ErroPrumo('DSK-15', 'Ainda não há nada gerado para abrir.');
      await shell.openExternal(`file:///${arq.replace(/\\/g, '/').replace(/^\/+/, '')}`);
      return true;
    }
    case 'sistema:abrirPasta': {
      const alvo = (d as DadosDe<'sistema:abrirPasta'>).alvo;
      const mapa: Record<string, string | undefined> = {
        specs: s.specs, docs: s.ultimaDocs, prototipos: s.cache('prototipos'), comparacao: s.cache('comparacao-png'),
        pdf: s.pdfGerado ? path.dirname(s.pdfGerado) : undefined, registro: path.dirname(caminhoRegistro()),
      };
      const p = mapa[alvo];
      if (!p || !existsSync(p)) throw new ErroPrumo('DSK-15', 'Ainda não há nada gerado para abrir.');
      await shell.openPath(p);
      return true;
    }
    case 'sistema:abrirArquivo': {
      const alvo = (d as DadosDe<'sistema:abrirArquivo'>).alvo;
      const p = alvo === 'pdf' ? s.pdfGerado : path.join(s.specs, alvo);
      if (!p || !existsSync(p)) throw new ErroPrumo('DSK-15', 'Arquivo não encontrado.');
      const erro = await shell.openPath(p);
      if (erro) throw new Error(erro);
      return true;
    }
    case 'sistema:escolherPasta': {
      const p = await escolher(j, { title: (d as DadosDe<'sistema:escolherPasta'>).titulo, properties: ['openDirectory', 'createDirectory'] }, 'escolherPasta');
      if (p) s.liberados.add(path.resolve(p));
      return p;
    }
    case 'sistema:escolherArquivo': {
      const dd = d as DadosDe<'sistema:escolherArquivo'>;
      const p = await escolher(j, { title: dd.titulo, properties: ['openFile'], filters: dd.extensoes.length ? [{ name: 'Arquivos', extensions: dd.extensoes }] : [] }, 'escolherArquivo');
      if (p) s.liberados.add(path.resolve(p));
      return p;
    }
    case 'sistema:salvarComo': {
      const nome = (d as DadosDe<'sistema:salvarComo'>).nome;
      const p = await salvarComo(j, { title: 'Salvar como', defaultPath: path.join(s.preparado ? path.resolve(s.specs, '..') : app.getPath('documents'), nome) });
      if (p) s.liberados.add(path.resolve(p));
      return p;
    }
    case 'sistema:abrirLink':
      await abrirExterno((d as DadosDe<'sistema:abrirLink'>).url);
      return true;
    case 'comparar:refs':
      return s.refsGit();
    case 'prefs:ler':
      return c.prefs.get();
    case 'prefs:salvar': {
      const dd = d as Record<string, unknown>;
      const p = await c.prefs.mudar((x) => {
        if (dd.previaAoVivo !== undefined) x.previaAoVivo = dd.previaAoVivo as boolean;
        if (dd.tema !== undefined) x.tema = dd.tema as never;
        if (dd.editor !== undefined) x.editor = dd.editor as never;
        if (dd.atualizacaoLigada !== undefined) x.atualizacao.ligada = dd.atualizacaoLigada as boolean;
        if (dd.menuContexto !== undefined) x.menuContexto = dd.menuContexto as boolean;
      });
      if (dd.previaAoVivo === false) await c.previa.desligar();
      if (dd.previaAoVivo === true && s.preparado) await c.previa.ligar(s.specs);
      if (dd.menuContexto !== undefined) await definirMenuContexto(process.execPath, dd.menuContexto as boolean);
      return p;
    }
    case 'atualizacao:verificar': {
      const info = await c.atualizador().verificar();
      await c.prefs.mudar((x) => (x.atualizacao.ultimaVerificacao = new Date().toISOString()));
      return info ?? null;
    }
    case 'atualizacao:baixar':
      return c.baixarAtualizacao();
    case 'atualizacao:instalar': {
      const arq = c.atualizador().arquivoBaixado;
      if (!arq) throw new ErroPrumo('DSK-16', 'Baixe a atualização primeiro.');
      if (/\.AppImage$/i.test(arq)) {
        shell.showItemInFolder(arq);
        return { instrucao: 'Feche o Prumo e use o novo arquivo .AppImage mostrado na pasta.' };
      }
      const erro = await shell.openPath(arq);
      if (erro) throw new Error(erro);
      setTimeout(() => app.quit(), 800);
      return { saindo: true };
    }
    case 'janela:pronta':
      c.aoFicarPronta();
      return true;
    case 'atualizacao:lembrarDepois':
      await c.prefs.mudar((x) => (x.atualizacao.lembrarDepoisAte = new Date(Date.now() + 7 * 86_400_000).toISOString()));
      return true;
    case 'sobre:ler': {
      const r: Sobre = { versao: app.getVersion(), motor: VERSAO_MOTOR, electron: process.versions.electron, chromium: process.versions.chrome, node: process.versions.node, registro: caminhoRegistro() };
      return r;
    }
  }
  void urlDe;
  return undefined;
}
