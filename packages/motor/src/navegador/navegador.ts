/** Porta para o Chromium: a CLI usa playwright-core; o programa de computador usará o Electron. */
export interface ResultadoAxe {
  violacoes: { id: string; impacto: string | null; descricao: string; alvos: string[] }[];
}

export interface Navegador {
  abrir(): Promise<void>;
  capturar(url: string, o: { largura: number; altura?: number }): Promise<Buffer>;
  axe(url: string, o?: { largura?: number }): Promise<ResultadoAxe>;
  pdf?(url: string, o: { paisagem?: boolean; rodape?: string }): Promise<Buffer>;
  /** Endereços que alguma página tentou abrir fora de file:// e data: (bloqueados). */
  bloqueados(): string[];
  fechar(): Promise<void>;
}

/**
 * Script que a página roda antes da captura: fontes prontas, todas as imagens decodificadas e dois quadros.
 * Cada imagem espera no máximo 3 s (imagem bloqueada ou preguiçosa não trava a captura).
 * Só `document.fonts.ready` deixava a captura variar entre execuções quando uma imagem ainda decodificava.
 */
export const SCRIPT_ESTABILIZAR =
  'document.fonts.ready.then(() => Promise.all([...document.images].map((i) => (i.complete && i.naturalWidth) || !i.src ? null : Promise.race([i.decode().catch(() => null), new Promise((r) => setTimeout(r, 3000))]))))' +
  '.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))';
