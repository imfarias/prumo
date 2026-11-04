import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lancarChromium } from '../../../packages/motor/src/navegador/playwright.js';
import { criarProjeto, type ProjetoTemp } from '../../../packages/motor/test/fabricas/projeto.js';
import { criarRepositorio } from '../../../packages/motor/test/fabricas/repositorio-git.js';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/main.js');
vi.setConfig({ testTimeout: 120_000 });

function prumo(args: string[]) {
  const r = spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  return { codigo: r.status, out: r.stdout, err: r.stderr };
}

let navegador = false;
try {
  await (await lancarChromium()).close();
  navegador = true;
} catch (e) {
  if (process.env.PRUMO_EXIGIR_NAVEGADOR) throw e;
}

let projetos: ProjetoTemp[] = [];
afterEach(async () => {
  await Promise.all(projetos.map((p) => p.limpar()));
  projetos = [];
});

describe('prumo docs (CT-C01 a CT-C04, CT-C07)', () => {
  it('gera a documentação em <specs>/../html', async () => {
    const p = await criarProjeto();
    projetos.push(p);
    const r = prumo(['docs', '--specs', p.dir]);
    expect(r.codigo).toBe(0);
    expect(r.out).toMatch(/Documentação gerada: 10 funcionalidades, \d+ cenários, 12 referências · \d+ KB · .*index\.html/);
    expect(existsSync(path.join(p.dir, '..', 'html', 'index.html'))).toBe(true);
  });

  it('--arquivo-unico gera um index.html só', async () => {
    const p = await criarProjeto();
    projetos.push(p);
    const r = prumo(['docs', '--specs', p.dir, '--arquivo-unico', '--saida', path.join(p.dir, '..', 'u')]);
    expect(r.codigo).toBe(0);
    expect(r.out).toContain('(arquivo único)');
  });

  it('--comparar com tag do Git e com referência inexistente', async () => {
    const repo = await criarRepositorio();
    projetos.push(repo);
    const r = prumo(['docs', '--specs', repo.dir, '--comparar', 'v1']);
    expect(r.codigo).toBe(0);
    expect(r.out).toContain('Comparado com v1: 2 novas, 1 alteradas, 2 removidas.');
    const e = prumo(['docs', '--specs', repo.dir, '--comparar', 'nao-existe']);
    expect(e.codigo).toBe(2);
    expect(e.err).toContain('Versão anterior não encontrada: nao-existe');
  });

  it('--estrito sai com 1 se houver erro', async () => {
    const p = await criarProjeto();
    projetos.push(p);
    await p.substituir('01_Portal/02_Portal_Lista_Parceiras.feature', 'Regras_de_negócio/1)', 'Regras_de_negócio/42)');
    expect(prumo(['docs', '--specs', p.dir]).codigo).toBe(0);
    expect(prumo(['docs', '--specs', p.dir, '--estrito']).codigo).toBe(1);
  });
});

describe.skipIf(!navegador)('prumo pdf e servir (CT-C05, CT-C06, CT-E02)', () => {
  it('pdf de um módulo', async () => {
    const p = await criarProjeto();
    projetos.push(p);
    const saida = path.join(p.dir, '..', 'portal.pdf');
    const r = prumo(['pdf', '--specs', p.dir, '--saida', saida, '--modulo', '01_Portal']);
    expect(r.codigo).toBe(0);
    expect(r.out).toMatch(/PDF gerado: \d+ páginas/);
    expect(existsSync(saida)).toBe(true);
  });

  it('servir: responde, serve a documentação e avisa a página ao salvar uma feature', async () => {
    const p = await criarProjeto();
    projetos.push(p);
    const filho = spawn(process.execPath, [BIN, 'servir', '--specs', p.dir, '--porta', '0'], { env: { ...process.env, NO_COLOR: '1' } });
    try {
      const url = await new Promise<string>((ok, falha) => {
        let buf = '';
        filho.stdout.on('data', (d: Buffer) => {
          buf += d.toString();
          const m = /Servindo em (http:\/\/127\.0\.0\.1:\d+\/)/.exec(buf);
          if (m) ok(m[1]!);
        });
        filho.once('exit', (c) => falha(new Error(`saiu com ${c}`)));
      });
      expect(await (await fetch(`${url}saude`)).text()).toBe('ok');
      const inicio = await (await fetch(url)).text();
      expect(inicio).toContain('Programa Exemplo');
      expect(inicio).toContain("new EventSource('/__prumo/eventos')");
      expect((await fetch(`${url}../../etc/passwd`)).status).toBe(404);

      const eventos = await fetch(`${url}__prumo/eventos`);
      const leitor = eventos.body!.getReader();
      const t0 = Date.now();
      await p.substituir('01_Portal/03_Portal_Contato.feature', 'Como a empresa pode aderir?', 'Texto alterado pelo teste');
      let texto = '';
      while (!texto.includes('recarregar')) texto += new TextDecoder().decode((await leitor.read()).value);
      expect(Date.now() - t0).toBeLessThan(10_000);
      await leitor.cancel();
      const pg = (await (await fetch(url)).text()).match(/href="(f\/01-portal-03-portal-contato[^"]+)"/)![1]!;
      expect(await (await fetch(url + pg)).text()).toContain('Texto alterado pelo teste');
    } finally {
      filho.kill();
    }
  });
});
