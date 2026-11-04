import { normalizarBusca } from '../src/docs/busca-config.js';

/** Texto normalizado com o mapa de cada posição para a posição no original (acentos mudam o tamanho). */
export function normalizarComMapa(original: string): { texto: string; mapa: number[] } {
  let texto = '';
  const mapa: number[] = [];
  for (let i = 0; i < original.length; i++) {
    const n = normalizarBusca(original[i]!);
    for (let j = 0; j < n.length; j++) {
      texto += n[j];
      mapa.push(i);
    }
  }
  return { texto, mapa };
}

export function termos(consulta: string): string[] {
  return normalizarBusca(consulta).split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Trecho de ~140 caracteres em volta do primeiro termo encontrado, com os termos em <mark>. */
export function trecho(original: string, consulta: string): string {
  const ts = termos(consulta);
  const { texto, mapa } = normalizarComMapa(original);
  let pos = -1;
  for (const t of ts) {
    const i = texto.indexOf(t);
    if (i >= 0 && (pos < 0 || i < pos)) pos = i;
  }
  const inicio = pos < 0 ? 0 : Math.max(0, (mapa[pos] ?? 0) - 50);
  const fim = Math.min(original.length, inicio + 150);
  const pedaco = original.slice(inicio, fim);
  return (inicio > 0 ? '… ' : '') + marcar(pedaco, ts) + (fim < original.length ? ' …' : '');
}

export function marcar(original: string, ts: string[]): string {
  const { texto, mapa } = normalizarComMapa(original);
  const faixas: [number, number][] = [];
  for (const t of ts) {
    let i = texto.indexOf(t);
    while (i >= 0) {
      faixas.push([mapa[i]!, mapa[i + t.length - 1]! + 1]);
      i = texto.indexOf(t, i + t.length);
    }
  }
  faixas.sort((a, b) => a[0] - b[0]);
  let saida = '';
  let ultimo = 0;
  for (const [a, b] of faixas) {
    if (a < ultimo) continue;
    saida += esc(original.slice(ultimo, a)) + '<mark>' + esc(original.slice(a, b)) + '</mark>';
    ultimo = b;
  }
  return saida + esc(original.slice(ultimo));
}

/** Destaca os termos nos nós de texto de um elemento (sem tocar em atributos e scripts). */
export function destacarEm(raiz: Element, consulta: string): HTMLElement | undefined {
  const ts = termos(consulta).filter((t) => t.length >= 3);
  if (!ts.length) return undefined;
  const andador = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('script,style,mark,pre.gherkin') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nos: Text[] = [];
  while (andador.nextNode()) nos.push(andador.currentNode as Text);
  let primeiro: HTMLElement | undefined;
  for (const no of nos) {
    const html = marcar(no.data, ts);
    if (!html.includes('<mark>')) continue;
    const span = document.createElement('span');
    span.innerHTML = html;
    primeiro ??= span.querySelector('mark') ?? undefined;
    no.replaceWith(...span.childNodes);
  }
  return primeiro;
}
