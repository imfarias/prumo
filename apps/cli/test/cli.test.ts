import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { criarProjeto, type ProjetoTemp } from '../../../packages/motor/test/fabricas/projeto.js';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/main.js');

function prumo(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', ...env } });
  return { codigo: r.status, out: r.stdout, err: r.stderr };
}

let projetos: ProjetoTemp[] = [];
afterEach(async () => {
  await Promise.all(projetos.map((p) => p.limpar()));
  projetos = [];
});
async function novo() {
  const p = await criarProjeto();
  projetos.push(p);
  return p;
}

describe('prumo verificar (CT-C01 a CT-C03)', () => {
  it('exemplo limpo: saída 0', async () => {
    const p = await novo();
    const r = prumo(['verificar', '--specs', p.dir]);
    expect(r.codigo).toBe(0);
    expect(r.out).toContain('Verificação: 0 erros, 0 avisos');
    expect(r.out).toContain('7 telas · 10 arquivos · configuração: projeto.yml');
  });

  it('com erro: saída 1 e linha "severidade arquivo:linha código mensagem"', async () => {
    const p = await novo();
    await p.substituir('01_Portal/02_Portal_Lista_Parceiras.feature', 'Regras_de_negócio/1)', 'Regras_de_negócio/42)');
    const r = prumo(['verificar', '--specs', p.dir]);
    expect(r.codigo).toBe(1);
    expect(r.out).toMatch(/ {2}erro {3}01_Portal\/02_Portal_Lista_Parceiras\.feature:23 {2}link\/cenario-inexistente {2}Link \[RNG-01\]/);
  });

  it('--formato json: só JSON no stdout', async () => {
    const p = await novo();
    await p.substituir('01_Portal/02_Portal_Lista_Parceiras.feature', 'Regras_de_negócio/1)', 'Regras_de_negócio/42)');
    const r = prumo(['verificar', '--specs', p.dir, '--formato', 'json']);
    expect(r.codigo).toBe(1);
    const j = JSON.parse(r.out);
    expect(j.resumo).toMatchObject({ erros: 1, avisos: 0 });
    expect(j.achados[0]).toMatchObject({ severidade: 'erro', codigo: 'link/cenario-inexistente', linha: 23 });
    expect(r.err).toContain('1 erros');
  });

  it('--avisos-quebram', async () => {
    const p = await novo();
    await p.substituir('04_Gestão/01_Gestão_Parceiras.feature', '@fluxo-principal', '@consulta');
    expect(prumo(['verificar', '--specs', p.dir]).codigo).toBe(0);
    expect(prumo(['verificar', '--specs', p.dir, '--avisos-quebram']).codigo).toBe(1);
  });
});

describe('erros de uso (CT-C04 a CT-C06)', () => {
  it('--specs inexistente: saída 2 e CLI-01', () => {
    const r = prumo(['verificar', '--specs', path.join('nao', 'existe')]);
    expect(r.codigo).toBe(2);
    expect(r.err).toContain('Pasta de especificações não encontrada');
  });

  it('projeto.yml inválido: saída 2 com a linha', async () => {
    const p = await novo();
    await p.escrever('projeto.yml', 'projeto:\n  nome: [x\n');
    const r = prumo(['verificar', '--specs', p.dir]);
    expect(r.codigo).toBe(2);
    expect(r.err).toMatch(/projeto\.yml inválido na linha \d+/);
  });

  it('capturar sem navegador: saída 2 e a orientação', async () => {
    const p = await novo();
    const r = prumo(['capturar', '--specs', p.dir, '--saida', path.join(p.dir, '..', 'saida')], { PRUMO_CHROMIUM: path.join(p.dir, 'nao-existe.exe') });
    expect(r.codigo).toBe(2);
    expect(r.err).toContain('Nenhum Chrome, Edge ou Chromium encontrado');
  });

  it('largura fora do intervalo: saída 2', async () => {
    const p = await novo();
    expect(prumo(['capturar', '--specs', p.dir, '--largura', '10']).codigo).toBe(2);
  });
});

describe('prumo gerar e ajuda (CT-C07, CT-C08)', () => {
  it('--tela gera só a tela pedida', async () => {
    const p = await novo();
    const saida = path.join(p.dir, '..', 'saida', 'prototipos');
    const r = prumo(['gerar', '--specs', p.dir, '--saida', saida, '--tela', '03_Portal_Contato']);
    expect(r.codigo).toBe(0);
    expect(r.out).toContain('1 telas · 3 estados');
  });

  it('ajuda em português', () => {
    const r = prumo(['--help']);
    expect(r.out).toContain('Gera protótipos, documentação e verificação');
    expect(r.out).toContain('migrar-config');
    expect(prumo(['verificar', '--help']).out).toContain('pasta de especificações');
  });

  it('migrar-config cria o projeto.yml', async () => {
    const p = await novo();
    await p.remover('projeto.yml');
    const r = prumo(['migrar-config', '--specs', p.dir]);
    expect(r.codigo).toBe(0);
    expect(await p.ler('projeto.yml')).toContain('nome: "Programa Exemplo"');
    expect(prumo(['migrar-config', '--specs', p.dir]).codigo).toBe(2);
  });
});
