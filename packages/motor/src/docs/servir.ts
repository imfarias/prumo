import { existsSync, statSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { watch } from 'chokidar';
import { ErroPrumo } from '../util/erros.js';
import { gerarDocumentacao, type ResultadoDocs } from './gerar.js';

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.gif': 'image/gif',
};

const RECARGA = `<script>(function(){var e=new EventSource('/__prumo/eventos');e.addEventListener('recarregar',function(){location.reload()});})();</script>`;

export interface Servidor {
  url: string;
  pasta: string;
  parar(): Promise<void>;
  /** Promessa da regeneração em andamento (para testes). */
  ocioso(): Promise<void>;
}

/**
 * `prumo servir` (FA-08, RN-61): documentação e protótipos em http://127.0.0.1:{porta}, regenerados ao salvar
 * um .feature, o projeto.yml ou o telas.overrides.yml. A saída fica numa pasta temporária.
 */
export async function servir(specs: string, o: { porta?: number; projeto?: string; comparar?: string | false; aoGerar?: (r: ResultadoDocs | Error) => void } = {}): Promise<Servidor> {
  const raiz = path.resolve(specs);
  const pasta = await mkdtemp(path.join(os.tmpdir(), 'prumo-servir-'));
  const clientes = new Set<http.ServerResponse>();
  let gerando: Promise<void> = Promise.resolve();
  let pendente = false;
  let rodando = false;

  const regenerar = async () => {
    try {
      const r = await gerarDocumentacao(raiz, { saida: pasta, projeto: o.projeto, comparar: o.comparar, arquivoUnico: false });
      o.aoGerar?.(r);
    } catch (e) {
      o.aoGerar?.(e as Error);
    }
    for (const c of clientes) c.write('event: recarregar\ndata: 1\n\n');
  };
  const agendar = () => {
    if (rodando) {
      pendente = true;
      return gerando;
    }
    rodando = true;
    gerando = (async () => {
      do {
        pendente = false;
        await regenerar();
      } while (pendente);
      rodando = false;
    })();
    return gerando;
  };
  await agendar();

  const servidor = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/saude') return void res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    if (url.pathname === '/__prumo/eventos') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': conectado\n\n');
      clientes.add(res);
      req.on('close', () => clientes.delete(res));
      return;
    }
    let rel: string;
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {
      return void res.writeHead(400).end();
    }
    const arquivo = path.resolve(pasta, '.' + (rel.endsWith('/') ? `${rel}index.html` : rel));
    if (path.relative(pasta, arquivo).startsWith('..') || !existsSync(arquivo) || !statSync(arquivo).isFile()) {
      return void res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Não encontrado');
    }
    const tipo = TIPOS[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream';
    let corpo: Buffer | string = await readFile(arquivo);
    // Só as páginas da documentação recarregam (os protótipos estão dentro delas, num iframe).
    if (tipo.startsWith('text/html') && !arquivo.includes(`${path.sep}prototipos`)) corpo = corpo.toString('utf8').replace('</body>', `${RECARGA}</body>`);
    res.writeHead(200, { 'content-type': tipo, 'cache-control': 'no-store' }).end(corpo);
  });

  await new Promise<void>((ok, falha) => {
    servidor.once('error', (e: NodeJS.ErrnoException) => falha(e.code === 'EADDRINUSE' ? new ErroPrumo('DOC-05', `A porta ${o.porta} está ocupada; use --porta.`) : e));
    servidor.listen(o.porta ?? 4300, '127.0.0.1', () => ok());
  });

  let espera: NodeJS.Timeout | undefined;
  const vigia = watch(raiz, {
    ignoreInitial: true,
    ignored: (p: string) => /[\\/](node_modules|\.git|saida|html)([\\/]|$)/.test(p),
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
  });
  vigia.on('all', (_evento, arquivo) => {
    if (!/\.(feature|ya?ml|properties|png|jpe?g|svg|css|html)$/i.test(arquivo)) return;
    clearTimeout(espera);
    espera = setTimeout(() => void agendar(), 300);
  });
  await new Promise<void>((ok) => vigia.once('ready', () => ok()));

  const porta = (servidor.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${porta}/`,
    pasta,
    ocioso: () => gerando,
    parar: async () => {
      clearTimeout(espera);
      await vigia.close();
      for (const c of clientes) c.end();
      await new Promise<void>((ok) => servidor.close(() => ok()));
      await gerando;
      await rm(pasta, { recursive: true, force: true });
    },
  };
}
