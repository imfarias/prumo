import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gerar } from '../../src/executar.js';
import { criarProjeto, type ProjetoTemp } from '../fabricas/projeto.js';

let p: ProjetoTemp | undefined;
afterEach(async () => {
  await p?.limpar();
  p = undefined;
});
const saida = (q: ProjetoTemp) => path.join(q.dir, '..', 'saida', 'prototipos');

describe('identidade e recursos', () => {
  it('css_adicional é copiado com o que ele referencia (@import, fontes, imagens) e ligado nas páginas', async () => {
    p = await criarProjeto();
    await p.escrever('../Prototipos/fontes.css', '@font-face{font-family:X;src:url(fontes/x.woff2)}\n');
    await p.escrever('../Prototipos/fontes/x.woff2', 'fonte');
    await p.escrever('../Prototipos/img/fundo.png', 'png');
    await p.escrever('../Prototipos/vc.css', '@import url(fontes.css);\n.x{background:url("img/fundo.png")}\n.y{background:url(data:image/png;base64,AA)}\n.z{background:url(https://exemplo.com/a.png)}\n.w{background:url(nao-existe.png)}\n');
    await p.substituir('projeto.yml', 'fontes: { titulo: Jost, texto: Atkinson Hyperlegible }', 'fontes: { titulo: Jost, texto: Atkinson Hyperlegible }\n  css_adicional: ../Prototipos/vc.css');
    await gerar(p.dir, { saida: saida(p) });
    const rec = path.join(saida(p), '_recursos', 'adicional');
    for (const f of ['vc.css', 'fontes.css', 'fontes/x.woff2', 'img/fundo.png']) expect(existsSync(path.join(rec, f)), f).toBe(true);
    const html = await readFile(path.join(saida(p), '01_Portal', '02_Portal_Lista_Parceiras', 'padrao.html'), 'utf8');
    expect(html).toContain('href="../../_recursos/adicional/vc.css"');
  });

  it('avisa fonte não embutida, contraste baixo, logo e CSS inexistentes', async () => {
    p = await criarProjeto();
    await p.substituir('projeto.yml', 'design_system: proprio', 'design_system: proprio\n  css_adicional: nao/existe.css');
    await p.substituir('projeto.yml', 'fontes: { titulo: Jost, texto: Atkinson Hyperlegible }', 'fontes: { titulo: Rawline, texto: Atkinson Hyperlegible }');
    await p.substituir('projeto.yml', 'texto: "#0E1A33"', 'texto: "#BBBBBB"');
    await p.substituir('projeto.yml', 'logo: Logo/logo.svg', 'logo: Logo/nao-existe.png');
    const r = await gerar(p.dir, { saida: saida(p) });
    const codigos = r.achados.map((a) => a.codigo);
    for (const c of ['identidade/fonte', 'identidade/contraste', 'config/logo', 'config/css-adicional']) expect(codigos, c).toContain(c);
    expect(r.achados.find((a) => a.codigo === 'identidade/fonte')!.mensagem).toContain('Rawline');
    const css = await readFile(path.join(saida(p), '_recursos', 'prumo.css'), 'utf8');
    expect(css).toContain('--fonte-titulo:"Rawline", system-ui');
    expect(css).not.toContain('font-family:"Rawline"');
  });

  it('kit govbr (CA-01, CA-14): CSS do gov.br, Raleway embutida, cores do projeto ignoradas com aviso', async () => {
    p = await criarProjeto();
    await p.substituir('projeto.yml', 'design_system: proprio', 'design_system: govbr');
    const r = await gerar(p.dir, { saida: saida(p) });
    expect(r.achados.find((a) => a.codigo === 'kit/cor-ignorada')?.mensagem).toMatch(/primaria/);
    const css = await readFile(path.join(saida(p), '_recursos', 'prumo.css'), 'utf8');
    expect(css).toContain('gov.br DS 3.7.0');
    expect(css).toContain('font-family:"Raleway"');
    expect(css).not.toContain('--fonte-titulo');
    expect(css.length).toBeLessThan(120 * 1024);
    const html = await readFile(path.join(saida(p), '01_Portal', '03_Portal_Contato', 'padrao.html'), 'utf8');
    expect(html).toContain('class="br-header"');
    expect(html).toContain('class="br-input');
    expect(html).toContain('br-button primary');
  });

  it('kit govbr não acusa cores iguais ao padrão (projeto novo)', async () => {
    p = await criarProjeto();
    await p.substituir('projeto.yml', 'design_system: proprio', 'design_system: govbr');
    await p.substituir('projeto.yml', /cores:[^\n]*(\n {4}[^\n]*)*/, 'cores: {}');
    const r = await gerar(p.dir, { saida: saida(p) });
    expect(r.achados.map((a) => a.codigo)).not.toContain('kit/cor-ignorada');
  });
});
