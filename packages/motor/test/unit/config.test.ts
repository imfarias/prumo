import { describe, expect, it } from 'vitest';
import { lerProperties, propertiesParaProjeto } from '../../src/config/properties.js';
import { validarConfig } from '../../src/config/esquema.js';
import { lerYaml } from '../../src/config/projeto.js';
import { contraste, misturar } from '../../src/render/contraste.js';
import { ErroPrumo } from '../../src/util/erros.js';
import { dentroDe } from '../../src/util/caminhos.js';
import { mesmoTexto, slug, textoPuro, tituloDeArquivo } from '../../src/util/texto.js';

describe('config.properties (CT-U09)', () => {
  it('lê escapes, comentários e continuação', () => {
    const p = lerProperties('\uFEFF# comentário\n! outro\nmenuColor=\\#0E1A33\nchave\\:com\\:dois = valor\nlonga = a\\\n   b\nvazia=\nuni=\\u00e9\n');
    expect(p).toEqual({ menuColor: '#0E1A33', 'chave:com:dois': 'valor', longa: 'ab', vazia: '', uni: 'é' });
  });
  it('mapeia as chaves do Pirilampo (RN-08)', () => {
    const r = propertiesParaProjeto({
      projectName: 'P', projectVersion: '2.0', projectLogo: 'l.png', menuColor: '#000000', menuTextColor: '#FFFFFF',
      layoutPdf: 'LANDSCAPE', compilationType: 'FOLDER', htmlPanelToggle: 'OPENED', embedImages: 'true', compilationArtifact: 'HTML',
    });
    expect(r).toEqual({
      projeto: { nome: 'P', versao: '2.0', logo: 'l.png' },
      identidade: { cores: { menu: '#000000', menu_texto: '#FFFFFF' } },
      documentacao: { pdf: 'paisagem', arquivo_unico: false, prototipo_aberto: true, embutir_imagens: true, artefato: 'HTML' },
    });
  });
});

describe('projeto.yml', () => {
  it('aplica padrões e valida tipos com a linha do problema', () => {
    const { dados, linhaDe } = lerYaml('projeto:\n  nome: X\n  versao: 1\nidentidade:\n  cores:\n    primaria: azul\nlargura_captura: 10\ndesconhecida: 1\n', 'projeto.yml');
    const { config, achados } = validarConfig(dados, 'projeto.yml', linhaDe);
    expect(config.projeto).toMatchObject({ nome: 'X', versao: '1' });
    expect(config.largura_captura).toBe(1440);
    expect(config.mascaras.CNPJ).toBe('##.###.###/####-##');
    expect(achados.map((a) => [a.linha, a.mensagem.slice(0, 20)])).toEqual([
      [8, 'Chave desconhecida "'],
      [6, 'A cor "primaria" pre'],
      [7, 'largura_captura deve'],
    ]);
  });
  it('exige projeto.nome e versao', () => {
    const { achados } = validarConfig({ projeto: {} }, 'p.yml');
    expect(achados.filter((a) => a.severidade === 'erro')).toHaveLength(2);
  });
  it('YAML inválido vira erro de uso com a linha (CLI-03)', () => {
    expect(() => lerYaml('projeto:\n  nome: [x\n', 'projeto.yml')).toThrow(ErroPrumo);
    expect(() => lerYaml('projeto:\n  nome: [x\n', 'projeto.yml')).toThrow(/linha/);
  });
});

describe('contraste (CT-U08)', () => {
  it('valores conhecidos', () => {
    expect(contraste('#000000', '#FFFFFF')).toBe(21);
    expect(contraste('#1D3F8F', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contraste('#FFCD07', '#FFFFFF')).toBeLessThan(4.5);
  });
  it('mistura', () => {
    expect(misturar('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('utilitários', () => {
  it('textos', () => {
    expect(slug('Confirme o E-mail')).toBe('confirme-o-e-mail');
    expect(tituloDeArquivo('03_Portal_Lista_Beneficiárias')).toBe('Portal Lista Beneficiárias');
    expect(mesmoTexto('Situação ', 'situacao')).toBe(true);
    expect(textoPuro('**a** [RNG](#/x) <br> `b`')).toBe('a RNG b');
  });
  it('não escreve fora da pasta escolhida', () => {
    expect(() => dentroDe('/a/b', '/a/b/../c')).toThrow(ErroPrumo);
    expect(dentroDe('/a/b', '/a/b/c/d')).toMatch(/c[\\/]d$/);
  });
});
