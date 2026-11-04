import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { preparar, type Preparado } from '../executar.js';
import { ErroPrumo } from '../util/erros.js';

const exec = promisify(execFile);

async function git(cwd: string, args: string[], binario = false) {
  try {
    const r = await exec('git', args, { cwd, encoding: binario ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    return r.stdout as unknown as string | Buffer;
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string };
    if (err.code === 'ENOENT') throw new ErroPrumo('DOC-08', 'O Git não está instalado; para comparar com uma branch, tag ou commit é preciso ter o git. Fora do Git, informe uma pasta com a versão anterior.');
    throw e;
  }
}

export interface VersaoAnterior {
  preparado: Preparado;
  rotulo: string;
  limpar(): Promise<void>;
}

/**
 * Versão anterior para comparar: uma pasta de especificações, ou uma referência do Git lida com `git show`
 * para uma pasta temporária, sem checkout nem mudança no repositório do usuário (RN-62).
 */
export async function prepararVersaoAnterior(specs: string, valor: string): Promise<VersaoAnterior> {
  const pasta = [path.resolve(valor), path.resolve(specs, valor)].find((x) => existsSync(x) && statSync(x).isDirectory());
  if (pasta) return { preparado: await preparar(pasta), rotulo: path.basename(pasta), limpar: async () => {} };
  {
    let topo: string;
    let rel: string;
    try {
      topo = String(await git(specs, ['rev-parse', '--show-toplevel'])).trim();
      // O prefixo vem do próprio Git: evita comparar caminho curto (8.3) com longo no Windows.
      rel = String(await git(specs, ['-c', 'core.quotepath=off', 'rev-parse', '--show-prefix'])).trim().replace(/\/$/, '');
    } catch (e) {
      if (e instanceof ErroPrumo) throw e;
      throw new ErroPrumo('DOC-08', `As especificações não estão num repositório Git, e "${valor}" não é uma pasta. Fora do Git, informe uma pasta com a versão anterior.`);
    }
    try {
      await git(specs, ['rev-parse', '--verify', '--quiet', `${valor}^{commit}`]);
    } catch (e) {
      if (e instanceof ErroPrumo) throw e;
      throw new ErroPrumo('DOC-07', `Versão anterior não encontrada: ${valor}. Informe uma branch, tag ou commit, ou uma pasta de especificações.`);
    }
    const lista = String(await git(topo, ['-c', 'core.quotepath=off', 'ls-tree', '-r', '-z', '--name-only', valor, '--', rel || '.'])).split('\0').filter(Boolean);
    const temp = await mkdtemp(path.join(os.tmpdir(), 'prumo-anterior-'));
    const destino = path.join(temp, rel ? path.basename(rel) : 'especificacoes');
    await mkdir(destino, { recursive: true });
    const interessa = /\.(feature|ya?ml|properties)$/i;
    for (const arq of lista) {
      if (!interessa.test(arq)) continue;
      const dentro = rel ? arq.slice(rel.length + 1) : arq;
      const conteudo = (await git(topo, ['show', `${valor}:${arq}`], true)) as Buffer;
      const alvo = path.join(destino, ...dentro.split('/'));
      await mkdir(path.dirname(alvo), { recursive: true });
      await writeFile(alvo, conteudo);
    }
    if (!lista.some((x) => x.endsWith('.feature'))) {
      await rm(temp, { recursive: true, force: true });
      throw new ErroPrumo('DOC-07', `Versão anterior não encontrada: ${valor} não tem arquivos .feature em ${rel || '.'}.`);
    }
    return { preparado: await preparar(destino), rotulo: valor, limpar: () => rm(temp, { recursive: true, force: true }) };
  }
}
