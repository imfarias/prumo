import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { CANAIS, validar } from '../../src/comum/canais.js';
import { rodar } from '../../src/principal/editor.js';
import { definirMenuContexto, menuContextoExiste } from '../../src/principal/menu-contexto.js';

const EDITOR_FALSO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fabricas/editor-falso.mjs');

describe('rodar o editor', () => {
  it('executável existente roda com os argumentos; inexistente devolve false', async () => {
    const saida = path.join(await mkdtemp(path.join(tmpdir(), 'prumo-editor-')), 'args.txt');
    process.env.PRUMO_EDITOR_SAIDA = saida;
    try {
      expect(await rodar({ executavel: process.execPath, argumentos: [EDITOR_FALSO, '/a/b.feature', '7'], shell: false })).toBe(true);
      await vi.waitFor(() => expect(existsSync(saida)).toBe(true), { timeout: 5000 });
      expect(readFileSync(saida, 'utf8')).toBe('/a/b.feature:7\n');
    } finally {
      delete process.env.PRUMO_EDITOR_SAIDA;
    }
    expect(await rodar({ executavel: path.join(tmpdir(), 'nao-existe-editor-prumo'), argumentos: [], shell: false })).toBe(false);
  });
});

describe.runIf(process.platform === 'win32')('menu de contexto no registro (Windows)', () => {
  const B = String.fromCharCode(92);
  const CHAVE = ['HKCU', 'Software', 'Classes', 'Directory', 'shell', 'PrumoTeste'].join(B);
  const EXE = ['C:', 'Prumo', 'Prumo.exe'].join(B);
  it('liga, confere e desliga a chave de teste', async () => {
    await definirMenuContexto(EXE, true, CHAVE);
    expect(await menuContextoExiste(CHAVE)).toBe(true);
    await definirMenuContexto(EXE, false, CHAVE);
    expect(await menuContextoExiste(CHAVE)).toBe(false);
    await definirMenuContexto(EXE, false, CHAVE); // remover de novo não é erro
  });
});

describe('todos os canais validam a forma (CT-M01)', () => {
  const VALIDOS: Record<string, unknown> = {
    'projeto:abrir': { caminho: 'a' },
    'projeto:criar': { pasta: 'a', nome: 'N', versao: '1', orgao: 'O' },
    'projeto:esquecer': { caminho: 'a' },
    'config:ler': { arquivo: 'telas.overrides.yml' },
    'config:previa': { arquivo: 'projeto.yml', mudancas: [{ caminho: ['projeto', 'versao'], valor: '2' }, { caminho: ['a', 0], remover: true }] },
    'config:salvar': { arquivo: 'projeto.yml', mudancas: [], base: 'x' },
    'tarefa:iniciar': { tipo: 'capturar', parametros: { modulos: ['01'], telas: ['t'], saida: 's', arquivoUnico: true, forcar: true, comparar: 'main' } },
    'tarefa:cancelar': { id: 'x' },
    'verificacao:abrirNoEditor': { arquivo: 'a.feature', linha: 3 },
    'docs:abrirNoNavegador': { alvo: 'docs' },
    'sistema:abrirPasta': { alvo: 'registro' },
    'sistema:abrirArquivo': { alvo: 'pdf' },
    'sistema:escolherPasta': undefined,
    'sistema:escolherArquivo': { extensoes: ['png'] },
    'sistema:salvarComo': { nome: 'a.pdf' },
    'sistema:abrirLink': { url: 'https://github.com/imfarias/prumo' },
    'prefs:salvar': { previaAoVivo: false, tema: 'claro', editor: 'sistema', atualizacaoLigada: true, menuContexto: false },
  };
  it('a forma válida passa e um objeto vazio ou texto é recusado em quem recebe dados', () => {
    for (const canal of Object.keys(CANAIS)) {
      if (canal in VALIDOS) {
        expect(() => validar(canal as never, VALIDOS[canal])).not.toThrow();
        if (!['sistema:escolherPasta', 'sistema:escolherArquivo', 'prefs:salvar', 'tarefa:iniciar'].includes(canal)) expect(() => validar(canal as never, {}), canal).toThrow();
        expect(() => validar(canal as never, 'texto'), canal).toThrow();
      } else {
        expect(validar(canal as never, undefined)).toBeUndefined();
        expect(() => validar(canal as never, { a: 1 }), canal).toThrow();
      }
    }
  });
  it('recusas específicas', () => {
    expect(() => validar('verificacao:abrirNoEditor', { arquivo: 'a', linha: -1 })).toThrow(/linha/);
    expect(() => validar('tarefa:iniciar', { tipo: 'pdf', parametros: { modulos: [1] } })).toThrow(/modulos/);
    expect(() => validar('tarefa:iniciar', { tipo: 'pdf', parametros: { orientacao: 'deitado' } })).toThrow(/orientacao/);
    expect(() => validar('config:previa', { arquivo: 'projeto.yml', mudancas: 'x' })).toThrow(/mudancas/);
    expect(() => validar('projeto:criar', { pasta: 'a', nome: 'n'.repeat(81), versao: '1' })).toThrow(/nome/);
    expect(() => validar('prefs:salvar', { tema: 'roxo' })).toThrow(/tema/);
  });
});
