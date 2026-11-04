import { describe, expect, it } from 'vitest';
import { editarYaml } from '../../src/config/editar.js';
import { ErroPrumo } from '../../src/util/erros.js';

const ORIGINAL = [
  '# Comentário do topo',
  'projeto:',
  '  nome: Programa Exemplo   # nome exibido',
  '  versao: "1.0"',
  'identidade:',
  '  cores: { fundo: "#FFFFFF", primaria: "#1D3F8F" }',
  '  fontes: {titulo: Jost, texto: Jost}',
  'perfis:',
  '  Gestor: [Início, Relatórios]',
  '',
].join('\n');

describe('editarYaml (CT-I01, CT-I02)', () => {
  it('muda só as linhas das chaves alteradas, mantendo comentários e estilos das outras', () => {
    const r = editarYaml(ORIGINAL, [{ caminho: ['projeto', 'versao'], valor: '2.0' }]);
    expect(r.texto).toBe(ORIGINAL.replace('versao: "1.0"', 'versao: "2.0"'));
    expect(r.diff.filter((d) => d.tipo !== 'igual')).toEqual([
      { tipo: 'removida', texto: '  versao: "1.0"' },
      { tipo: 'incluida', texto: '  versao: "2.0"' },
    ]);
    expect(r.mudou).toBe(true);
  });

  it('muda valor dentro de mapa na mesma linha', () => {
    const r = editarYaml(ORIGINAL, [{ caminho: ['identidade', 'cores', 'primaria'], valor: '#0B6E4F' }]);
    expect(r.texto.split('\n')[5]).toBe('  cores: { fundo: "#FFFFFF", primaria: "#0B6E4F" }');
    expect(r.texto.split('\n').filter((l, i) => l !== ORIGINAL.split('\n')[i])).toHaveLength(1);
  });

  it('cria chave nova (inclusive blocos intermediários) e remove chave', () => {
    const r = editarYaml(ORIGINAL, [{ caminho: ['documentacao', 'comparar_com'], valor: 'v1' }, { caminho: ['perfis'], remover: true }]);
    expect(r.texto).toContain('documentacao:\n  comparar_com: v1');
    expect(r.texto).not.toContain('Gestor');
    expect(r.texto).toContain('# Comentário do topo');
    expect(r.texto).toContain('  nome: Programa Exemplo   # nome exibido');
  });

  it('sem mudanças devolve o mesmo texto; CRLF e BOM preservados', () => {
    expect(editarYaml(ORIGINAL, []).mudou).toBe(false);
    const crlf = '﻿' + ORIGINAL.replace(/\n/g, '\r\n');
    const r = editarYaml(crlf, [{ caminho: ['projeto', 'versao'], valor: '3' }]);
    expect(r.texto).toContain('\r\n  versao: "3"\r\n');
  });

  it('YAML inválido e caminho por dentro de valor simples são erros', () => {
    expect(() => editarYaml('a: [x', [])).toThrow(ErroPrumo);
    expect(() => editarYaml(ORIGINAL, [{ caminho: ['projeto', 'nome', 'x'], valor: 1 }])).toThrow(/não é um bloco de chaves/);
  });
});
