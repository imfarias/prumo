import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Release falsa do GitHub servida em 127.0.0.1: JSON de `releases/latest`, um instalador por formato e o
 * SHA256SUMS.txt (certo ou errado). Conta as requisições para provar que nada é pedido sem necessidade.
 */
export interface ReleaseFalsa {
  url: string;
  pedidos: string[];
  conteudo: Buffer;
  fechar(): Promise<void>;
}

export async function servirRelease(o: { versao: string; shaErrado?: boolean; semSomas?: boolean; status?: number; prerelease?: boolean }): Promise<ReleaseFalsa> {
  const conteudo = Buffer.alloc(300_000, 7);
  const sha = o.shaErrado ? '0'.repeat(64) : createHash('sha256').update(conteudo).digest('hex');
  const nomes = [`Prumo-Setup-${o.versao}.exe`, `Prumo-${o.versao}.msi`, `prumo_${o.versao}_amd64.deb`, `Prumo-${o.versao}.AppImage`];
  const pedidos: string[] = [];
  let base = '';
  const servidor: Server = createServer((req, res) => {
    pedidos.push(req.url ?? '');
    if (o.status) {
      res.writeHead(o.status).end();
      return;
    }
    if (req.url === '/releases/latest') {
      const assets = nomes.map((n) => ({ name: n, size: conteudo.length, browser_download_url: `${base}/baixar/${n}` }));
      if (!o.semSomas) assets.push({ name: 'SHA256SUMS.txt', size: 1, browser_download_url: `${base}/baixar/SHA256SUMS.txt` });
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({ tag_name: `v${o.versao}`, name: `Prumo ${o.versao}`, body: 'Novidades da versão.', html_url: `${base}/pagina`, prerelease: !!o.prerelease, assets }),
      );
      return;
    }
    if (req.url === '/baixar/SHA256SUMS.txt') {
      res.writeHead(200).end(nomes.map((n) => `${sha}  ${n}`).join('\n') + '\n');
      return;
    }
    if (req.url?.startsWith('/baixar/')) {
      res.writeHead(200, { 'content-length': conteudo.length }).end(conteudo);
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  return {
    url: `${base}/releases/latest`,
    pedidos,
    conteudo,
    fechar: () => new Promise<void>((ok) => servidor.close(() => ok())),
  };
}
