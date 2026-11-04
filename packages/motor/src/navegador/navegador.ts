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
