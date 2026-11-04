import { existsSync, readdirSync, statSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { criarProjetoNovo } from '../../src/config/novo.js';
import { gerarDocumentacao } from '../../src/docs/gerar.js';
import { gerar, preparar, verificarPreparado } from '../../src/executar.js';
import type { Andamento } from '../../src/util/execucao.js';
import { diretorioKits } from '../../src/util/recursos.js';
import { caminhoFonte } from '../../src/render/tokens-css.js';
import { criarProjeto, type ProjetoTemp } from '../fabricas/projeto.js';

let projetos: ProjetoTemp[] = [];
afterEach(async () => {
  await Promise.all(projetos.map((p) => p.limpar()));
  projetos = [];
  delete process.env.PRUMO_RECURSOS;
});
const novo = async () => {
  const p = await criarProjeto();
  projetos.push(p);
  return p;
};

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

describe('andamento e cancelamento (CT-I04, CT-I05)', () => {
  it('andamento em ordem até o fim', async () => {
    const p = await novo();
    const etapas: Andamento[] = [];
    await gerarDocumentacao(p.dir, { aoAndamento: (a) => etapas.push(a) });
    expect(etapas[0]!.etapa).toBe('Lendo as especificações');
    expect(etapas.some((e) => e.etapa.startsWith('Gerando protótipos'))).toBe(true);
    expect(etapas.some((e) => e.etapa.startsWith('Gerando páginas'))).toBe(true);
    expect(etapas.at(-1)!.etapa).toBe('Finalizando');
    for (const e of etapas) expect(e.feito).toBeLessThanOrEqual(e.total || e.feito);
  });

  it('cancelar no meio para com CANCELADO e não deixa arquivo pela metade nem .tmp', async () => {
    const p = await novo();
    const ctl = new AbortController();
    let n = 0;
    const saida = path.join(p.dir, '..', 'saida-cancelada');
    await expect(gerar(p.dir, { saida, sinal: ctl.signal, aoAndamento: () => ++n === 4 && ctl.abort() })).rejects.toMatchObject({ codigo: 'CANCELADO' });
    const todos = existsSync(saida) ? arquivos(saida) : [];
    expect(todos.filter((f) => f.endsWith('.tmp'))).toEqual([]);
    for (const f of todos.filter((x) => x.endsWith('.html'))) expect((await readFile(f, 'utf8')).trimEnd().endsWith('</html>'), f).toBe(true);
    const ctl2 = new AbortController();
    ctl2.abort();
    await expect(gerarDocumentacao(p.dir, { sinal: ctl2.signal })).rejects.toMatchObject({ codigo: 'CANCELADO' });
  });
});

describe('projeto novo (CT-I03)', () => {
  it('cria estrutura que passa na verificação sem erros e recusa pasta ocupada', async () => {
    const raiz = await mkdtemp(path.join(os.tmpdir(), 'prumo-novo-'));
    try {
      const { specs } = await criarProjetoNovo(raiz, { nome: 'Sistema Ação', versao: '0.1', orgao: 'Órgão Exemplo' });
      const pr = await preparar(specs);
      expect(pr.config.projeto).toMatchObject({ nome: 'Sistema Ação', versao: '0.1', orgao: 'Órgão Exemplo' });
      expect(pr.modelo.telas.map((t) => t.id)).toEqual(['01_Inicio_Contato']);
      expect(verificarPreparado(pr).filter((a) => a.severidade === 'erro')).toEqual([]);
      await expect(criarProjetoNovo(raiz, { nome: 'X', versao: '1' })).rejects.toMatchObject({ codigo: 'NOVO' });
      await expect(criarProjetoNovo(path.join(raiz, 'outra'), { nome: '  ', versao: '1' })).rejects.toMatchObject({ codigo: 'NOVO' });
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });
});

describe('recursos (CT-I06, CT-I07)', () => {
  it('PRUMO_RECURSOS indica kits e fontes', async () => {
    const raiz = await mkdtemp(path.join(os.tmpdir(), 'prumo-rec-'));
    try {
      await cp(diretorioKits(), path.join(raiz, 'kits'), { recursive: true });
      await cp(path.dirname(caminhoFonte('Jost', 'jost-latin-700-normal.woff2')), path.join(raiz, 'fontes'), { recursive: true });
      await cp(path.dirname(caminhoFonte('Atkinson Hyperlegible', 'atkinson-hyperlegible-latin-400-normal.woff2')), path.join(raiz, 'fontes'), { recursive: true });
      process.env.PRUMO_RECURSOS = raiz;
      expect(diretorioKits()).toBe(path.join(raiz, 'kits'));
      expect(caminhoFonte('Jost', 'jost-latin-700-normal.woff2')).toBe(path.join(raiz, 'fontes', 'jost-latin-700-normal.woff2'));
      const p = await novo();
      const r = await gerar(p.dir, { saida: path.join(p.dir, '..', 's') });
      expect(r.paginas.length).toBeGreaterThan(0);
      expect(statSync(path.join(r.saida, '_recursos', 'fontes', 'jost-latin-700-normal.woff2')).size).toBeGreaterThan(1000);
    } finally {
      delete process.env.PRUMO_RECURSOS;
      await rm(raiz, { recursive: true, force: true });
    }
  });
});
