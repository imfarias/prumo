import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { servir, type Servidor } from '../../src/docs/servir.js';
import { criarProjeto, type ProjetoTemp } from '../fabricas/projeto.js';

vi.setConfig({ testTimeout: 60_000 });
let p: ProjetoTemp | undefined;
let s: Servidor | undefined;
afterEach(async () => {
  await s?.parar();
  await p?.limpar();
  s = undefined;
  p = undefined;
});

/** GET cru (sem normalizar o caminho), para testar tentativas de sair da pasta. */
function bruto(url: string, caminho: string): Promise<number> {
  const u = new URL(url);
  return new Promise((ok, falha) => {
    http.get({ host: u.hostname, port: u.port, path: caminho }, (r) => {
      r.resume();
      ok(r.statusCode!);
    }).on('error', falha);
  });
}

describe('prumo servir (FA-08, RN-61, CA-15)', () => {
  it('serve só em 127.0.0.1, injeta a recarga, bloqueia caminhos fora da pasta e regenera ao salvar', async () => {
    p = await criarProjeto();
    const gerados: unknown[] = [];
    s = await servir(p.dir, { porta: 0, aoGerar: (r) => gerados.push(r) });
    expect(s.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(await (await fetch(`${s.url}saude`)).text()).toBe('ok');
    const inicio = await (await fetch(s.url)).text();
    expect(inicio).toContain("new EventSource('/__prumo/eventos')");
    const css = await fetch(`${s.url}recursos/prumo-docs.css`);
    expect(css.headers.get('content-type')).toBe('text/css; charset=utf-8');
    const proto = await (await fetch(`${s.url}prototipos/01_Portal/02_Portal_Lista_Parceiras/padrao.html`)).text();
    expect(proto).not.toContain('EventSource');
    expect(await bruto(s.url, '/../../../etc/passwd')).toBe(404);
    expect(await bruto(s.url, '/%2e%2e/%2e%2e/segredo.txt')).toBe(404);
    expect(await bruto(s.url, '/%E0%A4%A')).toBe(400);
    expect((await fetch(`${s.url}nao-existe.html`)).status).toBe(404);

    const eventos = await fetch(`${s.url}__prumo/eventos`);
    const leitor = eventos.body!.getReader();
    await leitor.read(); // ": conectado"
    await p.substituir('01_Portal/03_Portal_Contato.feature', 'Como a empresa pode aderir?', 'Pergunta nova do teste');
    let texto = '';
    while (!texto.includes('recarregar')) texto += new TextDecoder().decode((await leitor.read()).value);
    await leitor.cancel();
    await s.ocioso();
    expect(gerados.length).toBeGreaterThanOrEqual(2);
    const html = await (await fetch(s.url)).text();
    const pg = /href="(f\/01-portal-03-portal-contato[^"]+)"/.exec(html)![1]!;
    expect(await (await fetch(s.url + pg)).text()).toContain('Pergunta nova do teste');
  });

  it('porta ocupada vira erro de uso (DOC-05)', async () => {
    p = await criarProjeto();
    s = await servir(p.dir, { porta: 0 });
    const porta = Number(new URL(s.url).port);
    await expect(servir(p.dir, { porta })).rejects.toMatchObject({ codigo: 'DOC-05' });
  });

  it('erro na regeneração é repassado e o servidor continua', async () => {
    p = await criarProjeto();
    const erros: Error[] = [];
    s = await servir(p.dir, { porta: 0, aoGerar: (r) => r instanceof Error && erros.push(r) });
    await p.escrever('projeto.yml', 'projeto:\n  nome: [quebrado\n');
    await new Promise((r) => setTimeout(r, 1500));
    await s.ocioso();
    expect(erros[0]?.message).toMatch(/projeto\.yml inválido/);
    expect(await (await fetch(`${s.url}saude`)).text()).toBe('ok');
  });
});
