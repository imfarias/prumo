import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gerar, preparar, verificarPreparado } from '../../src/executar.js';
import { migrarConfig } from '../../src/config/migrar.js';
import { ErroPrumo } from '../../src/util/erros.js';
import type { ModeloTelas, Tela } from '../../src/modelo/tipos.js';
import { validarCnpj, validarCpf } from '../../src/dados/documentos.js';
import { criarProjeto, type ProjetoTemp } from '../fabricas/projeto.js';
import { fabricaFeature } from '../fabricas/feature.js';

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

const saidaDe = (p: ProjetoTemp) => path.join(p.dir, '..', 'saida', 'prototipos');
const pagina = (p: ProjetoTemp, modulo: string, tela: string, estado = 'padrao') => readFile(path.join(saidaDe(p), modulo, tela, `${estado}.html`), 'utf8');
const modelo = async (p: ProjetoTemp) => JSON.parse(await readFile(path.join(saidaDe(p), '..', 'modelo', 'telas.json'), 'utf8')) as ModeloTelas;
const tela = (m: ModeloTelas, id: string) => m.telas.find((t) => t.id === id) as Tela;

describe('pipeline completo do exemplo (CT-I01, CT-I23)', () => {
  it('gera telas.json, um HTML por estado e a navegação, em pasta com acento e espaço', async () => {
    const p = await novo();
    const r = await gerar(p.dir, { saida: saidaDe(p) });
    const m = await modelo(p);
    expect(m.versaoModelo).toBe('1.0.0');
    expect(m.telas.map((t) => t.id)).toEqual([
      '01_Portal_Início', '02_Portal_Lista_Parceiras', '03_Portal_Contato', '01_Acesso_Entrar', '01_Parceira_Cadastrar', '01_Gestão_Parceiras', '01_API_Indicadores',
    ]);
    const estados = m.telas.reduce((s, t) => s + t.estados.length, 0);
    expect(r.paginas).toHaveLength(estados);
    for (const pg of r.paginas) expect(existsSync(pg.arquivo), pg.arquivo).toBe(true);
    expect(await readFile(path.join(saidaDe(p), 'index.html'), 'utf8')).toContain('Lista de Parceiras');
    expect(await readdir(path.join(saidaDe(p), '_recursos', 'fontes'))).toContain('jost-latin-700-normal.woff2');
    expect(r.achados.filter((a) => a.severidade === 'erro')).toEqual([]);
  });
});

describe('inferência (CT-I02 a CT-I08)', () => {
  it('listagem: filtros, Filtrar/Limpar, colunas, paginação e estado vazio (CT-I02)', async () => {
    const p = await novo();
    await gerar(p.dir, { saida: saidaDe(p) });
    const t = tela(await modelo(p), '02_Portal_Lista_Parceiras');
    expect(t.layout).toBe('listagem');
    expect(t.filtros.map((c) => c.nome)).toEqual(['CNPJ', 'Nome', 'Situação']);
    expect(t.colunas.map((c) => c.nome)).toEqual(['CNPJ', 'Nome', 'Município', 'Situação']);
    expect(t.acoes.map((a) => [a.rotulo, a.primaria])).toEqual([['Filtrar', true], ['Limpar', false]]);
    expect(t.estados.map((e) => e.id)).toEqual(['padrao', 'aviso-2', 'vazio']);
    const html = await pagina(p, '01_Portal', '02_Portal_Lista_Parceiras');
    expect(html).toContain('data-testid="02-portal-lista-parceiras-tabela"');
    expect(html).toContain('data-testid="02-portal-lista-parceiras-paginacao"');
    const vazio = await pagina(p, '01_Portal', '02_Portal_Lista_Parceiras', 'vazio');
    expect(vazio).toContain('data-testid="02-portal-lista-parceiras-vazio"');
    expect(vazio).toContain('Nenhum registro encontrado para os filtros.');
  });

  it('formulário: obrigatórios, máscaras, LOV, confirmação, caixa, captcha e arquivos (CT-I03 a CT-I06)', async () => {
    const p = await novo();
    await gerar(p.dir, { saida: saidaDe(p) });
    const m = await modelo(p);
    const cad = tela(m, '01_Parceira_Cadastrar');
    const comp = Object.fromEntries(cad.campos.map((c) => [c.nome, c.componente]));
    expect(cad.layout).toBe('formulario');
    expect(comp).toEqual({ CNPJ: 'mascara', 'Razão Social': 'leitura', CEP: 'mascara', Fone: 'tel', Fax: 'tel', Documentos: 'arquivos', 'Declaração de veracidade': 'caixa' });
    expect(cad.campos.find((c) => c.nome === 'Documentos')?.opcoes).toEqual(['Contrato social', 'Comprovante de endereço', 'Certidão de regularidade']);
    expect(cad.secoes).toEqual([{ titulo: 'Empresa', campos: ['cnpj', 'razao-social', 'cep', 'fone', 'fax', 'documentos', 'declaracao-de-veracidade'] }]);
    const contato = tela(m, '03_Portal_Contato');
    const confirma = contato.campos.find((c) => c.nome === 'Confirme o E-mail')!;
    expect(confirma).toMatchObject({ componente: 'confirmacao', confirma: 'e-mail' });
    expect(contato.campos.find((c) => c.nome === 'Código verificador')?.componente).toBe('captcha');
    const lista = tela(m, '02_Portal_Lista_Parceiras');
    expect(lista.filtros.find((c) => c.nome === 'Situação')).toMatchObject({ componente: 'selecao', opcoes: ['Aguardando análise', 'Autorizada', 'Não autorizada', 'Inativa'] });
    expect(lista.filtros[0]!.sinais[0]!.descricao).toContain('máscara XX.XXX.XXX/XXXX-##');

    const html = await pagina(p, '03_Cadastro', '01_Parceira_Cadastrar');
    expect(html).toMatch(/<label for="01-parceira-cadastrar-cnpj">CNPJ<span class="obrig" aria-hidden="true">\*<\/span><\/label>\s*<input type="text" id="01-parceira-cadastrar-cnpj"[^>]*aria-required="true"/);
    expect(html).toContain('value="12.ABC.345/01DE-35"');
    expect(html).toContain('type="checkbox" id="01-parceira-cadastrar-declaracao-de-veracidade"');
  });

  it('estado de erro com MSG no campo citado (CT-I07)', async () => {
    const p = await novo();
    await gerar(p.dir, { saida: saidaDe(p) });
    const e = tela(await modelo(p), '03_Portal_Contato').estados.find((x) => x.tipo === 'erro')!;
    expect(e).toMatchObject({ id: 'erro-2', mensagem: { codigo: 'MSG-03', local: 'campo', campo: 'confirme-o-e-mail' } });
    const html = await pagina(p, '01_Portal', '03_Portal_Contato', 'erro-2');
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/id="03-portal-contato-confirme-o-e-mail"[^>]*aria-invalid="true" aria-describedby="03-portal-contato-confirme-o-e-mail-erro"/);
    expect(html).toContain('id="03-portal-contato-confirme-o-e-mail-erro"');
  });

  it('ação leva a outra tela, por título ou por link (CT-I08)', async () => {
    const p = await novo();
    await gerar(p.dir, { saida: saidaDe(p) });
    const m = await modelo(p);
    expect(tela(m, '01_Portal_Início').acoes.map((a) => [a.rotulo, a.destino])).toEqual([
      ['Lista de Parceiras', '02_Portal_Lista_Parceiras'], ['Contato', '03_Portal_Contato'], ['Entrar', '01_Acesso_Entrar'],
    ]);
    expect(tela(m, '01_Acesso_Entrar').acoes[0]).toMatchObject({ rotulo: 'Entrar no sistema', destino: '01_Gestão_Parceiras' });
    expect(await pagina(p, '01_Portal', '01_Portal_Início')).toContain('href="../../01_Portal/02_Portal_Lista_Parceiras/padrao.html"');
  });

  it('casca autenticada com o menu do perfil e item atual', async () => {
    const p = await novo();
    await gerar(p.dir, { saida: saidaDe(p) });
    const html = await pagina(p, '04_Gestão', '01_Gestão_Parceiras');
    expect(html).toContain('aria-label="Menu do perfil"');
    expect(html).toMatch(/aria-current="page">Gestão de Parceiras<\/a>/);
  });
});

describe('overrides (CT-I09, CT-I10)', () => {
  it('aplica seções, ordem e componente; avisa campo e tela inexistentes', async () => {
    const p = await novo();
    await p.escrever('telas.overrides.yml', [
      '03_Portal_Contato:',
      '  layout: formulario',
      '  ordem: [Mensagem, Nome]',
      '  secoes: [{ titulo: Quem escreve, campos: [nome, e-mail] }]',
      '  campos:',
      '    Fone: { componente: texto, ajuda: Com DDD }',
      '    Inexistente: { largura: "1/2" }',
      'Tela_Fantasma: { layout: leitura }',
    ].join('\n'));
    const r = await gerar(p.dir, { saida: saidaDe(p) });
    const t = tela(await modelo(p), '03_Portal_Contato');
    expect(t.campos.slice(0, 2).map((c) => c.nome)).toEqual(['Mensagem', 'Nome']);
    expect(t.secoes).toEqual([{ titulo: 'Quem escreve', campos: ['nome', 'e-mail'] }]);
    expect(t.campos.find((c) => c.nome === 'Fone')).toMatchObject({ componente: 'texto', ajuda: 'Com DDD' });
    expect(r.achados.filter((a) => a.codigo === 'override/campo-inexistente').map((a) => a.mensagem)).toEqual([
      expect.stringContaining('Inexistente'), expect.stringContaining('Tela_Fantasma'),
    ]);
    expect(await pagina(p, '01_Portal', '03_Portal_Contato')).toContain('<legend>Quem escreve</legend>');
  });

  it('HTML próprio ao lado da feature substitui a geração (FA-12)', async () => {
    const p = await novo();
    await p.escrever('05_API/01_API_Indicadores.html', '<!doctype html><title>próprio</title>');
    const r = await gerar(p.dir, { saida: saidaDe(p) });
    const pg = r.paginas.filter((x) => x.tela === '01_API_Indicadores');
    expect(pg).toEqual([expect.objectContaining({ arquivo: path.join(p.dir, '05_API', '01_API_Indicadores.html') })]);
    expect(existsSync(path.join(saidaDe(p), '05_API', '01_API_Indicadores'))).toBe(false);
  });
});

describe('mudar o requisito ou a identidade sem código (CT-I11, CT-I12, CA-02, CA-03)', () => {
  it('Fax obrigatório muda só esse campo', async () => {
    const p = await novo();
    await gerar(p.dir, { saida: saidaDe(p) });
    const antes = await pagina(p, '03_Cadastro', '01_Parceira_Cadastrar');
    await p.substituir('03_Cadastro/01_Parceira_Cadastrar.feature', '| Fax                      | S        | N           |', '| Fax                      | S        | S           |');
    await gerar(p.dir, { saida: saidaDe(p) });
    const depois = await pagina(p, '03_Cadastro', '01_Parceira_Cadastrar');
    const dif = depois.split('\n').filter((l, i) => l !== antes.split('\n')[i]);
    expect(dif).toHaveLength(2);
    expect(dif.join('\n')).toMatch(/Fax<span class="obrig"/);
    expect(dif.join('\n')).toMatch(/id="01-parceira-cadastrar-fax"[^>]*aria-required="true"/);
  });

  it('trocar a cor primária muda o CSS e não o HTML', async () => {
    const p = await novo();
    await gerar(p.dir, { saida: saidaDe(p) });
    const html = await pagina(p, '01_Portal', '02_Portal_Lista_Parceiras');
    await p.substituir('projeto.yml', 'primaria: "#1D3F8F"', 'primaria: "#0B6E4F"');
    await gerar(p.dir, { saida: saidaDe(p) });
    expect(await readFile(path.join(saidaDe(p), '_recursos', 'prumo.css'), 'utf8')).toContain('--primaria:#0B6E4F');
    expect(await pagina(p, '01_Portal', '02_Portal_Lista_Parceiras')).toBe(html);
  });
});

describe('configuração (CT-I13, CT-I14)', () => {
  it('sem projeto.yml usa o config.properties', async () => {
    const p = await novo();
    await p.remover('projeto.yml');
    const pr = await preparar(p.dir);
    expect(pr.fonte).toBe('config.properties');
    expect(pr.config.projeto).toMatchObject({ nome: 'Programa Exemplo', versao: '0.9', logo: 'Logo/logo.svg' });
    expect(pr.config.identidade.cores.menu).toBe('#0E1A33');
    expect(pr.achados.find((a) => a.codigo === 'config/properties')?.mensagem).toContain('migrar-config');
  });

  it('migrar-config cria um projeto.yml válido e não sobrescreve sem --forcar', async () => {
    const p = await novo();
    await p.remover('projeto.yml');
    await migrarConfig(p.dir);
    const yml = await p.ler('projeto.yml');
    expect(yml).toContain('# Identidade visual');
    const pr = await preparar(p.dir);
    expect(pr.fonte).toBe('projeto.yml');
    expect(pr.achados.filter((a) => a.codigo === 'config/invalida')).toEqual([]);
    expect(pr.config.projeto.nome).toBe('Programa Exemplo');
    await expect(migrarConfig(p.dir)).rejects.toThrow(ErroPrumo);
    await expect(migrarConfig(p.dir, { forcar: true })).resolves.toBeDefined();
  });

  it('pasta inexistente e pasta sem features são erros de uso', async () => {
    await expect(preparar('/nao/existe/mesmo')).rejects.toMatchObject({ codigo: 'CLI-01' });
    const p = await novo({ base: 'vazio' });
    await expect(preparar(p.dir)).rejects.toMatchObject({ codigo: 'CLI-02' });
  });
});

describe('robustez e determinismo (CT-I17, CT-I18, CT-I19)', () => {
  it('erro de sintaxe tira só aquela tela', async () => {
    const p = await novo();
    await p.escrever('06_Extra/01_Quebrada.feature', '# language: pt\nFuncionalidade: Q\n  Cenário: x\n    Dado y\n      | a | b |\n      | 1 |\n');
    await p.escrever('06_Extra/02_Boa.feature', fabricaFeature({ nome: '02_Boa', campos: [{ nome: 'Nome' }] }));
    const r = await gerar(p.dir, { saida: saidaDe(p) });
    expect(r.achados.filter((a) => a.codigo === 'sintaxe')).toHaveLength(1);
    expect((await modelo(p)).telas.map((t) => t.id)).toContain('02_Boa');
  });

  it('duas execuções em pastas diferentes produzem bytes idênticos', async () => {
    const a = await novo();
    const b = await novo();
    await gerar(a.dir, { saida: saidaDe(a) });
    await gerar(b.dir, { saida: saidaDe(b) });
    expect(await readFile(path.join(saidaDe(a), '..', 'modelo', 'telas.json'), 'utf8')).toBe(await readFile(path.join(saidaDe(b), '..', 'modelo', 'telas.json'), 'utf8'));
    for (const [m, t, e] of [['01_Portal', '02_Portal_Lista_Parceiras', 'padrao'], ['03_Cadastro', '01_Parceira_Cadastrar', 'padrao'], ['04_Gestão', '01_Gestão_Parceiras', 'vazio']] as const) {
      expect(await pagina(a, m, t, e)).toBe(await pagina(b, m, t, e));
    }
  });

  it('recorte por módulo gera só o módulo, mas verifica tudo', async () => {
    const p = await novo();
    await p.substituir('01_Portal/01_Portal_Início.feature', 'Apresentação | N', 'Apresentação [x](#!/feature/09_X_01_X) | N');
    const r = await gerar(p.dir, { saida: saidaDe(p), recorte: { modulos: ['04_Gestão'] } });
    expect(new Set(r.paginas.map((x) => x.tela))).toEqual(new Set(['01_Gestão_Parceiras']));
    expect(r.achados.some((a) => a.codigo === 'link/feature-inexistente' && a.arquivo.startsWith('01_Portal'))).toBe(true);
  });
});

describe('dados fictícios (CA-11)', () => {
  it('CNPJs e CPFs das páginas são válidos e os nomes terminam em Exemplo', async () => {
    const p = await novo();
    await gerar(p.dir, { saida: saidaDe(p) });
    // Placeholders de máscara (00.000.000/0000-00) não são dados.
    const html = (await pagina(p, '04_Gestão', '01_Gestão_Parceiras') + (await pagina(p, '01_Portal', '02_Portal_Lista_Parceiras'))).replace(/placeholder="[^"]*"/g, '');
    const cnpjs = html.match(/\b[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}\b/g) ?? [];
    expect(cnpjs.length).toBeGreaterThan(5);
    for (const c of cnpjs) expect(validarCnpj(c), c).toBe(true);
    const cpfs = (await pagina(p, '02_Acesso', '01_Acesso_Entrar')).replace(/placeholder="[^"]*"/g, '').match(/\d{3}\.\d{3}\.\d{3}-\d{2}/g) ?? [];
    for (const c of cpfs) expect(validarCpf(c), c).toBe(true);
    const nomes = [...html.matchAll(/<td data-rotulo="(?:Nome|Razão Social)">([^<]+)<\/td>/g)].map((x) => x[1]!);
    expect(nomes.length).toBeGreaterThan(3);
    for (const n of nomes) expect(n).toMatch(/Exemplo/);
  });

  it('verificação do exemplo segue limpa depois de gerar', async () => {
    const p = await novo();
    await gerar(p.dir, { saida: saidaDe(p) });
    expect(verificarPreparado(await preparar(p.dir)).filter((a) => a.severidade === 'erro')).toEqual([]);
  });
});
