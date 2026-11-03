import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LineCounter, isNode, parseDocument } from 'yaml';
import { ErroPrumo } from '../util/erros.js';
import { relativoPosix } from '../util/caminhos.js';
import { configPadrao, validarConfig, type Achado, type ConfigProjeto } from './esquema.js';
import { lerProperties, propertiesParaProjeto } from './properties.js';

export type FonteConfig = 'projeto.yml' | 'config.properties' | 'padrao';

export interface ProjetoCarregado {
  config: ConfigProjeto;
  achados: Achado[];
  fonte: FonteConfig;
  caminho?: string;
}

/** Lê YAML devolvendo o objeto e uma função que acha a linha de uma chave. */
export function lerYaml(texto: string, arquivo: string) {
  const contador = new LineCounter();
  const doc = parseDocument(texto.replace(/^﻿/, ''), { lineCounter: contador, prettyErrors: false });
  if (doc.errors.length) {
    const e = doc.errors[0]!;
    const linha = e.linePos?.[0]?.line ?? 0;
    throw new ErroPrumo('CLI-03', `${arquivo} inválido na linha ${linha}: ${e.message.split('\n')[0]}`);
  }
  const linhaDe = (caminho: string[]) => {
    const no = caminho.length ? doc.getIn(caminho, true) : doc.contents;
    if (isNode(no) && no.range) return contador.linePos(no.range[0]).line;
    return undefined;
  };
  return { dados: doc.toJS() as unknown, linhaDe };
}

/** projeto.yml tem prioridade; sem ele, config.properties; sem nenhum, padrões com aviso. */
export async function carregarProjeto(specs: string, opcoes: { projeto?: string } = {}): Promise<ProjetoCarregado> {
  const yml = opcoes.projeto ? path.resolve(opcoes.projeto) : path.join(specs, 'projeto.yml');
  if (existsSync(yml)) {
    const rel = relativoPosix(specs, yml);
    const { dados, linhaDe } = lerYaml(await readFile(yml, 'utf8'), rel);
    const r = validarConfig(dados, rel, linhaDe);
    return { config: r.config, achados: r.achados, fonte: 'projeto.yml', caminho: yml };
  }
  if (opcoes.projeto) throw new ErroPrumo('CLI-03', `Arquivo de projeto não encontrado: ${yml}.`);

  const prop = path.join(specs, 'config.properties');
  if (existsSync(prop)) {
    const r = validarConfig(propertiesParaProjeto(lerProperties(await readFile(prop, 'utf8'))), 'config.properties');
    r.achados.push({
      severidade: 'info',
      codigo: 'config/properties',
      arquivo: 'config.properties',
      mensagem: 'Usando config.properties. Rode `prumo migrar-config` para criar o projeto.yml e liberar as demais opções.',
    });
    return { config: r.config, achados: r.achados, fonte: 'config.properties', caminho: prop };
  }

  return {
    config: configPadrao(),
    achados: [
      { severidade: 'aviso', codigo: 'config/ausente', arquivo: '.', mensagem: 'Sem projeto.yml nem config.properties; usando a identidade padrão.' },
    ],
    fonte: 'padrao',
  };
}
