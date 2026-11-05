import { describe, expect, it } from 'vitest';
import { tabelaDeConteudo } from '../../src/modelo/montar.js';
import type { Filho, Tabela } from '../../src/parser/tipos.js';

const tabela = (...cabecalho: string[]) => ({ cabecalho, linhas: [] }) as unknown as Tabela;
const filho = (...tags: string[]) => ({ tags }) as unknown as Filho;

describe('tabelas de cenário no protótipo', () => {
  it('conteúdo da tela continua como bloco de dados', () => {
    expect(tabelaDeConteudo(tabela('Bloco', 'Conteúdo'), filho())).toBe(true);
    expect(tabelaDeConteudo(tabela('Aba', 'Perfis'), filho('@fluxo-principal'))).toBe(true);
  });
  it('regra não vira bloco: @validacao, coluna Mensagem e lista só de campos', () => {
    expect(tabelaDeConteudo(tabela('Situação', 'Valor'), filho('@validacao'))).toBe(false);
    expect(tabelaDeConteudo(tabela('Situação', 'Mensagem'), filho())).toBe(false);
    expect(tabelaDeConteudo(tabela('Situação', 'Mensagens'), filho())).toBe(false);
    expect(tabelaDeConteudo(tabela('Campos'), filho())).toBe(false);
    expect(tabelaDeConteudo(tabela('Campo'), filho())).toBe(false);
  });
});
