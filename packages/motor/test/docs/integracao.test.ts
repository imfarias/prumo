import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gerarDocumentacao } from '../../src/docs/gerar.js';
import { prepararVersaoAnterior } from '../../src/docs/anterior.js';
import { arquivoDaPagina } from '../../src/docs/modelo.js';
import { ErroPrumo } from '../../src/util/erros.js';
import { criarProjeto, type ProjetoTemp } from '../fabricas/projeto.js';
import { aplicarMudancas, criarRepositorio } from '../fabricas/repositorio-git.js';

let projetos: ProjetoTemp[] = [];
async function novo(o?: Parameters<typeof criarProjeto>[0]) {
  const p = await criarProjeto(o);
  projetos.push(p);
  return p;
}
afterEach(async () => {
  await Promise.all(projetos.map((p) => p.limpar()));
  projetos = [];
});

const html = (p: ProjetoTemp) => path.join(p.dir, '..', 'html');
const pagina = (p: ProjetoTemp, end: string) => readFile(path.join(html(p), 'f', arquivoDaPagina(end)), 'utf8');

describe('documentação em pasta (CT-I01 a CT-I07)', () => {
  it('gera index, uma página por funcionalidade, Matriz, recursos e protótipos no lugar do Pirilampo', async () => {
    const p = await novo();
    const r = await gerarDocumentacao(p.dir);
    expect(r.saida).toBe(html(p));
    expect(r.modo).toBe('pasta');
    for (const f of ['index.html', 'matriz.html', 'recursos/prumo-docs.css', 'recursos/prumo-docs.js', 'recursos/dados.js', 'recursos/fontes/jost-latin-700-normal.woff2', 'recursos/logo.svg', 'prototipos/01_Portal/02_Portal_Lista_Parceiras/padrao.html', '.prumo-arquivos']) {
      expect(existsSync(path.join(r.saida, f)), f).toBe(true);
    }
    expect((await readdir(path.join(r.saida, 'f'))).length).toBe(10);
    expect(existsSync(path.join(r.saida, 'mudancas.html'))).toBe(false);
  });

  it('árvore: módulos em ordem e regras/mensagens no fim (CT-I02)', async () => {
    const p = await novo();
    const { documentacao: d } = await gerarDocumentacao(p.dir);
    expect(d.arvore.map((n) => n.titulo)).toEqual(['01 Portal', '02 Acesso', '03 Cadastro', '04 Gestão', '05 API', 'Regras e mensagens']);
    expect(d.arvore.at(-1)!.filhos.map((n) => n.titulo)).toEqual(['Mensagem de Interface', 'Regras de negócio']);
  });

  it('página de tela: narrativa, metadados, cenários numerados com tags, tabelas e protótipo com estados (CT-I03)', async () => {
    const p = await novo();
    await gerarDocumentacao(p.dir);
    const h = await pagina(p, '01_Portal_02_Portal_Lista_Parceiras');
    expect(h).toContain('<h1>Lista de Parceiras');
    expect(h).toContain('<strong>COMO</strong> visitante do portal <strong>Exemplo</strong>');
    expect(h).toMatch(/<dt>Tipo<\/dt><dd>Consulta<\/dd>/);
    for (const n of [0, 1, 2, 3]) expect(h).toContain(`id="c-${n}"`);
    expect(h).toContain('<span class="tag">@fluxo-principal</span>');
    expect(h).toMatch(/<th scope="col">Campo<\/th><th scope="col">Editável<\/th>/);
    expect(h).toContain('<span class="sim">Sim</span>');
    for (const e of ['padrao', 'aviso-2', 'vazio']) expect(h).toContain(`data-estado="${e}" data-caminho="../prototipos/01_Portal/02_Portal_Lista_Parceiras/${e}.html"`);
    expect(h).toContain('src="../prototipos/01_Portal/02_Portal_Lista_Parceiras/padrao.html"');
    expect(h).toContain('apresenta os &lt;Filtros&gt;');
  });

  it('regras com "Usada em" e a Matriz (CT-I04, CT-I05)', async () => {
    const p = await novo();
    const { documentacao: d } = await gerarDocumentacao(p.dir);
    const regras = d.paginas.find((x) => x.nomeFeature === 'EXEMPLO_Regras_de_negócio')!;
    const rng01 = regras.filhos.find((f) => f.codigo === 'RNG-01')!;
    expect(rng01.usadaEm!.map((u) => u.pagina)).toEqual(['Portal Lista Parceiras', 'Parceira Cadastrar', 'Gestão Parceiras']);
    const lov01 = d.matriz.codigos.findIndex((c) => c.codigo === 'LOV-01');
    const lista = d.matriz.telas.findIndex((t) => t.endereco === '01_Portal_02_Portal_Lista_Parceiras');
    expect(d.matriz.marcas).toContainEqual([lista, lov01]);
    const h = await pagina(p, 'Regras_de_negócio_EXEMPLO_Regras_de_negócio');
    expect(h).toContain('data-testid="docs-usada-em-1"');
    expect(await readFile(path.join(html(p), 'matriz.html'), 'utf8')).toContain('<span class="sr">LOV-01 citada</span>');
  });

  it('links do Pirilampo viram links reais com a rota antiga guardada; nenhum quebrado (CT-I06)', async () => {
    const p = await novo();
    await gerarDocumentacao(p.dir);
    const h = await pagina(p, '01_Portal_03_Portal_Contato');
    const alvo = arquivoDaPagina('Regras_de_negócio_EXEMPLO_Regras_de_negócio');
    expect(h).toContain(`<a href="${alvo}#c-3" data-rota="#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/3" data-previa="Regras_de_negócio_EXEMPLO_Regras_de_negócio/3">RNG-03</a>`);
    const tudo = await Promise.all((await readdir(path.join(html(p), 'f'))).map((f) => readFile(path.join(html(p), 'f', f), 'utf8')));
    expect(tudo.join('').includes('data-quebrado')).toBe(false);
  });

  it('imagens das features e logo copiados (CT-I07)', async () => {
    const p = await novo();
    const r = await gerarDocumentacao(p.dir);
    expect(r.arquivos).toContain('recursos/img/01_Portal/02_Portal_Lista_Parceiras.png');
    expect(await pagina(p, '01_Portal_02_Portal_Lista_Parceiras')).toContain('src="../recursos/img/01_Portal/02_Portal_Lista_Parceiras.png"');
  });

  it('verificação na página inicial (CT-I19)', async () => {
    const p = await novo();
    await p.substituir('01_Portal/02_Portal_Lista_Parceiras.feature', 'Regras_de_negócio/1)', 'Regras_de_negócio/42)');
    const r = await gerarDocumentacao(p.dir);
    const inicio = await readFile(path.join(r.saida, 'index.html'), 'utf8');
    expect(inicio).toContain('1 erro, 0 avisos.');
    expect(inicio).toContain(`href="f/${arquivoDaPagina('01_Portal_02_Portal_Lista_Parceiras')}#c-0"`);
    expect(await pagina(p, '01_Portal_02_Portal_Lista_Parceiras')).toContain('data-quebrado="true"');
  });

  it('funcionalidade com erro de sintaxe entra marcada (FA-11)', async () => {
    const p = await novo();
    await p.escrever('06_Extra/01_Extra_Quebrada.feature', '# language: pt\nFuncionalidade: Q\n  Cenário: x\n    Dado y\n      | a | b |\n      | 1 |\n');
    const { documentacao: d } = await gerarDocumentacao(p.dir);
    const pg = d.paginas.find((x) => x.nomeFeature === '01_Extra_Quebrada')!;
    expect(pg.erroSintaxe?.linha).toBe(6);
    expect(await pagina(p, '06_Extra_01_Extra_Quebrada')).toContain('data-testid="docs-erro-sintaxe"');
  });
});

describe('arquivo único (CT-I08)', () => {
  it('só index.html, sem nenhum arquivo local referenciado, com todas as páginas e protótipos', async () => {
    const p = await novo();
    const r = await gerarDocumentacao(p.dir, { arquivoUnico: true });
    expect(r.arquivos).toEqual(['index.html']);
    const h = await readFile(path.join(r.saida, 'index.html'), 'utf8');
    expect(h).not.toMatch(/(src|href)="(?!#|data:|https:)[^"]+\.(png|svg|css|js|html)"/);
    expect([...h.matchAll(/<template id="pg-/g)]).toHaveLength(12);
    const dados = JSON.parse(/window\.PRUMO_DADOS=(.*?);<\/script>/s.exec(h)![1]!);
    expect(Object.keys(dados.prototipos)).toHaveLength(14);
    expect(dados.prototipos['03_Portal_Contato/erro-2']).toContain('<!--PRUMO-CSS-->');
    expect(dados.prototipos['01_Portal_Início/padrao']).toContain('src="prumo-rec:logo.svg"');
    expect(Object.keys(dados.recursosPrototipo)).toEqual(['logo.svg']);
    expect(dados.cssPrototipos).toContain('data:font/woff2;base64,');
  });
});

describe('arquivo único com CSS adicional e sem logo', () => {
  it('embute o CSS do projeto com suas fontes e funciona sem logo', async () => {
    const p = await novo();
    await p.escrever('../Prototipos/fontes/x.woff2', 'fonte');
    await p.escrever('../Prototipos/vc.css', ['@import url(fontes.css);', '@font-face{font-family:X;src:url(fontes/x.woff2)}', '.marca{letter-spacing:1px}', ''].join('\n'));
    await p.escrever('../Prototipos/fontes.css', '');
    await p.substituir('projeto.yml', 'fontes: { titulo: Jost, texto: Atkinson Hyperlegible }', ['fontes: { titulo: Jost, texto: Atkinson Hyperlegible }', '  css_adicional: ../Prototipos/vc.css'].join('\n'));
    await p.substituir('projeto.yml', /  logo: Logo\/logo\.svg\r?\n/, '');
    const r = await gerarDocumentacao(p.dir, { arquivoUnico: true });
    const h = await readFile(path.join(r.saida, 'index.html'), 'utf8');
    const dados = JSON.parse(/window\.PRUMO_DADOS=(.*?);<\/script>/s.exec(h)![1]!);
    expect(dados.cssPrototipos).toContain('.marca{letter-spacing:1px}');
    expect(dados.cssPrototipos).toContain('data:font/woff2;base64,Zm9udGU=');
    expect(dados.cssPrototipos).not.toContain('@import');
    expect(dados.recursosPrototipo).toEqual({});
    expect(h).not.toContain('<img src="data:image/svg');
  });
});

describe('limpeza segura (CT-I09, CA-17)', () => {
  it('não apaga o que não gerou; remove o que gerou antes; substitui o index do Pirilampo com aviso', async () => {
    const p = await novo();
    await p.escrever('../html/index.html', '<!doctype html><html data-ng-app="pirilampoApp"><title>Pirilampo</title></html>');
    await p.escrever('../html/anotacoes.txt', 'meu arquivo');
    const r1 = await gerarDocumentacao(p.dir);
    expect(r1.avisos.join()).toMatch(/Pirilampo\) foi substituído/);
    await p.remover('05_API');
    const r2 = await gerarDocumentacao(p.dir);
    expect(r2.avisos).toEqual([]);
    expect(existsSync(path.join(html(p), 'anotacoes.txt'))).toBe(true);
    expect(existsSync(path.join(html(p), 'f', arquivoDaPagina('05_API_01_API_Indicadores')))).toBe(false);
    expect(existsSync(path.join(html(p), 'prototipos', '05_API'))).toBe(true); // pasta vazia pode ficar; arquivos saem
    expect(await readdir(path.join(html(p), 'prototipos', '05_API', '01_API_Indicadores'))).toEqual([]);
  });
});

describe('comparação (CT-I10 a CT-I13)', () => {
  it('com pasta: nova, alterada (cenário mudado e removido), removida e renomeada', async () => {
    const anterior = await novo();
    const atual = await novo();
    await aplicarMudancas(atual);
    const r = await gerarDocumentacao(atual.dir, { comparar: anterior.dir });
    const c = r.documentacao.comparacao!;
    expect(c.novas.sort()).toEqual(['01_Portal_04_Portal_Ajuda', '04_Gestão_02_Gestão_Empresas']);
    expect(c.alteradas).toEqual(['01_Portal_03_Portal_Contato']);
    expect(c.removidas.map((x) => x.endereco).sort()).toEqual(['04_Gestão_01_Gestão_Parceiras', '05_API_01_API_Indicadores']);
    expect(c.renomeadas).toEqual([{ de: '04_Gestão_01_Gestão_Parceiras', para: '04_Gestão_02_Gestão_Empresas' }]);
    const contato = r.documentacao.paginas.find((x) => x.nomeFeature === '03_Portal_Contato')!;
    const mudou = contato.filhos.find((f) => f.situacao === 'alterada')!;
    expect(mudou.titulo).toBe('01. Enviar mensagem');
    expect(mudou.diffHtml).toContain('Enviar<ins><span class="sr">incluído: </span> mensagem</ins>');
    expect(contato.removidos.map((x) => x.titulo)).toEqual(['02. E-mails diferentes']);
    expect(contato.anterior?.filhos.length).toBe(4);
    expect(existsSync(path.join(r.saida, 'mudancas.html'))).toBe(true);
    expect(existsSync(path.join(r.saida, 'prototipos-anterior', '01_Portal', '03_Portal_Contato', 'padrao.html'))).toBe(true);
    const h = await readFile(path.join(r.saida, 'index.html'), 'utf8');
    expect(h).toMatch(/<span class="situacao alterada"[^>]*>alterada<\/span>/);
  });

  it('com referência do Git: mesmo resultado e o repositório fica intacto', async () => {
    const repo = await criarRepositorio();
    projetos.push(repo);
    const r = await gerarDocumentacao(repo.dir, { comparar: 'v1' });
    expect(r.documentacao.comparacao!.alteradas).toEqual(['01_Portal_03_Portal_Contato']);
    expect(r.documentacao.comparacao!.novas.sort()).toEqual(['01_Portal_04_Portal_Ajuda', '04_Gestão_02_Gestão_Empresas']);
    expect(repo.git('status', '--porcelain', '--', path.basename(repo.dir)).trim()).toBe('');
    const r2 = await gerarDocumentacao(repo.dir, { comparar: 'HEAD~1', saida: path.join(repo.raizGit, 'html2') });
    expect(r2.documentacao.comparacao!.versao).toBe('HEAD~1');
  });

  it('referência inexistente e specs fora do Git são erros de uso (CT-I12)', async () => {
    const repo = await criarRepositorio();
    projetos.push(repo);
    await expect(prepararVersaoAnterior(repo.dir, 'nao-existe')).rejects.toMatchObject({ codigo: 'DOC-07' });
    const p = await novo();
    await writeFile(path.join(p.dir, '..', '.git'), 'gitdir: /nao/existe');
    await expect(prepararVersaoAnterior(p.dir, 'v1')).rejects.toBeInstanceOf(ErroPrumo);
  });
});

describe('determinismo e identidade (CT-I17, CT-I18)', () => {
  it('duas gerações em pastas diferentes dão os mesmos bytes, nos dois modos', async () => {
    const a = await novo();
    const b = await novo();
    for (const unico of [false, true]) {
      const ra = await gerarDocumentacao(a.dir, { arquivoUnico: unico, saida: path.join(a.dir, '..', `h${unico}`) });
      const rb = await gerarDocumentacao(b.dir, { arquivoUnico: unico, saida: path.join(b.dir, '..', `h${unico}`) });
      expect(ra.arquivos).toEqual(rb.arquivos);
      for (const f of ra.arquivos.filter((x) => /\.(html|js|css)$/.test(x))) {
        expect(await readFile(path.join(ra.saida, f), 'utf8'), f).toBe(await readFile(path.join(rb.saida, f), 'utf8'));
      }
    }
  });

  it('trocar a cor do menu muda o CSS da documentação (CA-16)', async () => {
    const p = await novo();
    await p.substituir('projeto.yml', 'menu: "#0E1A33"', 'menu: "#123456"');
    await gerarDocumentacao(p.dir);
    expect(await readFile(path.join(html(p), 'recursos', 'prumo-docs.css'), 'utf8')).toContain('--menu:#123456');
  });
});
