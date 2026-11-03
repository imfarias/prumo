import { describe, expect, it } from 'vitest';
import { cnpj, cnpjDe12, cpf, validarCnpj, validarCpf } from '../../src/dados/documentos.js';
import { aplicarMascara, confereMascara } from '../../src/dados/mascara.js';
import { criarGerador, valorFicticio } from '../../src/dados/ficticios.js';

describe('CPF', () => {
  it('gera CPF válido e formatado (CT-U05)', () => {
    const v = cpf(123456789);
    expect(v).toBe('123.456.789-09');
    expect(validarCpf(v)).toBe(true);
  });
  it('recusa DV errado e sequência repetida', () => {
    expect(validarCpf('123.456.789-00')).toBe(false);
    expect(validarCpf('111.111.111-11')).toBe(false);
  });
});

describe('CNPJ (CT-U06)', () => {
  it('numérico com DVs corretos', () => {
    expect(cnpj(11222333)).toBe('11.222.333/0001-81');
    expect(validarCnpj('11.222.333/0001-81')).toBe(true);
    expect(validarCnpj('11.222.333/0001-82')).toBe(false);
  });
  it('alfanumérico pelo exemplo publicado da RFB (12.ABC.345/01DE-35)', () => {
    expect(cnpjDe12('12ABC34501DE')).toBe('12.ABC.345/01DE-35');
    expect(validarCnpj('12.ABC.345/01DE-35')).toBe(true);
    expect(validarCnpj('12.ABC.345/01DE-36')).toBe(false);
  });
});

describe('máscaras (CT-U07)', () => {
  it('confere dígito, letra e alfanumérico', () => {
    expect(confereMascara('##.###.###/####-##', '00.394.445/0001-01')).toBe(true);
    expect(confereMascara('##.###.###/####-##', '00394445000101')).toBe(false);
    expect(confereMascara('XX.XXX.XXX/XXXX-##', '12.ABC.345/01DE-35')).toBe(true);
  });
  it('aceita lista de máscaras (Fone 8 ou 9 dígitos)', () => {
    const fone = ['(##) ####-####', '(##) #####-####'];
    expect(confereMascara(fone, '(61) 3322-4400')).toBe(true);
    expect(confereMascara(fone, '(61) 98888-7777')).toBe(true);
    expect(confereMascara(fone, '61 98888-7777')).toBe(false);
    expect(aplicarMascara(fone, '61988887777')).toBe('(61) 98888-7777');
  });
});

describe('dados fictícios', () => {
  const opcoes = { cnpj: 'alfanumerico' as const, sufixo: 'Exemplo', mascaras: { Fone: ['(##) ####-####'] } };
  it('é determinístico pela semente', () => {
    const a = criarGerador('tela-campo', opcoes);
    const b = criarGerador('tela-campo', opcoes);
    expect([a.cnpj(), a.cpf(), a.pessoa()]).toEqual([b.cnpj(), b.cpf(), b.pessoa()]);
  });
  it('gera documentos válidos e nomes com o sufixo (CA-11)', () => {
    const g = criarGerador('x', opcoes);
    for (let i = 0; i < 50; i++) {
      expect(validarCnpj(g.cnpj())).toBe(true);
      expect(validarCpf(g.cpf())).toBe(true);
      expect(g.pessoa().endsWith('Exemplo')).toBe(true);
      expect(g.email()).toMatch(/@exemplo\.com\.br$/);
    }
  });
  it('escolhe o gerador pelo nome do campo', () => {
    const g = criarGerador('y', opcoes);
    expect(validarCnpj(valorFicticio('CNPJ da Empresa', g))).toBe(true);
    expect(valorFicticio('E-mail', g)).toMatch(/@exemplo/);
    expect(valorFicticio('Fone', g)).toMatch(/^\(61\) 3\d{3}-\d{4}$/);
  });
});
