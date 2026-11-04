import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CANAIS, ehCanal, ehEvento, ErroCanal, validar } from '../../src/comum/canais.js';
import { Atualizador, compararVersoes, formatoInstalado } from '../../src/principal/atualizacao.js';
import { comandoDoEditor } from '../../src/principal/editor.js';
import { comandosMenu } from '../../src/principal/menu-contexto.js';
import { ArmazemPreferencias, PREFERENCIAS_PADRAO } from '../../src/principal/preferencias.js';
import { servirRelease, type ReleaseFalsa } from '../fabricas/release.js';

const temp = () => mkdtemp(path.join(tmpdir(), 'prumo-principal-'));

describe('canais (CT-M01)', () => {
  it('aceita a forma certa e recusa forma errada', () => {
    expect(validar('projeto:abrir', { caminho: 'C:/x' })).toEqual({ caminho: 'C:/x' });
    expect(() => validar('projeto:abrir', { caminho: 3 })).toThrow(ErroCanal);
    expect(() => validar('projeto:abrir', 'C:/x')).toThrow(ErroCanal);
    expect(() => validar('projeto:atual', { a: 1 })).toThrow(/não recebe dados/);
    expect(() => validar('config:ler', { arquivo: '../segredo.yml' })).toThrow(/arquivo inválido/);
    expect(() => validar('sistema:abrirLink', { url: 'file:///etc/passwd' })).toThrow(/https/);
    expect(() => validar('tarefa:iniciar', { tipo: 'apagar-tudo' })).toThrow(/tipo inválido/);
    expect(() => validar('config:salvar', { arquivo: 'projeto.yml', mudancas: [{ caminho: [] }], base: '' })).toThrow(/caminho inválido/);
  });

  it('normaliza parâmetros de tarefa e preferências, descartando o que não conhece', () => {
    const t = validar('tarefa:iniciar', { tipo: 'pdf', parametros: { orientacao: 'paisagem', soMudancas: 'sim', extra: 1 } });
    expect(t.parametros.orientacao).toBe('paisagem');
    expect(t.parametros.soMudancas).toBeUndefined();
    expect('extra' in t.parametros).toBe(false);
    expect(validar('prefs:salvar', { tema: 'escuro', qualquer: 1 })).toEqual({ tema: 'escuro' });
    expect(validar('prefs:salvar', { editor: { executavel: 'subl' } })).toEqual({ editor: { executavel: 'subl', argumentos: ['{arquivo}'] } });
  });

  it('canal e evento desconhecidos são recusados', () => {
    expect(() => validar('x' as never, {})).toThrow(/canal desconhecido/);
    expect(ehCanal('x')).toBe(false);
    expect(ehCanal('toString')).toBe(false);
    expect(ehCanal('prefs:ler')).toBe(true);
    expect(ehEvento('tarefa:fim')).toBe(true);
    expect(ehEvento('qualquer')).toBe(false);
    expect(Object.keys(CANAIS).every((c) => /^[a-z]+:[a-zA-Z]+$/.test(c))).toBe(true);
  });
});

describe('preferências (CT-M02)', () => {
  it('ausentes ou corrompidas → padrões', async () => {
    const d = await temp();
    expect(new ArmazemPreferencias(path.join(d, 'nao-existe.json')).get()).toEqual(PREFERENCIAS_PADRAO);
    await writeFile(path.join(d, 'ruim.json'), '{ isto não é json');
    expect(new ArmazemPreferencias(path.join(d, 'ruim.json')).get()).toEqual(PREFERENCIAS_PADRAO);
  });

  it('recentes limitados a 10, sem duplicata, mais novo primeiro; gravação sem .tmp restante', async () => {
    const d = await temp();
    const arq = path.join(d, 'sub', 'preferencias.json');
    const a = new ArmazemPreferencias(arq);
    for (let i = 0; i < 12; i++) await a.lembrar({ caminho: path.join(d, `p${i}`), nome: `P${i}`, versao: '1' }, new Date(2026, 0, 1, 0, i));
    await a.lembrar({ caminho: path.join(d, 'p5'), nome: 'P5', versao: '2' });
    const r = a.get().recentes;
    expect(r).toHaveLength(10);
    expect(r[0]!.nome).toBe('P5');
    expect(r.filter((x) => x.nome === 'P5')).toHaveLength(1);
    await a.esquecer(path.join(d, 'p5'));
    expect(a.get().recentes.some((x) => x.nome === 'P5')).toBe(false);
    expect(await readdir(path.dirname(arq))).toEqual(['preferencias.json']);
    expect(new ArmazemPreferencias(arq).get().recentes).toHaveLength(9);
  });

  it('valores parciais herdam os padrões', async () => {
    const d = await temp();
    await writeFile(path.join(d, 'p.json'), JSON.stringify({ tema: 'escuro', atualizacao: { ligada: false }, recentes: [{ x: 1 }, { caminho: 'C:/a', nome: 'A' }] }));
    const p = new ArmazemPreferencias(path.join(d, 'p.json')).get();
    expect(p.tema).toBe('escuro');
    expect(p.editor).toBe('vscode');
    expect(p.atualizacao.ligada).toBe(false);
    expect(p.recentes).toHaveLength(1);
  });
});

describe('atualização (CT-M03)', () => {
  let rel: ReleaseFalsa | undefined;
  afterEach(async () => {
    await rel?.fechar();
    rel = undefined;
  });

  it('compara versões e reconhece o formato instalado', () => {
    expect(compararVersoes('v0.2.0', '0.1.9')).toBeGreaterThan(0);
    expect(compararVersoes('0.1.0', 'v0.1.0')).toBe(0);
    expect(compararVersoes('1.0.0-beta', '1.0.1')).toBeLessThan(0);
    expect(formatoInstalado('C:\\Users\\a\\AppData\\Local\\Programs\\Prumo\\Prumo.exe', 'win32')).toBe('nsis');
    expect(formatoInstalado('C:\\Program Files\\Prumo\\Prumo.exe', 'win32')).toBe('msi');
    expect(formatoInstalado('/opt/Prumo/prumo', 'linux', {})).toBe('deb');
    expect(formatoInstalado('/tmp/.mount_x/prumo', 'linux', { APPIMAGE: '/home/a/Prumo.AppImage' })).toBe('appimage');
    expect(formatoInstalado('D:\\dev\\electron.exe', 'win32')).toBe('desconhecido');
  });

  it('versão maior → disponível, com o arquivo do formato em uso; baixa e confere o SHA-256', async () => {
    rel = await servirRelease({ versao: '0.2.0' });
    const pasta = await temp();
    const a = new Atualizador({ versaoAtual: '0.1.0', url: rel.url, formato: 'msi', pasta });
    const info = await a.verificar();
    expect(info).toMatchObject({ versao: '0.2.0', arquivo: { nome: 'Prumo-0.2.0.msi', tamanho: rel.conteudo.length } });
    const andamentos: number[] = [];
    const arq = await a.baixar((feito) => andamentos.push(feito));
    expect(path.basename(arq)).toBe('Prumo-0.2.0.msi');
    expect((await readFile(arq)).equals(rel.conteudo)).toBe(true);
    expect(andamentos.at(-1)).toBe(rel.conteudo.length);
    expect(a.arquivoBaixado).toBe(arq);
  });

  it('igual, menor ou prévia → nada', async () => {
    for (const o of [{ versao: '0.1.0' }, { versao: '0.0.9' }, { versao: '0.9.0', prerelease: true }]) {
      rel = await servirRelease(o);
      expect(await new Atualizador({ versaoAtual: '0.1.0', url: rel.url, formato: 'nsis', pasta: await temp() }).verificar()).toBeUndefined();
      await rel.fechar();
      rel = undefined;
    }
  });

  it('SHA-256 errado → recusa e apaga; sem SHA256SUMS → não baixa', async () => {
    rel = await servirRelease({ versao: '0.2.0', shaErrado: true });
    const pasta = await temp();
    const a = new Atualizador({ versaoAtual: '0.1.0', url: rel.url, formato: 'deb', pasta });
    await a.verificar();
    await expect(a.baixar()).rejects.toThrow(/não confere/);
    expect(await readdir(pasta)).toEqual([]);
    await rel.fechar();
    rel = await servirRelease({ versao: '0.2.0', semSomas: true });
    const b = new Atualizador({ versaoAtual: '0.1.0', url: rel.url, formato: 'deb', pasta });
    await b.verificar();
    await expect(b.baixar()).rejects.toThrow(/SHA256SUMS/);
    expect(rel.pedidos.some((p) => p.startsWith('/baixar/prumo_'))).toBe(false);
  });

  it('formato desconhecido avisa sem arquivo; erro HTTP e sem rede lançam; só https ou 127.0.0.1', async () => {
    rel = await servirRelease({ versao: '0.2.0' });
    const a = new Atualizador({ versaoAtual: '0.1.0', url: rel.url, formato: 'desconhecido', pasta: await temp() });
    expect((await a.verificar())?.arquivo).toBeUndefined();
    await expect(a.baixar()).rejects.toThrow(/página da release/);
    await rel.fechar();
    rel = await servirRelease({ versao: '0.2.0', status: 503 });
    await expect(new Atualizador({ versaoAtual: '0.1.0', url: rel.url, formato: 'nsis', pasta: await temp() }).verificar()).rejects.toThrow(/HTTP 503/);
    await expect(new Atualizador({ versaoAtual: '0.1.0', url: 'http://127.0.0.1:9/nada', formato: 'nsis', pasta: await temp() }).verificar()).rejects.toThrow();
    await expect(new Atualizador({ versaoAtual: '0.1.0', url: 'http://exemplo.com/x', formato: 'nsis', pasta: await temp() }).verificar()).rejects.toThrow(/https/);
  });
});

describe('editor (CT-M04) e menu de contexto', () => {
  it('monta o comando de cada editor', () => {
    const antes = process.env.PRUMO_EDITOR_TESTE;
    delete process.env.PRUMO_EDITOR_TESTE;
    try {
      expect(comandoDoEditor('vscode', '/a/b.feature', 12, 'linux')).toEqual({ executavel: 'code', argumentos: ['--goto', '/a/b.feature:12'], shell: false });
      expect(comandoDoEditor('vscode', 'C:\\a b\\c.feature', undefined, 'win32')).toEqual({ executavel: 'code.cmd', argumentos: ['--goto', '"C:\\a b\\c.feature:1"'], shell: true });
      expect(comandoDoEditor({ executavel: 'subl', argumentos: ['{arquivo}:{linha}', '-n'] }, '/x.feature', 3)).toEqual({ executavel: 'subl', argumentos: ['/x.feature:3', '-n'], shell: false });
      expect(comandoDoEditor('sistema', '/x.feature', 3)).toBeUndefined();
      process.env.PRUMO_EDITOR_TESTE = '/t/editor.mjs';
      expect(comandoDoEditor('vscode', '/x.feature', 3)).toEqual({ executavel: process.execPath, argumentos: ['/t/editor.mjs', '/x.feature', '3'], shell: false });
    } finally {
      if (antes === undefined) delete process.env.PRUMO_EDITOR_TESTE;
      else process.env.PRUMO_EDITOR_TESTE = antes;
    }
  });

  it('menu de contexto: chave com rótulo, ícone e comando; desligar remove', () => {
    const c = comandosMenu('C:\\P\\Prumo.exe', true, 'HKCU\\T');
    expect(c).toEqual([
      ['add', 'HKCU\\T', '/ve', '/d', 'Abrir com o Prumo', '/f'],
      ['add', 'HKCU\\T', '/v', 'Icon', '/d', '"C:\\P\\Prumo.exe",0', '/f'],
      ['add', 'HKCU\\T\\command', '/ve', '/d', '"C:\\P\\Prumo.exe" "%1"', '/f'],
    ]);
    expect(comandosMenu('x', false, 'HKCU\\T')).toEqual([['delete', 'HKCU\\T', '/f']]);
  });
});
