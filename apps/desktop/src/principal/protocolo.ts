import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { protocol } from 'electron';

/**
 * `prumo-arquivo://{raiz}/{caminho}`: a janela vê só as pastas registradas (saída da documentação,
 * protótipos, especificações), nunca o disco inteiro (seção 5 do desenho).
 */
const raizes = new Map<string, string>();

export function registrarRaiz(apelido: string, pasta: string | undefined) {
  if (pasta) raizes.set(apelido, path.resolve(pasta));
  else raizes.delete(apelido);
}

export function urlDe(apelido: string, arquivo: string): string {
  const raiz = raizes.get(apelido);
  if (!raiz) throw new Error(`raiz ${apelido} não registrada`);
  const rel = path.relative(raiz, path.resolve(arquivo)).split(path.sep).map(encodeURIComponent).join('/');
  return `prumo-arquivo://${apelido}/${rel}`;
}

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.gif': 'image/gif', '.pdf': 'application/pdf',
};

export function resolverUrl(url: string): string | undefined {
  const u = new URL(url);
  const raiz = raizes.get(u.hostname);
  if (!raiz) return undefined;
  let rel: string;
  try {
    rel = decodeURIComponent(u.pathname);
  } catch {
    return undefined;
  }
  const alvo = path.resolve(raiz, '.' + rel);
  const r = path.relative(raiz, alvo);
  if (r.startsWith('..') || path.isAbsolute(r)) return undefined;
  return alvo;
}

export function registrarEsquema() {
  protocol.registerSchemesAsPrivileged([{ scheme: 'prumo-arquivo', privileges: { standard: true, secure: true, supportFetchAPI: false, corsEnabled: false, stream: true } }]);
}

export function atenderProtocolo() {
  protocol.handle('prumo-arquivo', async (req) => {
    const alvo = resolverUrl(req.url);
    if (!alvo || !existsSync(alvo) || !statSync(alvo).isFile()) return new Response('Não encontrado', { status: 404 });
    const tipo = TIPOS[path.extname(alvo).toLowerCase()] ?? 'application/octet-stream';
    return new Response(await readFile(alvo), { status: 200, headers: { 'content-type': tipo, 'cache-control': 'no-store' } });
  });
}
