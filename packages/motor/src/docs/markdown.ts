import MarkdownIt from 'markdown-it';

/**
 * Markdown e HTML simples das features (negrito, <br>, ---, listas, links, imagens) com lista branca (RN-54).
 * Links do Pirilampo (#/scenario, #!/feature) e imagens passam pelos callbacks, que devolvem o destino na documentação.
 */
export interface DestinoLink {
  href: string;
  rota?: string; // href original do Pirilampo, guardado em data-rota
  previa?: string; // chave da prévia (endereço/posição) quando o destino é RNG/LOV/MSG/E-mail
  quebrado?: boolean;
}

export interface OpcoesMarkdown {
  linkDe: (href: string) => DestinoLink | undefined; // só para hrefs que começam com '#'
  imagemDe: (src: string) => string | undefined; // devolve o src na saída ou undefined (imagem removida)
}

const TAGS = new Set(['strong', 'b', 'em', 'i', 'br', 'hr', 'code', 'a', 'p', 'ul', 'ol', 'li', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sub', 'sup', 'small', 'span']);
const VAZIAS = new Set(['br', 'hr', 'img']);
const ATRIBUTOS: Record<string, string[]> = { a: ['href', 'title'], img: ['src', 'alt', 'title'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] };

export const escapar = (t: string) => t.replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escaparAtributo = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const decodificar = (t: string) => {
  try {
    return decodeURI(t);
  } catch {
    return t;
  }
};

/** URL de link aceita: âncora, relativa ou https. Nunca javascript:, data:, vbscript:, file:. */
function hrefSeguro(href: string): boolean {
  const h = href.trim().toLowerCase().replace(/[\u0000-\u001f\s]/g, '');
  if (h.startsWith('#')) return true;
  if (/^[a-z][a-z0-9+.-]*:/.test(h)) return h.startsWith('https:') || h.startsWith('mailto:');
  return !h.startsWith('//');
}

function srcSeguro(src: string): boolean {
  const s = src.trim().toLowerCase();
  if (s.startsWith('data:')) return /^data:image\/(png|jpe?g|gif|webp);base64,/.test(s);
  return !/^[a-z][a-z0-9+.-]*:/.test(s) && !s.startsWith('//');
}

function atributosLink(href: string, o: OpcoesMarkdown, titulo?: string): string {
  let destino: DestinoLink = { href };
  if (href.startsWith('#')) destino = o.linkDe(href) ?? { href, quebrado: false };
  if (!hrefSeguro(destino.href)) return ' data-removido="href"';
  const partes = [` href="${escaparAtributo(destino.href)}"`];
  if (destino.rota) partes.push(` data-rota="${escaparAtributo(decodificar(destino.rota))}"`);
  if (destino.previa) partes.push(` data-previa="${escaparAtributo(destino.previa)}"`);
  if (destino.quebrado) partes.push(' data-quebrado="true"');
  if (titulo) partes.push(` title="${escaparAtributo(titulo)}"`);
  if (/^https?:/i.test(destino.href)) partes.push(' rel="noopener noreferrer"');
  return partes.join('');
}

function atributosImagem(src: string, alt: string, o: OpcoesMarkdown): string | undefined {
  const novo = srcSeguro(src) ? o.imagemDe(src) : undefined;
  if (!novo) return undefined;
  return ` src="${escaparAtributo(novo)}" alt="${escaparAtributo(alt)}" loading="lazy"`;
}

const RE_ATRIBUTO = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** Sanitiza HTML bruto vindo da feature: mantém só tags e atributos da lista branca; o resto vira texto. */
export function sanitizarHtml(html: string, o: OpcoesMarkdown): string {
  let saida = '';
  let ultimo = 0;
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>|<!--[\s\S]*?-->/g;
  for (const m of html.matchAll(re)) {
    saida += escapar(html.slice(ultimo, m.index));
    ultimo = (m.index ?? 0) + m[0].length;
    if (m[0].startsWith('<!--')) continue;
    const tag = m[1]!.toLowerCase();
    const fecha = m[0].startsWith('</');
    if (!TAGS.has(tag)) {
      saida += escapar(m[0]);
      continue;
    }
    if (fecha) {
      if (!VAZIAS.has(tag)) saida += `</${tag}>`;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of (m[2] ?? '').matchAll(RE_ATRIBUTO)) {
      const nome = a[1]!.toLowerCase();
      if ((ATRIBUTOS[tag] ?? []).includes(nome)) attrs[nome] = a[2] ?? a[3] ?? a[4] ?? '';
    }
    if (tag === 'a') {
      saida += `<a${attrs.href !== undefined ? atributosLink(attrs.href, o, attrs.title) : ''}>`;
    } else if (tag === 'img') {
      const ai = attrs.src ? atributosImagem(attrs.src, attrs.alt ?? '', o) : undefined;
      if (ai) saida += `<img${ai}>`;
    } else {
      const extra = ['colspan', 'rowspan'].filter((k) => attrs[k] && /^\d{1,2}$/.test(attrs[k]!)).map((k) => ` ${k}="${attrs[k]}"`).join('');
      saida += `<${tag}${extra}>`;
    }
  }
  return saida + escapar(html.slice(ultimo));
}

function criar() {
  const md = new MarkdownIt({ html: true, linkify: false, breaks: false, typographer: false });
  md.disable(['code']); // indentação das features não é bloco de código
  const r = md.renderer.rules;
  const op = (env: unknown) => env as OpcoesMarkdown;
  const attr = (v: string | number | null) => (v === null ? '' : String(v));
  r.html_inline = (t, i, _o, env) => sanitizarHtml(t[i]!.content, op(env));
  r.html_block = (t, i, _o, env) => sanitizarHtml(t[i]!.content, op(env));
  r.link_open = (t, i, _o, env) => `<a${atributosLink(attr(t[i]!.attrGet('href')), op(env), attr(t[i]!.attrGet('title')) || undefined)}>`;
  r.image = (t, i, _o, env) => {
    const tok = t[i]!;
    const alt = tok.children?.map((c) => c.content).join('') ?? '';
    const a = atributosImagem(attr(tok.attrGet('src')), alt, op(env));
    return a ? `<img${a}>` : '';
  };
  return md;
}

const md = criar();

/** Remove a indentação comum (as descrições das features vêm com 2 ou 4 espaços). */
function dedentar(texto: string): string {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n');
  const recuo = Math.min(...linhas.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)![0].length));
  return linhas.map((l) => l.slice(Number.isFinite(recuo) ? recuo : 0)).join('\n');
}

export function renderizarMarkdown(texto: string, o: OpcoesMarkdown): string {
  if (!texto.trim()) return '';
  return md.render(dedentar(texto), { ...o }).trim();
}

export function renderizarInline(texto: string, o: OpcoesMarkdown): string {
  if (!texto) return '';
  return md.renderInline(texto, { ...o });
}
