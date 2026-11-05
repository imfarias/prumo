import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Achado } from './esquema.js';
import { lerYaml } from './projeto.js';

export interface OverrideCampo {
  componente?: string;
  largura?: string;
  rotulo?: string;
  ajuda?: string;
  opcoes?: string[];
  secao?: string;
}

export interface OverrideTela {
  layout?: string;
  perfil?: string;
  casca?: string;
  secoes?: { titulo: string; campos: string[] }[];
  ordem?: string[];
  campos?: Record<string, OverrideCampo>;
  acoes?: { rotulo: string; primaria?: boolean; destino?: string }[];
  /** Cor do selo por coluna e valor (RN-86): `selos: { Situação: { "Em análise": aviso } }`. */
  selos?: Record<string, Record<string, string>>;
}

export interface Overrides {
  arquivo: string;
  telas: Record<string, OverrideTela>;
  linhaDe: (caminho: string[]) => number | undefined;
}

export function overridesVazios(): Overrides {
  return { arquivo: 'telas.overrides.yml', telas: {}, linhaDe: () => undefined };
}

/** Lê telas.overrides.yml (opcional): chave = id da tela (nome da feature sem .feature). */
export async function carregarOverrides(specs: string): Promise<{ overrides: Overrides; achados: Achado[] }> {
  const arquivo = path.join(specs, 'telas.overrides.yml');
  if (!existsSync(arquivo)) return { overrides: overridesVazios(), achados: [] };
  const { dados, linhaDe } = lerYaml(await readFile(arquivo, 'utf8'), 'telas.overrides.yml');
  const achados: Achado[] = [];
  const telas: Record<string, OverrideTela> = {};
  if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
    for (const [id, v] of Object.entries(dados as Record<string, unknown>)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) telas[id] = v as OverrideTela;
      else
        achados.push({
          severidade: 'aviso',
          codigo: 'override/invalido',
          arquivo: 'telas.overrides.yml',
          linha: linhaDe([id]),
          mensagem: `O override de "${id}" precisa ser um mapa.`,
        });
    }
  }
  return { overrides: { arquivo: 'telas.overrides.yml', telas, linhaDe }, achados };
}
