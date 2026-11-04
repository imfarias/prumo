import { describe, expect, it } from 'vitest';
import { configPadrao } from '../../src/config/esquema.js';
import { decidirComponente } from '../../src/inferencia/campos.js';
import { detectarAcoes } from '../../src/inferencia/acoes.js';
import { classificarMensagem } from '../../src/inferencia/estados.js';
import type { Indice, Referencia } from '../../src/parser/indice.js';
import type { RefCitada } from '../../src/modelo/tipos.js';

const config = configPadrao();
const origem = { arquivo: 'x.feature', linha: 1 };
const lov = (opcoes?: string[]) => ({ chave: 'LOV-02', opcoes } as unknown as Referencia);
const indice = (opcoes?: string[]): Indice => ({ porEndereco: new Map(), porFeature: new Map(), porCodigo: new Map([['LOV-02', [lov(opcoes)]]]), referencias: [] });
const regraLov: RefCitada = { codigo: 'LOV-02', rotulo: 'LOV-02', destino: 'R/7', origem };

function decidir(nome: string, o: { editavel?: boolean; regras?: RefCitada[]; regraTexto?: string; opcoes?: string[] } = {}) {
  return decidirComponente({ nome, editavel: o.editavel ?? true, regras: o.regras ?? [], regraTexto: o.regraTexto, origem }, indice(o.opcoes), config);
}

describe('regras de componente (CT-U10)', () => {
  it('RN-13: Editável = N vence tudo, mas guarda as opções da LOV', () => {
    expect(decidir('CNPJ', { editavel: false })?.componente).toBe('leitura');
    expect(decidir('Situação', { editavel: false, regras: [regraLov], opcoes: ['A', 'B'] })).toMatchObject({ componente: 'leitura', opcoes: ['A', 'B'] });
  });
  it('RN-14: LOV vira seleção com as opções; sem tabela, seleção sem opções', () => {
    expect(decidir('Perfil', { regras: [regraLov], opcoes: ['A', 'B'] })).toMatchObject({ componente: 'selecao', opcoes: ['A', 'B'] });
    const d = decidir('Perfil', { regras: [regraLov] });
    expect(d).toMatchObject({ componente: 'selecao' });
    expect(d?.opcoes).toBeUndefined();
    expect(d?.sinal.descricao).toContain('não tem tabela');
  });
  it('RN-19 vence RN-14 para documentos', () => {
    expect(decidir('Documentos', { regras: [regraLov], opcoes: ['Contrato'] })).toMatchObject({ componente: 'arquivos', opcoes: ['Contrato'] });
    expect(decidir('Anexos')?.componente).toBe('arquivos');
  });
  it('RN-15: máscara e tipo pelo nome, palavra inteira e sem acento', () => {
    expect(decidir('CNPJ da Empresa')).toMatchObject({ componente: 'mascara', mascara: '##.###.###/####-##' });
    expect(decidir('CPF')?.mascara).toBe('###.###.###-##');
    expect(decidir('CEP')?.componente).toBe('mascara');
    expect(decidir('Fax')?.componente).toBe('tel');
    expect(decidir('Telefone SAC')?.componente).toBe('tel');
    expect(decidir('E-mail institucional')?.componente).toBe('email');
    expect(decidir('Data de início')?.componente).toBe('data');
    expect(decidir('Início da comercialização')?.componente).toBe('data');
    expect(decidir('Valor total')?.componente).toBe('valor');
    expect(decidir('Senha')?.componente).toBe('senha');
    expect(decidir('Mensagem')?.componente).toBe('texto-longo');
    expect(decidir('Cepa')).toBeUndefined();
  });
  it('RN-16, RN-17, RN-18', () => {
    expect(decidir('Confirme o E-mail')?.componente).toBe('confirmacao');
    expect(decidir('Declaração de veracidade')?.componente).toBe('caixa');
    expect(decidir('Aceite', { regraTexto: 'Declaração de veracidade' })?.componente).toBe('caixa');
    expect(decidir('Código verificador')?.componente).toBe('captcha');
  });
  it('FA-07: nenhuma regra → undefined', () => {
    expect(decidir('Bairro')).toBeUndefined();
  });
});

describe('ações (CT-U11)', () => {
  it('só negrito depois de verbo de acionamento', () => {
    expect(detectarAcoes('Quando o visitante aciona a opção **Filtrar**')).toEqual(['Filtrar']);
    expect(detectarAcoes('o usuário clica em **Salvar** e seleciona a opção **Voltar**')).toEqual(['Salvar', 'Voltar']);
    expect(detectarAcoes('a situação **Aguardando análise** é exibida')).toEqual([]);
    expect(detectarAcoes('aciona o botão **Novo responsável**')).toEqual(['Novo responsável']);
  });
});

describe('mensagens (CT-U12)', () => {
  it('classifica pelo texto e aceita override do projeto', () => {
    expect(classificarMensagem('MSG-03', 'Operação realizada com sucesso!', config)).toBe('sucesso');
    expect(classificarMensagem('MSG-01', 'Login Inválido', config)).toBe('erro');
    expect(classificarMensagem('MSG-04', 'Nenhum registro encontrado.', config)).toBe('aviso');
    const c = { ...config, mensagens: { 'MSG-01': 'aviso' as const } };
    expect(classificarMensagem('MSG-01', 'Login Inválido', c)).toBe('aviso');
  });
});
