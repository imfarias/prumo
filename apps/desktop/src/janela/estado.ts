import { computed, signal } from '@preact/signals';
import type { Canal, Evento } from '../comum/canais.js';
import type { EstadoTarefa, InfoAtualizacao, ProjetoAberto } from '../comum/tipos.js';

declare global {
  interface Window {
    prumo: {
      invocar(canal: Canal, dados?: unknown): Promise<unknown>;
      ouvir(evento: Evento, fn: (dados: unknown) => void): () => void;
      caminhoDoArquivo(f: File): string;
      plataforma: string;
    };
  }
}

export type Tela = 'projetos' | 'configuracao' | 'verificacao' | 'prototipos' | 'documentacao' | 'comparar' | 'preferencias';

export const tela = signal<Tela>('projetos');
export const projeto = signal<ProjetoAberto | undefined>(undefined);
export const tarefa = signal<EstadoTarefa | undefined>(undefined);
/** Há tarefa rodando: os botões que iniciam outra ficam desativados (só uma por vez, RN-70). */
export const ocupado = computed(() => tarefa.value?.estado === 'rodando');
export const atualizacao = signal<InfoAtualizacao | undefined>(undefined);
export const mensagem = signal<{ tipo: 'ok' | 'erro' | 'atencao'; texto: string } | undefined>(undefined);
export const mudancasPendentes = signal(false);
export const versaoPrevia = signal(0);

/** Erros do principal chegam como "[CODIGO] mensagem"; mostra só a mensagem. */
export function textoDoErro(e: unknown): string {
  const m = (e as Error)?.message ?? String(e);
  return m.replace(/^Error invoking remote method 'prumo': (Error: )?/, '').replace(/^\[[A-Z0-9-]+\]\s*/, '');
}

export async function invocar<T = unknown>(canal: Canal, dados?: unknown): Promise<T> {
  return (await window.prumo.invocar(canal, dados)) as T;
}

export function avisar(tipo: 'ok' | 'erro' | 'atencao', texto: string) {
  mensagem.value = { tipo, texto };
}

/** Inicia uma tarefa longa e espera o fim (andamento chega pelos eventos). */
export async function rodarTarefa<T = unknown>(tipo: EstadoTarefa['tipo'], parametros: Record<string, unknown> = {}): Promise<T | undefined> {
  const r = await invocar<EstadoTarefa | { confirmar: { quantidade: number; exemplos: string[] } }>('tarefa:iniciar', { tipo, parametros });
  if ('confirmar' in r) {
    const ok = window.confirm(`${r.confirmar.quantidade} PNGs não foram gerados pelo Prumo e serão substituídos (ex.: ${r.confirmar.exemplos.join(', ')}). Continuar?`);
    if (!ok) return undefined;
    return rodarTarefa<T>(tipo, { ...parametros, forcar: true });
  }
  tarefa.value = r;
  return new Promise<T | undefined>((ok, falha) => {
    const parar = window.prumo.ouvir('tarefa:fim', (d) => {
      const fim = d as EstadoTarefa;
      if (fim.id !== r.id) return;
      parar();
      tarefa.value = fim;
      setTimeout(() => {
        if (tarefa.value?.id === fim.id) tarefa.value = undefined;
      }, 2500);
      if (fim.estado === 'concluida') ok(fim.resultado as T);
      else if (fim.estado === 'cancelada') {
        avisar('atencao', 'Cancelado. O que já tinha sido gravado continua íntegro.');
        ok(undefined);
      } else falha(new Error(fim.erro?.mensagem ?? 'Erro'));
    });
  });
}
