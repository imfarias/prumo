import MiniSearch from 'minisearch';
import { codigoDaConsulta, OPCOES_INDICE } from '../src/docs/busca-config.js';
import { interpretar, resolver, sugerir, type MapaRotas, type Rota } from './rotas.js';
import { destacarEm, trecho } from './texto.js';

interface Config {
  modo: 'pasta' | 'unico';
  raiz: string; // '' (raiz) ou '../' (páginas em f/)
  pagina: string; // endereço da funcionalidade, '#inicio', '#matriz', '#mudancas'
}
interface Doc {
  id: string;
  titulo: string;
  caminho: string;
  tipo: string;
  destino: string;
  texto: string;
  codigo?: string;
}
interface Dados {
  rotas: MapaRotas;
  previas: Record<string, { titulo: string; html: string; href: string }>;
  busca: unknown;
  prototipos?: Record<string, string>; // único: tela/estado → HTML da página do protótipo
  cssPrototipos?: string;
  jsPrototipo?: string;
  recursosPrototipo?: Record<string, string>;
}

declare global {
  interface Window {
    PRUMO_DADOS: Dados;
  }
}

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const config: Config = JSON.parse($('#prumo-config')!.textContent!);
const dados = window.PRUMO_DADOS;
const TIPOS: Record<string, string> = { funcionalidade: 'Funcionalidade', cenario: 'Cenário', regra: 'Regra', lista: 'Lista', mensagem: 'Mensagem', email: 'E-mail' };

let anuncio: HTMLElement;
function anunciar(t: string) {
  anuncio.textContent = '';
  setTimeout(() => (anuncio.textContent = t), 30);
}

/* ---------------- endereços ---------------- */

function hrefDaPagina(arquivo: string, ancora = ''): string {
  return `${config.raiz}f/${encodeURIComponent(arquivo)}${ancora}`;
}

function urlDoIndex(): string {
  return new URL(`${config.raiz}index.html`, location.href).href.split('#')[0]!;
}

function guardarDestaque(termo?: string) {
  try {
    if (termo) sessionStorage.setItem('prumo-destaque', termo);
  } catch {
    /* sem armazenamento */
  }
}

/** Leva a uma rota. Modo pasta: troca de arquivo; único: troca o conteúdo. */
function irPara(r: Rota, substituir = true) {
  if (config.modo === 'unico') return mostrarUnico(r);
  const ir = (url: string) => (substituir ? location.replace(url) : location.assign(url));
  if (r.tipo === 'f') {
    const end = resolver(r.endereco, dados.rotas);
    if (!end) return config.pagina === '#inicio' ? mostrarNaoEncontrado(r.endereco) : ir(`${config.raiz}index.html${location.hash}`);
    const alvo = dados.rotas[end]!;
    const posOk = r.posicao === undefined || alvo.filhos.includes(r.posicao);
    if (!posOk) return config.pagina === '#inicio' ? mostrarNaoEncontrado(`${r.endereco}/${r.posicao}`, end) : ir(`${config.raiz}index.html${location.hash}`);
    guardarDestaque(r.termo);
    const ancora = r.posicao === undefined ? '' : `#c-${r.posicao}`;
    if (end === config.pagina) {
      history.replaceState(null, '', ancora || location.pathname);
      return chegada();
    }
    return ir(hrefDaPagina(alvo.arquivo, ancora));
  }
  if (r.tipo === 'matriz') return ir(`${config.raiz}matriz.html`);
  if (r.tipo === 'mudancas') return ir(`${config.raiz}mudancas.html`);
  if (r.tipo === 'busca') {
    if (config.pagina !== '#inicio') return ir(`${config.raiz}index.html#!/busca/${encodeURIComponent(r.termo)}`);
    return mostrarResultados(r.termo);
  }
  if (r.tipo === 'inicio' && config.pagina !== '#inicio' && location.hash.startsWith('#!')) return ir(`${config.raiz}index.html`);
}

function mostrarNaoEncontrado(pedido: string, quase?: string) {
  const s = $('[data-testid="docs-nao-encontrado"]');
  if (!s) return;
  $('.apresentacao')?.setAttribute('hidden', '');
  s.hidden = false;
  $('.endereco-pedido', s)!.textContent = pedido;
  const sug = quase ?? sugerir(pedido, dados.rotas);
  const ps = $('.sugestao', s)!;
  if (sug) {
    ps.hidden = false;
    const a = $<HTMLAnchorElement>('a', ps)!;
    a.textContent = sug;
    a.href = config.modo === 'pasta' ? hrefDaPagina(dados.rotas[sug]!.arquivo) : `#!/f/${encodeURIComponent(sug)}`;
  }
  $('h1', s)?.focus();
}

/** Ao chegar numa página: destaca o cenário pedido e o termo buscado. */
function chegada() {
  const m = /^#c-(\d+)$/.exec(location.hash);
  let alvo: Element | null = null;
  if (m) {
    alvo = document.getElementById(`c-${m[1]}`);
    $$('.cenario.destacado').forEach((x) => x.classList.remove('destacado'));
    alvo?.classList.add('destacado');
  }
  const b = /^#busca=(.*)$/.exec(location.hash);
  let termo: string | null = b ? decodeURIComponent(b[1]!) : null;
  try {
    termo ??= sessionStorage.getItem('prumo-destaque');
    sessionStorage.removeItem('prumo-destaque');
  } catch {
    /* sem armazenamento */
  }
  const raiz = alvo ?? $('article.funcionalidade') ?? $('main');
  const marca = termo && raiz ? destacarEm(raiz, termo) : undefined;
  (marca ?? alvo)?.scrollIntoView({ block: 'center' });
}

/* ---------------- arquivo único ---------------- */

function mostrarUnico(r: Rota) {
  let id = 'pg-inicio';
  let atual = '#inicio';
  if (r.tipo === 'f') {
    const end = resolver(r.endereco, dados.rotas);
    if (!end || (r.posicao !== undefined && !dados.rotas[end]!.filhos.includes(r.posicao))) {
      trocar('pg-inicio', '#inicio');
      return mostrarNaoEncontrado(r.posicao === undefined ? r.endereco : `${r.endereco}/${r.posicao}`, end);
    }
    id = `pg-${dados.rotas[end]!.arquivo}`;
    atual = end;
    guardarDestaque(r.termo);
  } else if (r.tipo === 'matriz') [id, atual] = ['pg-matriz', '#matriz'];
  else if (r.tipo === 'mudancas') [id, atual] = ['pg-mudancas', '#mudancas'];
  if (atual !== config.pagina) trocar(id, atual);
  if (r.tipo === 'busca') mostrarResultados(r.termo);
  if (r.tipo === 'f' && r.posicao !== undefined) {
    const el = document.getElementById(`c-${r.posicao}`);
    $$('.cenario.destacado').forEach((x) => x.classList.remove('destacado'));
    el?.classList.add('destacado');
  }
  const raiz = (r.tipo === 'f' && r.posicao !== undefined ? document.getElementById(`c-${r.posicao}`) : null) ?? $('main');
  let termo: string | null = null;
  try {
    termo = sessionStorage.getItem('prumo-destaque');
    sessionStorage.removeItem('prumo-destaque');
  } catch {
    /* sem armazenamento */
  }
  const marca = termo && raiz ? destacarEm(raiz, termo) : undefined;
  (marca ?? (r.tipo === 'f' && r.posicao !== undefined ? document.getElementById(`c-${r.posicao}`) : null))?.scrollIntoView({ block: 'center' });
}

function trocar(id: string, atual: string) {
  const t = document.getElementById(id) as HTMLTemplateElement | null;
  if (!t) return;
  const main = $('main')!;
  main.innerHTML = t.innerHTML;
  config.pagina = atual;
  document.title = `${t.dataset.titulo ?? ''} · ${document.title.split(' · ').slice(-1)[0]}`;
  $$('#menu a[aria-current]').forEach((a) => a.removeAttribute('aria-current'));
  const link = atual.startsWith('#') ? $(`#menu a[data-pagina="${atual}"]`) : $$<HTMLAnchorElement>('#menu a').find((a) => a.dataset.endereco === atual);
  link?.setAttribute('aria-current', 'page');
  link?.closest('details')?.setAttribute('open', '');
  iniciarPagina();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

/* ---------------- busca ---------------- */

let indice: MiniSearch<Doc> | undefined;
function obterIndice() {
  indice ??= MiniSearch.loadJS<Doc>(dados.busca as never, OPCOES_INDICE as never);
  return indice;
}

export function buscar(q: string): Doc[] {
  const ms = obterIndice();
  const codigo = codigoDaConsulta(q);
  if (codigo) {
    const r = ms.search(codigo, { fields: ['codigo'], prefix: false, fuzzy: false }) as unknown as Doc[];
    const exato = r.filter((d) => d.codigo === codigo);
    if (exato.length) return exato;
  }
  return (ms.search(q) as unknown as Doc[]).slice(0, 20);
}

function abrirResultado(d: Doc, q: string) {
  guardarDestaque(q);
  const r = interpretar(`#${d.destino}`)!;
  if (config.modo === 'unico') location.hash = d.destino;
  else irPara(r, false);
}

function iniciarBusca() {
  const campo = $<HTMLInputElement>('#busca')!;
  const lista = $<HTMLUListElement>('#busca-resultados')!;
  const status = $('#busca-status')!;
  let resultados: Doc[] = [];
  let ativo = -1;
  let espera: number | undefined;
  const fechar = () => {
    lista.hidden = true;
    campo.setAttribute('aria-expanded', 'false');
    campo.removeAttribute('aria-activedescendant');
    ativo = -1;
  };
  const marcar = (i: number) => {
    ativo = i;
    $$('li', lista).forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    if (i >= 0) {
      campo.setAttribute('aria-activedescendant', `res-${i}`);
      $(`#res-${i}`)?.scrollIntoView({ block: 'nearest' });
    }
  };
  const atualizar = () => {
    const q = campo.value.trim();
    if (q.length < 2) {
      fechar();
      status.textContent = '';
      return;
    }
    resultados = buscar(q);
    lista.innerHTML = resultados.length
      ? resultados.map((d, i) => `<li id="res-${i}" role="option" aria-selected="false" data-i="${i}"><span class="tipo">${TIPOS[d.tipo] ?? d.tipo} · ${esc(d.caminho)}</span><b>${esc(d.titulo)}</b><span class="trecho">${trecho(d.texto, q)}</span></li>`).join('')
      : `<li role="option" aria-disabled="true">Nenhum resultado para "${esc(q)}". Tente sem acento ou com menos palavras.</li>`;
    lista.hidden = false;
    campo.setAttribute('aria-expanded', 'true');
    status.textContent = resultados.length ? `${resultados.length} resultados` : 'Nenhum resultado';
    ativo = -1;
  };
  campo.addEventListener('input', () => {
    clearTimeout(espera);
    espera = window.setTimeout(atualizar, 60);
  });
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && resultados.length) {
      e.preventDefault();
      if (lista.hidden) atualizar();
      marcar(Math.min(ativo + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp' && resultados.length) {
      e.preventDefault();
      marcar(Math.max(ativo - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(espera);
      if (!resultados.length || lista.hidden) atualizar();
      const d = resultados[ativo >= 0 ? ativo : 0];
      if (d) {
        fechar();
        abrirResultado(d, campo.value.trim());
      }
    } else if (e.key === 'Escape') {
      fechar();
    }
  });
  lista.addEventListener('mousedown', (e) => {
    const li = (e.target as Element).closest('li[data-i]') as HTMLElement | null;
    if (!li) return;
    e.preventDefault();
    const d = resultados[Number(li.dataset.i)]!;
    fechar();
    abrirResultado(d, campo.value.trim());
  });
  campo.addEventListener('blur', () => setTimeout(fechar, 150));
  document.addEventListener('keydown', (e) => {
    const alvo = e.target as HTMLElement;
    const digitando = /^(input|textarea|select)$/i.test(alvo.tagName) || alvo.isContentEditable;
    if ((e.key === '/' && !digitando) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      campo.focus();
      campo.select();
    }
  });
}

function mostrarResultados(q: string) {
  const s = $('[data-testid="docs-resultados-pagina"]');
  if (!s) return;
  $('.apresentacao')?.setAttribute('hidden', '');
  s.hidden = false;
  const lista = buscar(q);
  $('ol', s)!.innerHTML = lista.length
    ? lista.map((d) => `<li><a href="#${d.destino}">${esc(d.titulo)}</a> <small>${TIPOS[d.tipo] ?? d.tipo} · ${esc(d.caminho)}</small><br>${trecho(d.texto, q)}</li>`).join('')
    : `<li>Nenhum resultado para "${esc(q)}".</li>`;
  $('h1', s)!.textContent = `Resultados da busca: "${q}"`;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------------- prévia ---------------- */

function iniciarPrevia() {
  const dialogo = $<HTMLDialogElement>('#previa')!;
  let origem: HTMLElement | null = null;
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a[data-previa]') as HTMLAnchorElement | null;
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || dialogo.contains(a)) return;
    const p = dados.previas[a.dataset.previa!];
    if (!p) return;
    e.preventDefault();
    origem = a;
    $('#previa-titulo', dialogo)!.textContent = p.titulo;
    const corpo = $('.previa-corpo', dialogo)!;
    corpo.innerHTML = p.html;
    const prefixo = config.modo === 'pasta' && config.raiz === '' ? 'f/' : '';
    if (prefixo) $$<HTMLAnchorElement>('a[href]', corpo).forEach((x) => { const h = x.getAttribute('href')!; if (!/^(#|[a-z]+:)/i.test(h)) x.setAttribute('href', prefixo + h); });
    $<HTMLAnchorElement>('[data-testid="docs-previa-abrir"]', dialogo)!.href = config.modo === 'pasta' ? prefixo + p.href : p.href;
    dialogo.showModal();
  });
  $('[data-fechar]', dialogo)!.addEventListener('click', () => dialogo.close());
  $('[data-testid="docs-previa-abrir"]', dialogo)!.addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('close', () => origem?.focus());
}

/* ---------------- protótipo ---------------- */

const alturas = new WeakMap<HTMLIFrameElement, number>();

function ajustar(iframe: HTMLIFrameElement) {
  const moldura = iframe.parentElement!;
  const secao = iframe.closest('.prototipo')!;
  const modo = $('[data-zoom][aria-pressed="true"]', secao)?.dataset.zoom ?? 'ajustar';
  const h = alturas.get(iframe) ?? 900;
  iframe.style.height = `${h}px`;
  if (modo === 'ajustar') {
    const s = Math.min(1, moldura.clientWidth / 1440);
    iframe.style.transform = `scale(${s})`;
    moldura.style.height = `${Math.ceil(h * s)}px`;
  } else {
    iframe.style.transform = '';
    moldura.style.height = `${Math.min(h, 900)}px`;
  }
}

function htmlDoPrototipo(chave: string): string | undefined {
  const html = dados.prototipos?.[chave];
  if (!html) return undefined;
  return html
    .replace('<!--PRUMO-CSS-->', () => `<style>${dados.cssPrototipos ?? ''}</style>`)
    .replace('<!--PRUMO-JS-->', () => `<script>${dados.jsPrototipo ?? ''}<\/script>`)
    .replace(/prumo-rec:([^"]+)/g, (m, nome: string) => dados.recursosPrototipo?.[nome] ?? m);
}

function carregarUnico(iframe: HTMLIFrameElement, chave: string) {
  const html = htmlDoPrototipo(chave);
  if (!html) return;
  const antigo = iframe.dataset.url;
  if (antigo) URL.revokeObjectURL(antigo);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  iframe.dataset.url = url;
  iframe.dataset.blob = chave;
  iframe.src = url;
}

function iniciarPrototipos() {
  for (const secao of $$('.prototipo')) {
    const iframe = $<HTMLIFrameElement>('iframe', secao);
    if (!iframe) continue;
    if (config.modo === 'unico' && iframe.dataset.blob) carregarUnico(iframe, iframe.dataset.blob);
    for (const b of $$<HTMLButtonElement>('[data-estado]', secao)) {
      b.addEventListener('click', () => {
        $$('[data-estado]', secao).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        if (config.modo === 'unico') carregarUnico(iframe, `${secao.dataset.tela}/${b.dataset.estado}`.replace(`${secao.dataset.tela}/anterior-`, `anterior:${secao.dataset.tela}/`));
        else {
          iframe.src = b.dataset.caminho!;
          const nova = $<HTMLAnchorElement>('[data-nova-aba]', secao);
          if (nova) nova.href = b.dataset.caminho!;
        }
        anunciar(`Estado: ${b.textContent}`);
      });
    }
    for (const b of $$<HTMLButtonElement>('[data-zoom]', secao)) {
      b.addEventListener('click', () => {
        $$('[data-zoom]', secao).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        ajustar(iframe);
      });
    }
    $('details', secao)?.addEventListener('toggle', () => ajustar(iframe));
    ajustar(iframe);
    new ResizeObserver(() => ajustar(iframe)).observe(iframe.parentElement!);
  }
}

window.addEventListener('message', (e) => {
  const d = e.data as { prumo?: string; valor?: number; alvo?: string };
  if (!d || typeof d !== 'object' || !d.prumo) return;
  const iframe = $$<HTMLIFrameElement>('.prototipo iframe').find((f) => f.contentWindow === e.source);
  if (!iframe) return;
  if (d.prumo === 'altura' && typeof d.valor === 'number') {
    alturas.set(iframe, Math.max(200, Math.min(d.valor, 20000)));
    ajustar(iframe);
  } else if (d.prumo === 'navegar' && d.alvo && config.modo === 'unico') {
    const [, tela, estado] = d.alvo.split('/');
    carregarUnico(iframe, `${tela}/${estado}`);
  }
});

/* ---------------- outros ---------------- */

function iniciarCopiar() {
  const art = $<HTMLElement>('article.funcionalidade');
  for (const b of $$<HTMLButtonElement>('[data-copiar]')) {
    b.addEventListener('click', async () => {
      const url = `${urlDoIndex()}#!/f/${encodeURIComponent(art!.dataset.endereco!)}/c/${b.dataset.copiar}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const t = document.createElement('textarea');
        t.value = url;
        document.body.append(t);
        t.select();
        document.execCommand('copy');
        t.remove();
      }
      b.dataset.copiado = url;
      anunciar('Link do cenário copiado.');
    });
  }
}

function iniciarLadoALado() {
  for (const b of $$<HTMLButtonElement>('[data-lado-a-lado]')) {
    b.addEventListener('click', () => {
      const v = $('.versoes')!;
      const ligado = !v.classList.contains('lado-a-lado');
      v.classList.toggle('lado-a-lado', ligado);
      $('.versao-anterior', v)!.hidden = !ligado;
      b.setAttribute('aria-pressed', String(ligado));
    });
  }
}

function iniciarMatriz() {
  const texto = $<HTMLInputElement>('#matriz-texto');
  const tipo = $<HTMLSelectElement>('#matriz-tipo');
  if (!texto || !tipo) return;
  const aplicar = () => {
    const q = texto.value.trim().toLowerCase();
    $$<HTMLTableRowElement>('[data-testid="docs-matriz-tabela"] tbody tr').forEach((tr) => (tr.hidden = !!q && !tr.dataset.texto!.includes(q)));
    $$('[data-testid="docs-matriz"] [data-tipo]').forEach((c) => (c.hidden = !!tipo.value && c.dataset.tipo !== tipo.value));
  };
  texto.addEventListener('input', aplicar);
  tipo.addEventListener('change', aplicar);
}

function iniciarContraste() {
  const b = $<HTMLButtonElement>('[data-testid="docs-contraste"]')!;
  const sync = () => b.setAttribute('aria-pressed', String(document.documentElement.dataset.tema === 'contraste'));
  sync();
  b.addEventListener('click', () => {
    const ligado = document.documentElement.dataset.tema !== 'contraste';
    if (ligado) document.documentElement.dataset.tema = 'contraste';
    else delete document.documentElement.dataset.tema;
    try {
      localStorage.setItem('prumo-tema', ligado ? 'contraste' : 'claro');
    } catch {
      /* sem armazenamento */
    }
    sync();
  });
}

function iniciarMenu() {
  const b = $<HTMLButtonElement>('[data-testid="docs-botao-menu"]')!;
  const menu = $('#menu')!;
  b.addEventListener('click', () => {
    const aberto = menu.classList.toggle('aberto');
    b.setAttribute('aria-expanded', String(aberto));
  });
}

function iniciarPagina() {
  iniciarPrototipos();
  iniciarCopiar();
  iniciarLadoALado();
  iniciarMatriz();
}

function iniciar() {
  anuncio = document.createElement('p');
  anuncio.className = 'sr';
  anuncio.setAttribute('aria-live', 'polite');
  anuncio.dataset.testid = 'docs-anuncio';
  document.body.append(anuncio);
  iniciarBusca();
  iniciarPrevia();
  iniciarContraste();
  iniciarMenu();
  if (config.modo === 'unico') {
    window.addEventListener('hashchange', () => {
      const r = interpretar(location.hash);
      if (r) mostrarUnico(r);
    });
    const r = interpretar(location.hash) ?? { tipo: 'inicio' as const };
    if (r.tipo === 'inicio') iniciarPagina();
    mostrarUnico(r);
    return;
  }
  iniciarPagina();
  window.addEventListener('hashchange', () => {
    const r = interpretar(location.hash);
    if (r && r.tipo !== 'inicio') irPara(r);
    else chegada();
  });
  const r = interpretar(location.hash);
  if (r && r.tipo !== 'inicio') irPara(r);
  else chegada();
}

iniciar();
