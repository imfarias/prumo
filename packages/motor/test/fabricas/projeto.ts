import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXEMPLO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../exemplos/exemplo-ficticio');

export interface ProjetoTemp {
  dir: string;
  ler(rel: string): Promise<string>;
  escrever(rel: string, conteudo: string): Promise<void>;
  substituir(rel: string, de: string | RegExp, para: string): Promise<void>;
  remover(rel: string): Promise<void>;
  limpar(): Promise<void>;
}

/** Cópia do projeto de exemplo (ou pasta vazia) numa pasta temporária, com nome acentuado e espaço (CT-I23). */
export async function criarProjeto(o: { base?: 'exemplo' | 'vazio'; semPngs?: boolean } = {}): Promise<ProjetoTemp> {
  const raiz = await mkdtemp(path.join(os.tmpdir(), 'prumo-teste-'));
  const dir = path.join(raiz, '3 - Requisitos', 'Especificações');
  await mkdir(dir, { recursive: true });
  if ((o.base ?? 'exemplo') === 'exemplo') {
    await cp(EXEMPLO, dir, { recursive: true, filter: (src) => !(o.semPngs && src.endsWith('.png') && !src.includes('referencia')) });
  }
  const abs = (rel: string) => path.join(dir, rel);
  return {
    dir,
    ler: (rel) => readFile(abs(rel), 'utf8'),
    escrever: async (rel, conteudo) => {
      await mkdir(path.dirname(abs(rel)), { recursive: true });
      await writeFile(abs(rel), conteudo, 'utf8');
    },
    substituir: async (rel, de, para) => {
      const t = await readFile(abs(rel), 'utf8');
      const novo = t.replace(de, para);
      if (novo === t) throw new Error(`substituir: "${String(de)}" não encontrado em ${rel}`);
      await writeFile(abs(rel), novo, 'utf8');
    },
    remover: (rel) => rm(abs(rel), { force: true, recursive: true }),
    limpar: () => rm(raiz, { recursive: true, force: true }),
  };
}
