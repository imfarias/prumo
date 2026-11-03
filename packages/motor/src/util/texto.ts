/** Remove acentos e passa para minúsculas: base para comparar nomes de campo e títulos. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Identificador estável para `id`/`data-testid`: sem acento, minúsculas, hífens. */
export function slug(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

/** "03_Portal_Lista_Beneficiárias" → "Portal Lista Beneficiárias". */
export function tituloDeArquivo(nome: string): string {
  return nome.replace(/^\d+[_\s-]*/, '').replace(/_/g, ' ').trim();
}

/** Compara dois textos ignorando acento, caixa, pontuação e espaços repetidos. */
export function mesmoTexto(a: string, b: string): boolean {
  const n = (t: string) => normalizar(t).replace(/[^a-z0-9]+/g, ' ').trim();
  return n(a) === n(b);
}

/** Tira Markdown simples (`**`, `` ` ``, links) para comparar ou mostrar como texto puro. */
export function textoPuro(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
