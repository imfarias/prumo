import { describe, expect, it } from 'vitest';
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import { interpretar, resolver, sugerir } from '../../web/rotas.js';
import { marcar, trecho } from '../../web/texto.js';
import { codigoDaConsulta } from '../../src/docs/busca-config.js';
import { arquivoDaPagina, lerRotaAntiga, rotuloEstado } from '../../src/docs/modelo.js';
import { compararVersoes, diffHtml, textoDoFilho } from '../../src/docs/comparar.js';
import { converter } from '../../src/parser/ler.js';

const BOM = String.fromCharCode(0xfeff);
const ler = (corpo: string, nome = 'Arq', texto = corpo.replace(BOM, '').startsWith('#') ? corpo : ['# language: pt', corpo].join('\n')) =>
  converter(new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher()).parse(texto), `/s/Pasta/${nome}.feature`, '/s', texto)!;

describe('rotas do navegador (CT-U03)', () => {
  it('formatos antigos e novos', () => {
    expect(interpretar('#/scenario/Regras_X/6')).toEqual({ tipo: 'f', endereco: 'Regras_X', posicao: 6 });
    expect(interpretar('#!/scenario/Regras_X/6')).toEqual({ tipo: 'f', endereco: 'Regras_X', posicao: 6 });
    expect(interpretar('#!/f/Regras_X/c/6')).toEqual({ tipo: 'f', endereco: 'Regras_X', posicao: 6 });
    expect(interpretar('#!/feature/01_Portal_02_Lista')).toEqual({ tipo: 'f', endereco: '01_Portal_02_Lista', termo: undefined });
    expect(interpretar('#/feature/01_Portal_02_Lista')).toMatchObject({ tipo: 'f', endereco: '01_Portal_02_Lista' });
    expect(interpretar('#!/feature/01_Portal_02_Lista/CNPJ%20da%20empresa')).toEqual({ tipo: 'f', endereco: '01_Portal_02_Lista', termo: 'CNPJ da empresa' });
    expect(interpretar('#!/busca/rng%206')).toEqual({ tipo: 'busca', termo: 'rng 6' });
    expect(interpretar('#!/matriz')).toEqual({ tipo: 'matriz' });
    expect(interpretar('#!/mudancas')).toEqual({ tipo: 'mudancas' });
    expect(interpretar('')).toEqual({ tipo: 'inicio' });
    expect(interpretar('#c-3')).toBeUndefined();
  });
  it('acentos: %XX e forma NFD viram NFC', () => {
    const nfd = '01_Portal_Público'.normalize('NFD');
    expect(interpretar(`#!/feature/${nfd}`)).toMatchObject({ endereco: '01_Portal_Público' });
    expect(interpretar('#!/feature/01_Portal_P%C3%BAblico')).toMatchObject({ endereco: '01_Portal_Público' });
    expect(lerRotaAntiga('#/scenario/01_Portal_P%C3%BAblico/2')).toEqual({ endereco: '01_Portal_Público', posicao: 2 });
  });
  it('resolve com e sem caixa; sugere o mais parecido', () => {
    const mapa = { '01_Portal_02_Lista': { arquivo: 'a.html', filhos: [0, 1] } };
    expect(resolver('01_portal_02_lista', mapa)).toBe('01_Portal_02_Lista');
    expect(resolver('xx', mapa)).toBeUndefined();
    expect(sugerir('01_Portal_02_Listagem', mapa)).toBe('01_Portal_02_Lista');
  });
});

describe('busca', () => {
  it('atalho de código (CT-U07)', () => {
    expect(codigoDaConsulta('RNG-06')).toBe('RNG-06');
    expect(codigoDaConsulta('rng 6')).toBe('RNG-06');
    expect(codigoDaConsulta('lov6')).toBe('LOV-06');
    expect(codigoDaConsulta('E-mail-1')).toBe('EMAIL-01');
    expect(codigoDaConsulta('RNG')).toBeUndefined();
    expect(codigoDaConsulta('regra 6')).toBeUndefined();
  });
  it('trecho e destaque ignorando acento', () => {
    expect(marcar('Lista de Beneficiárias', ['beneficiarias'])).toBe('Lista de <mark>Beneficiárias</mark>');
    expect(trecho('a '.repeat(80) + 'CNPJ inválido', 'cnpj')).toMatch(/^… .*<mark>CNPJ<\/mark> inválido$/);
  });
});

describe('nomes e rótulos (CT-U08)', () => {
  it('arquivo ASCII estável e distinto', () => {
    const a = arquivoDaPagina('01_Portal_Público_02_Portal_Lista');
    expect(a).toMatch(/^[a-z0-9-]+\.html$/);
    expect(arquivoDaPagina('01_Portal_Público_02_Portal_Lista'.normalize('NFD'))).toBe(a);
    expect(arquivoDaPagina('01_Portal_Publico_02_Portal_Lista')).not.toBe(a);
  });
  it('estados', () => {
    expect(rotuloEstado('padrao')).toBe('Padrão');
    expect(rotuloEstado('erro-3')).toBe('Erro (cenário 3)');
    expect(rotuloEstado('sem-permissao-2')).toBe('Sem permissão (cenário 2)');
  });
});

describe('comparação (CT-U04, CT-U05, CT-I14)', () => {
  const v1 = ler('Funcionalidade: F\n  Contexto: C\n    Dado x\n  Cenário: Um\n    Quando a pessoa clica\n      | Campo | Exemplo |\n      | Nome  | Ana     |\n  Cenário: Dois\n    Quando b\n  Cenário: Repetido\n    Quando r1\n  Cenário: Repetido\n    Quando r2\n');
  it('pareia pelo título, mesmo com cenário inserido no meio; repetidos pela ordem', () => {
    const v2 = ler('Funcionalidade: F\n  Contexto: C\n    Dado x\n  Cenário: Novo\n    Quando n\n  Cenário: Um\n    Quando a pessoa clica\n      | Campo   | Exemplo |\n      | Nome    | Ana     |\n  Cenário: Repetido\n    Quando r1\n  Cenário: Repetido\n    Quando r2 mudou\n');
    const r = compararVersoes([v2], [v1], 'v1');
    const m = r.paginas.get('Pasta_Arq')!;
    expect(m.situacao).toBe('alterada');
    expect([...m.filhos].map(([pos, f]) => [pos, f.situacao])).toEqual([[0, 'igual'], [1, 'nova'], [2, 'igual'], [3, 'igual'], [4, 'alterada']]);
    expect(m.removidos.map((x) => x.titulo)).toEqual(['Dois']);
  });
  it('realinhar a tabela não é mudança; espaços no fim e BOM também não', () => {
    const v2 = ler(v1.fonte.replace('| Campo | Exemplo |', '|   Campo   |   Exemplo   |').replace('Quando b', 'Quando b   '));
    expect(compararVersoes([v2], [v1], 'v1').paginas.get('Pasta_Arq')!.situacao).toBe('igual');
    expect(compararVersoes([ler(BOM + v1.fonte)], [v1], 'v1').paginas.get('Pasta_Arq')!.situacao).toBe('igual');
  });
  it('diff por palavra marca só o que mudou', () => {
    expect(diffHtml('Quando a pessoa clica em Salvar', 'Quando a pessoa clica em Enviar')).toBe('Quando a pessoa clica em <del><span class="sr">excluído: </span>Salvar</del><ins><span class="sr">incluído: </span>Enviar</ins>');
    expect(diffHtml('a < b', 'a < b')).toBe('a &lt; b');
  });
  it('nova, removida e renomeação', () => {
    const outra = ler(v1.fonte, 'Outro');
    const r = compararVersoes([outra], [v1], 'v1');
    expect(r.paginas.get('Pasta_Outro')!.situacao).toBe('nova');
    expect(r.removidas.map((x) => x.endereco)).toEqual(['Pasta_Arq']);
    expect(r.renomeadas).toEqual([{ de: 'Pasta_Arq', para: 'Pasta_Outro' }]);
  });
  it('texto canônico do filho', () => {
    expect(textoDoFilho(v1.filhos[1]!)).toBe('Cenário: Um\nQuando a pessoa clica\n| Campo | Exemplo |\n| Nome | Ana |');
  });
});
