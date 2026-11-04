import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { ehCanal, ehEvento, type Canal, type Evento } from '../comum/canais.js';

/** API mínima da janela (RN-72): só os canais da lista, nada de Node. */
contextBridge.exposeInMainWorld('prumo', {
  invocar(canal: Canal, dados?: unknown): Promise<unknown> {
    if (!ehCanal(canal)) return Promise.reject(new Error(`canal desconhecido: ${String(canal)}`));
    return ipcRenderer.invoke('prumo', canal, dados);
  },
  ouvir(evento: Evento, fn: (dados: unknown) => void): () => void {
    if (!ehEvento(evento)) throw new Error(`evento desconhecido: ${String(evento)}`);
    const ouvinte = (_e: IpcRendererEvent, dados: unknown) => fn(dados);
    ipcRenderer.on(evento, ouvinte);
    return () => ipcRenderer.removeListener(evento, ouvinte);
  },
  /** Caminho de uma pasta solta na janela (arrastar e soltar). */
  caminhoDoArquivo(f: File): string {
    return webUtils.getPathForFile(f);
  },
  plataforma: process.platform,
});
