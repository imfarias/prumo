import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { preparar, verificarPreparado } from '../../src/executar.js';
import type { Achado } from '../../src/config/esquema.js';
import { criarProjeto, type ProjetoTemp } from '../fabricas/projeto.js';
import { fabricaFeature, linkRegra } from '../fabricas/feature.js';

const R = 'Regras_de_negócio/EXEMPLO_Regras_de_negócio.feature';

describe('verificação — caso limpo (CT-I16)', () => {
  it('o exemplo fictício não tem erros nem avisos', async () => {
    const p = await criarProjeto();
    try {
      const achados = verificarPreparado(await preparar(p.dir));
      expect(achados.filter((a) => a.severidade !== 'info')).toEqual([]);
    } finally {
      await p.limpar();
    }
  });
});

describe('verificação — problemas plantados (CT-I15, CA-07)', () => {
  let p: ProjetoTemp;
  let achados: Achado[];
  const de = (codigo: string) => achados.filter((a) => a.codigo === codigo);

  beforeAll(async () => {
    p = await criarProjeto();
    // RN-34 e RN-35: regra nunca citada e código duplicado, no fim do arquivo de regras (posições 8 e 9).
    const regras = await p.ler(R);
    await p.escrever(R, `${regras}\n  Cenário: RNG-06 - Nunca citada\n    Quando nada\n\n  Cenário: RNG-05 - Duplicada\n    Quando nada\n`);
    // RN-30, RN-32, RN-33 e RN-31 na lista de parceiras.
    await p.substituir('01_Portal/02_Portal_Lista_Parceiras.feature', 'Pesquisa por parte da razão social',
      `[RNG-03](${linkRegra(99)}) e [RNG-01](${linkRegra(2)}) conforme a RNG-77 e [tela](#!/feature/01_Portal_99_Inexistente)`);
    // RN-37: exemplo fora da máscara.
    await p.substituir('03_Cadastro/01_Parceira_Cadastrar.feature', '| CEP   | 70.070-150         |', '| CEP   | 70070150           |');
    // RN-38: sem @fluxo-principal.
    await p.substituir('04_Gestão/01_Gestão_Parceiras.feature', '@fluxo-principal', '@consulta');
    // RN-39: ação que leva a uma funcionalidade inexistente.
    await p.substituir('02_Acesso/01_Acesso_Entrar.feature', '@validacao',
      '@fluxo-alternativo\n  Cenário: 03. Ajuda\n    Quando o responsável aciona a opção **Ajuda**\n    Então o sistema apresenta a [Ajuda](#!/feature/09_Ajuda_01_Ajuda)\n\n  @validacao');
    // RN-40: funcionalidade sem @prototipo.
    await p.escrever('06_Extra/01_Extra_Sem_Prototipo.feature', fabricaFeature({ nome: '01_Extra_Sem_Prototipo', prototipo: false, campos: [{ nome: 'Nome', regras: `[RNG-03](${linkRegra(3)})` }] }));
    // RN-41: imagem referenciada que não existe.
    await p.remover('05_API/01_API_Indicadores.png');
    // RN-42: erro de sintaxe (tabela com células a menos).
    await p.escrever('06_Extra/02_Extra_Quebrada.feature', '# language: pt\nFuncionalidade: 02_Extra_Quebrada\n  Cenário: x\n    Dado y\n      | a | b |\n      | 1 |\n');
    // RN-36: exige regra em campo editável.
    await p.substituir('projeto.yml', 'documentacao:', 'verificacao:\n  exigir_regra_em_editavel: true\ndocumentacao:');
    achados = verificarPreparado(await preparar(p.dir));
  });
  afterAll(() => p.limpar());

  it('acha um achado de cada código, com arquivo e linha', () => {
    const lista = 'Lista_Parceiras';
    expect(de('link/cenario-inexistente')).toEqual([expect.objectContaining({ severidade: 'erro', arquivo: '01_Portal/02_Portal_Lista_Parceiras.feature', linha: 24 })]);
    expect(de('link/cenario-inexistente')[0]!.mensagem).toContain('fora do intervalo do arquivo (0–9)');
    expect(de('link/cenario-inexistente')[0]!.sugestao).toContain('Regras_de_negócio_EXEMPLO_Regras_de_negócio/3');
    expect(de('link/rotulo-divergente')).toEqual([expect.objectContaining({ linha: 24, sugestao: expect.stringContaining('/1') })]);
    expect(de('link/feature-inexistente').map((a) => a.arquivo)).toEqual([`01_Portal/02_Portal_${lista}.feature`, '02_Acesso/01_Acesso_Entrar.feature']);
    expect(de('ref/inexistente')).toEqual([expect.objectContaining({ arquivo: `01_Portal/02_Portal_${lista}.feature`, linha: 24, mensagem: expect.stringContaining('RNG-77') })]);
    expect(de('ref/nao-usada')).toEqual([expect.objectContaining({ severidade: 'aviso', arquivo: R, mensagem: expect.stringContaining('RNG-06') })]);
    expect(de('ref/duplicada')).toEqual([expect.objectContaining({ severidade: 'erro', arquivo: R, mensagem: expect.stringContaining('RNG-05') })]);
    expect(de('campo/sem-regra').length).toBeGreaterThan(0);
    expect(de('exemplo/mascara')).toEqual([expect.objectContaining({ arquivo: '03_Cadastro/01_Parceira_Cadastrar.feature', linha: 37, mensagem: expect.stringContaining('70070150') })]);
    expect(de('fluxo/sem-principal').map((a) => a.arquivo)).toEqual(['04_Gestão/01_Gestão_Parceiras.feature']);
    expect(de('acao/destino-inexistente')).toEqual([expect.objectContaining({ arquivo: '02_Acesso/01_Acesso_Entrar.feature', mensagem: expect.stringContaining('Ajuda') })]);
    expect(de('prototipo/ausente')).toEqual([expect.objectContaining({ arquivo: '06_Extra/01_Extra_Sem_Prototipo.feature' })]);
    expect(de('prototipo/imagem-inexistente')).toEqual([expect.objectContaining({ arquivo: '05_API/01_API_Indicadores.feature', linha: 42 })]);
    expect(de('sintaxe')).toEqual([expect.objectContaining({ arquivo: '06_Extra/02_Extra_Quebrada.feature', linha: 6 })]);
  });

  it('cobre os 13 códigos da RN-30 à RN-42', () => {
    const codigos = new Set(achados.map((a) => a.codigo));
    for (const c of ['link/cenario-inexistente', 'link/feature-inexistente', 'link/rotulo-divergente', 'ref/inexistente', 'ref/nao-usada', 'ref/duplicada',
      'campo/sem-regra', 'exemplo/mascara', 'fluxo/sem-principal', 'acao/destino-inexistente', 'prototipo/ausente', 'prototipo/imagem-inexistente', 'sintaxe']) {
      expect(codigos, c).toContain(c);
    }
  });

  it('a severidade pode ser trocada por código no projeto.yml', async () => {
    await p.substituir('projeto.yml', 'exigir_regra_em_editavel: true', 'exigir_regra_em_editavel: true\n  severidades: { link/rotulo-divergente: aviso }');
    const novos = verificarPreparado(await preparar(p.dir));
    expect(novos.find((a) => a.codigo === 'link/rotulo-divergente')?.severidade).toBe('aviso');
  });
});
