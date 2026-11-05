import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { acharLogo, migrarConfig, nomeDaPasta } from '../../src/config/migrar.js';
import { lerYaml } from '../../src/config/projeto.js';
import { validarConfig } from '../../src/config/esquema.js';

async function specsEm(...pastas: string[]) {
  const raiz = await mkdtemp(path.join(tmpdir(), 'prumo-migrar-'));
  const specs = path.join(raiz, ...pastas);
  await mkdir(specs, { recursive: true });
  return { raiz, specs };
}

describe('projeto.yml sem config.properties', () => {
  it('nome pela pasta do projeto', () => {
    const s = path.sep;
    expect(nomeDaPasta(['', 'memora', 'snbp_documentacao', '3 - Requisitos', 'Especificações'].join(s))).toBe('SNBP');
    expect(nomeDaPasta(['', 'x', 'novo-vale-cultura-documentacao', '3 - Requisitos', 'Especificações'].join(s))).toBe('Novo Vale Cultura');
    expect(nomeDaPasta(['', 'x', 'sinof', 'Especificações'].join(s))).toBe('SINOF');
  });

  it('cria com a configuração padrão, o nome da pasta e o logo de cima; o resultado é válido', async () => {
    const { raiz, specs } = await specsEm('snbp_documentacao', '3 - Requisitos', 'Especificações');
    await writeFile(path.join(raiz, 'snbp_documentacao', '3 - Requisitos', 'logo-SNBP.png'), 'png');
    expect(acharLogo(specs)).toBe('../logo-SNBP.png');
    const r = await migrarConfig(specs);
    expect(r.origem).toBe('padrao');
    const texto = await readFile(r.caminho, 'utf8');
    expect(texto).toContain('configuração padrão');
    const { config, achados } = validarConfig(lerYaml(texto, r.caminho).dados, 'projeto.yml');
    expect(achados.filter((a) => a.severidade === 'erro')).toEqual([]);
    expect(config.projeto).toMatchObject({ nome: 'SNBP', versao: '1.0', logo: '../logo-SNBP.png' });
    await expect(migrarConfig(specs)).rejects.toMatchObject({ codigo: 'MIGRAR' });
  });

  it('com config.properties continua convertendo o do Pirilampo', async () => {
    const { specs } = await specsEm('sinof', 'Especificações');
    await writeFile(path.join(specs, 'config.properties'), 'projectName=SINOF\nprojectVersion=5.0\nmenuColor=\\#245D28\n');
    const r = await migrarConfig(specs);
    expect(r.origem).toBe('config.properties');
    const texto = await readFile(r.caminho, 'utf8');
    expect(texto).toContain('config.properties do Pirilampo');
    expect(texto).toContain('"SINOF"');
    expect(texto).toContain('#245D28');
  });
});
