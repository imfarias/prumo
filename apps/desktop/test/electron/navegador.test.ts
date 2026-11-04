import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { beforeAll, describe, expect, it } from 'vitest';
import { caminhoDoElectron } from '../fabricas/electron.js';

const exec = promisify(execFile);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EXEMPLO = path.resolve(AQUI, '../../../../exemplos/exemplo-ficticio');
const TOLERANCIA = Number(process.env.PRUMO_TOLERANCIA_VISUAL ?? 0.5);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let r: any;

describe('NavegadorElectron dentro do Electron (CT-N01 a CT-N05)', () => {
  beforeAll(async () => {
    const trabalho = await mkdtemp(path.join(tmpdir(), 'prumo-nav-electron-'));
    // O roteiro fica dentro do pacote para achar @prumo/motor e as dependências pelo node_modules do monorepo.
    const roteiro = path.join(AQUI, '../../dist-teste/roteiro.mjs');
    await build({
      entryPoints: [path.join(AQUI, 'roteiro.ts')],
      outfile: roteiro,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      packages: 'external',
      logLevel: 'warning',
    });
    const resultado = path.join(trabalho, 'resultado.json');
    try {
      await exec(caminhoDoElectron(), [roteiro, resultado, trabalho, EXEMPLO], { timeout: 170_000, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' } });
      r = JSON.parse(await readFile(resultado, 'utf8'));
    } finally {
      await rm(trabalho, { recursive: true, force: true }).catch(() => undefined);
    }
    if (!r.ok) throw new Error(r.erro);
  }, 180_000);

  it('CT-N01: 7 PNGs de 1440 px, iguais à referência dentro da tolerância, sem rede', () => {
    expect(r.capturas).toEqual(Array(7).fill('gravado'));
    expect(r.bloqueadosExemplo).toEqual([]);
    for (const [rel, d] of Object.entries(r.diferencas) as [string, { largura: number; altura: number[]; porcento: number }][]) {
      expect(d.largura, rel).toBe(1440);
      expect(d.altura[1], rel).toBe(d.altura[0]);
      expect(d.porcento, rel).toBeLessThanOrEqual(TOLERANCIA);
    }
  });

  it('CT-N02: página de 12.000 px capturada inteira, com o conteúdo do fim', () => {
    expect(r.alta.altura).toBe(12000);
    expect(r.alta.fim).toEqual([255, 0, 0]);
  });

  it('CT-N03: PDF com o sumário igual aos destinos nomeados', () => {
    expect(r.pdf.paginas).toBeGreaterThanOrEqual(5);
    expect(r.pdf.destinos).toHaveLength(3);
    expect(new Map(r.pdf.destinos)).toEqual(new Map(r.pdf.sumario));
  });

  it('CT-N04: axe aponta imagem sem texto alternativo e botão sem nome', () => {
    expect(r.axe).toEqual(expect.arrayContaining(['button-name', 'image-alt']));
  });

  it('CT-N05: pedido https:// é bloqueado e registrado', () => {
    expect(r.bloqueados).toEqual(['https://exemplo.invalid/rastreio.png']);
  });
});
