import { describe, expect, it } from 'vitest';
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import { converter } from '../../src/parser/ler.js';
import { extrairLinks } from '../../src/parser/links.js';
import { chaveCodigo } from '../../src/parser/indice.js';
import { classificarTabela, grupoDoPasso } from '../../src/modelo/montar.js';

function ler(texto: string, caminho = '/specs/Pasta/Arquivo.feature') {
  const doc = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher()).parse(texto);
  return converter(doc, caminho, '/specs', texto)!;
}

const COM_CONTEXTO = `# language: pt
Funcionalidade: Arquivo
  # Módulo: 01 Portal Público
  # Tipo: Consulta
  #   Fluxo :  Pesquisa pública
  Contexto: Critérios
    Dado algo
  Cenário: RNG-01 - Primeira
    Quando x
  Esquema do Cenário: RNG-02 - Esquema
    Quando <a>
    Exemplos:
      | a |
      | 1 |
      | 2 |
  @prototipo
  Cenário: Protótipo
  **Título do protótipo**
  ![Image](Arquivo.png)
`;

describe('posição Pirilampo (CT-U01)', () => {
  it('com Contexto: Contexto = 0 e o 1º cenário = 1; Esquema conta 1', () => {
    const a = ler(COM_CONTEXTO);
    expect(a.filhos.map((f) => [f.posicao, f.tipo, f.titulo])).toEqual([
      [0, 'Contexto', 'Critérios'],
      [1, 'Cenário', 'RNG-01 - Primeira'],
      [2, 'Esquema', 'RNG-02 - Esquema'],
      [3, 'Cenário', 'Protótipo'],
    ]);
    expect(a.endereco).toBe('Pasta_Arquivo');
  });

  it('sem Contexto: o 1º cenário = 0 (como MSG no arquivo de mensagens)', () => {
    const a = ler(`# language: pt\nFuncionalidade: M\n  Cenário: Mensagem de Interface\n    Dado x\n  Cenário: MSG-01\n    Dado y\n`);
    expect(a.filhos.map((f) => f.posicao)).toEqual([0, 1]);
    expect(a.filhos[1]!.titulo).toBe('MSG-01');
  });

  it('aceita BOM e Markdown na descrição', () => {
    const a = ler('﻿# language: pt\nFuncionalidade: F\n  ---\n  **COMO** a<br>\n  Cenário: C\n    Dado x\n');
    expect(a.descricao).toContain('**COMO**');
  });
});

describe('metadados (CT-U03)', () => {
  it('lê Módulo, Tipo e Fluxo com acentos e espaços', () => {
    const a = ler(COM_CONTEXTO);
    expect(a.metadados['Módulo']).toMatchObject({ valor: '01 Portal Público', linha: 3 });
    expect(a.metadados['Tipo']?.valor).toBe('Consulta');
    expect(a.metadados['Fluxo']?.valor).toBe('Pesquisa pública');
  });
  it('ausência não quebra', () => {
    expect(ler('# language: pt\nFuncionalidade: F\n  Cenário: C\n    Dado x\n').metadados['Tipo']).toBeUndefined();
  });
  it('acha a imagem do protótipo com a linha', () => {
    const a = ler(COM_CONTEXTO);
    expect(a.imagens).toEqual([{ alvo: 'Arquivo.png', origem: { arquivo: 'Pasta/Arquivo.feature', linha: 19 } }]);
  });
});

describe('links (CT-U02)', () => {
  const o = { arquivo: 'a.feature', linha: 3 };
  it('cenário e funcionalidade', () => {
    const [c, f] = extrairLinks('[RNG-06](#/scenario/Regras_de_negócio_X/6) e [Tela](#!/feature/01_Portal_02_Lista)', o);
    expect(c).toMatchObject({ rotulo: 'RNG-06', tipo: 'cenario', endereco: 'Regras_de_negócio_X', posicao: 6 });
    expect(f).toMatchObject({ rotulo: 'Tela', tipo: 'feature', endereco: '01_Portal_02_Lista' });
  });
  it('vários links na mesma célula, com coluna', () => {
    const l = extrairLinks('[RNG-01](#/scenario/A/1), [LOV-02](#/scenario/A/7)', o);
    expect(l.map((x) => [x.rotulo, x.posicao, x.origem.coluna])).toEqual([['RNG-01', 1, 1], ['LOV-02', 7, 27]]);
  });
  it('texto sem link e imagem não viram link', () => {
    expect(extrairLinks('conforme a RNG-06 e ![Image](x.png)', o)).toEqual([]);
  });
  it('posição não numérica fica indefinida', () => {
    expect(extrairLinks('[x](#/scenario/A/abc)', o)[0]!.posicao).toBeUndefined();
  });
});

describe('códigos', () => {
  it('normaliza RNG, LOV, MSG e E-mail', () => {
    expect(chaveCodigo('RNG-6 - Validação')).toMatchObject({ chave: 'RNG-06', tipo: 'RNG', resto: 'Validação' });
    expect(chaveCodigo('LOV-06 - Regime')).toMatchObject({ chave: 'LOV-06', tipo: 'LOV' });
    expect(chaveCodigo('MSG-01')).toMatchObject({ chave: 'MSG-01', tipo: 'MSG' });
    expect(chaveCodigo('E-mail-03 - Fale')).toMatchObject({ chave: 'EMAIL-03', tipo: 'EMAIL', codigo: 'E-mail-03' });
    expect(chaveCodigo('Email-1')).toMatchObject({ chave: 'EMAIL-01' });
    expect(chaveCodigo('Protótipo')).toBeUndefined();
  });
});

describe('tabelas (CT-U04)', () => {
  const t = (cabecalho: string[]) => ({ cabecalho, linhas: [], linha: 1 });
  it('classifica definição, exemplo e outra', () => {
    expect(classificarTabela(t(['Campo', 'Editável', 'Obrigatório', 'Regras']))).toBe('definicao');
    expect(classificarTabela(t(['Campo', 'Regras']))).toBe('definicao');
    expect(classificarTabela(t(['Campo', 'Exemplo']))).toBe('exemplo');
    expect(classificarTabela(t(['Perfil', 'Funcionalidade']))).toBe('outra');
  });
  it('grupo pelo último parâmetro do passo', () => {
    expect(grupoDoPasso('E o sistema apresenta os <Filtros>')).toBe('Filtros');
    expect(grupoDoPasso('preenche <Filtros> e vê <Campos>')).toBe('Campos');
    expect(grupoDoPasso('apresenta os campos')).toBe('Campos');
  });
});
