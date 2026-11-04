import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { InfoAtualizacao } from '../comum/tipos.js';

/**
 * Aviso de atualização pelas releases do GitHub (RN-73): consulta, compara a versão, baixa só com o clique,
 * confere o SHA-256 e entrega o instalador — nunca instala sozinho.
 */
export const URL_PADRAO = 'https://api.github.com/repos/imfarias/prumo/releases/latest';

export type Formato = 'nsis' | 'msi' | 'deb' | 'appimage' | 'desconhecido';
type Buscar = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<Response>;

interface Ativo {
  name: string;
  size: number;
  browser_download_url: string;
}
interface Release {
  tag_name: string;
  name?: string;
  body?: string;
  html_url: string;
  draft?: boolean;
  prerelease?: boolean;
  assets: Ativo[];
}

export function compararVersoes(a: string, b: string): number {
  const n = (v: string) => v.replace(/^v/, '').split('-')[0]!.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const [x, y] = [n(a), n(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/** Formato da instalação em uso, pelo caminho do executável (sem consultar registro). */
export function formatoInstalado(exe: string, plataforma = process.platform, env = process.env): Formato {
  if (plataforma === 'linux') return env.APPIMAGE ? 'appimage' : exe.startsWith('/opt/') || exe.startsWith('/usr/') ? 'deb' : 'desconhecido';
  if (plataforma === 'win32') {
    const e = exe.toLowerCase();
    if (e.includes('\\appdata\\local\\programs\\')) return 'nsis';
    if (e.includes('\\program files')) return 'msi';
  }
  return 'desconhecido';
}

const EXTENSAO: Record<Formato, RegExp | undefined> = {
  nsis: /\.exe$/i,
  msi: /\.msi$/i,
  deb: /\.deb$/i,
  appimage: /\.AppImage$/i,
  desconhecido: undefined,
};

export class Atualizador {
  private release?: Release;
  private baixado?: string;

  constructor(
    private readonly o: { versaoAtual: string; url?: string; formato: Formato; pasta: string; buscar?: Buscar; userAgent?: string },
  ) {}

  private get buscar(): Buscar {
    return this.o.buscar ?? ((u, i) => fetch(u, i));
  }

  private cabecalhos() {
    return { 'User-Agent': this.o.userAgent ?? `Prumo/${this.o.versaoAtual}`, Accept: 'application/vnd.github+json' };
  }

  /** undefined = não há versão nova (ou a release não serve). Lança em erro de rede/HTTP. */
  async verificar(sinal?: AbortSignal): Promise<InfoAtualizacao | undefined> {
    const url = this.o.url ?? URL_PADRAO;
    if (!/^https:\/\//.test(url) && !/^http:\/\/127\.0\.0\.1(:\d+)?\//.test(url)) throw new Error('O endereço de atualização precisa ser https.');
    const r = await this.buscar(url, { headers: this.cabecalhos(), signal: sinal });
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
    const rel = (await r.json()) as Release;
    if (!rel?.tag_name || rel.draft || rel.prerelease) return undefined;
    if (compararVersoes(rel.tag_name, this.o.versaoAtual) <= 0) return undefined;
    this.release = rel;
    const ativo = this.ativo();
    return { versao: rel.tag_name.replace(/^v/, ''), notas: (rel.body ?? '').slice(0, 4000), url: rel.html_url, arquivo: ativo ? { nome: ativo.name, tamanho: ativo.size } : undefined };
  }

  private ativo(): Ativo | undefined {
    const re = EXTENSAO[this.o.formato];
    return re ? this.release?.assets.find((a) => re.test(a.name)) : undefined;
  }

  /** Baixa o instalador e confere com o SHA256SUMS.txt da release; arquivo divergente é apagado. */
  async baixar(aoAndamento?: (feito: number, total: number) => void, sinal?: AbortSignal): Promise<string> {
    const ativo = this.ativo();
    const somas = this.release?.assets.find((a) => /^SHA256SUMS(\.txt)?$/i.test(a.name));
    if (!ativo) throw new Error('Esta release não tem instalador para o formato em uso; baixe pela página da release.');
    if (!somas) throw new Error('A release não publica SHA256SUMS.txt; por segurança, o Prumo não baixa sem conferir.');
    const tabela = await (await this.buscar(somas.browser_download_url, { headers: this.cabecalhos(), signal: sinal })).text();
    const esperado = tabela.split(/\r?\n/).map((l) => l.trim().split(/\s+\*?/)).find(([, nome]) => nome === ativo.name)?.[0]?.toLowerCase();
    if (!esperado || !/^[0-9a-f]{64}$/.test(esperado)) throw new Error(`SHA256SUMS.txt não traz ${ativo.name}.`);
    await mkdir(this.o.pasta, { recursive: true });
    const destino = path.join(this.o.pasta, path.basename(ativo.name));
    const r = await this.buscar(ativo.browser_download_url, { headers: this.cabecalhos(), signal: sinal });
    if (!r.ok || !r.body) throw new Error(`HTTP ${r.status} ao baixar ${ativo.name}`);
    const hash = createHash('sha256');
    const arquivo = createWriteStream(destino);
    let feito = 0;
    const leitor = r.body.getReader();
    try {
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        hash.update(value);
        feito += value.length;
        if (!arquivo.write(value)) await new Promise<void>((ok) => arquivo.once('drain', () => ok()));
        aoAndamento?.(feito, ativo.size);
      }
    } finally {
      await new Promise<void>((ok) => arquivo.end(() => ok()));
    }
    if (hash.digest('hex') !== esperado) {
      await rm(destino, { force: true });
      throw new Error('O arquivo baixado não confere com o SHA-256 publicado e foi apagado.');
    }
    this.baixado = destino;
    return destino;
  }

  get arquivoBaixado() {
    return this.baixado && existsSync(this.baixado) ? this.baixado : undefined;
  }
}

export async function sha256(arquivo: string) {
  return createHash('sha256').update(await readFile(arquivo)).digest('hex');
}
