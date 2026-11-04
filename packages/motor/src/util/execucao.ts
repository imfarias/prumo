import { ErroPrumo } from './erros.js';

/** Andamento de uma tarefa longa: etapa em texto e contagem (para barra de progresso). */
export interface Andamento {
  etapa: string;
  feito: number;
  total: number;
}

/** Opções comuns às funções longas do motor (programa de computador e, se quiser, a CLI). */
export interface OpcoesExecucao {
  sinal?: AbortSignal;
  aoAndamento?: (a: Andamento) => void;
}

/** Lança ErroPrumo('CANCELADO') se a tarefa foi cancelada; chamado entre etapas e entre páginas. */
export function verificarCancelamento(o?: OpcoesExecucao): void {
  if (o?.sinal?.aborted) throw new ErroPrumo('CANCELADO', 'Cancelado.');
}

export function andar(o: OpcoesExecucao | undefined, etapa: string, feito = 0, total = 0): void {
  verificarCancelamento(o);
  o?.aoAndamento?.({ etapa, feito, total });
}
