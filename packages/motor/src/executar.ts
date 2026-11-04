import { existsSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Achado, ConfigProjeto } from './config/esquema.js';
import { carregarOverrides } from './config/overrides.js';
import { carregarProjeto, type FonteConfig } from './config/projeto.js';
import { compararPng, type ItemComparacao } from './comparacao/png.js';
import { montarModelo } from './modelo/montar.js';
import { serializarModelo } from './modelo/serializar.js';
import type { ModeloTelas } from './modelo/tipos.js';
import { capturar, type ResultadoCaptura } from './navegador/capturar.js';
import type { Navegador } from './navegador/navegador.js';
import { NavegadorPlaywright } from './navegador/playwright.js';
import { montarIndice, type Indice } from './parser/indice.js';
import { lerFeatures } from './parser/ler.js';
import type { ArquivoFeature } from './parser/tipos.js';
import { dentroDoRecorte, gerarPrototipos, type PaginaGerada, type Recorte } from './render/gerar.js';
import { gravarSeMudou } from './render/recursos.js';
import { ErroPrumo } from './util/erros.js';
import { ordenar, verificar } from './verificacao/verificar.js';

export interface Preparado {
  specs: string;
  config: ConfigProjeto;
  fonte: FonteConfig;
  arquivoConfig: string;
  arquivos: ArquivoFeature[];
  indice: Indice;
  modelo: ModeloTelas;
  achados: Achado[];
}

/** Lê configuração, features e overrides e monta o modelo (passos 2–5 do fluxo principal). */
export async function preparar(specsBruto: string, o: { projeto?: string } = {}): Promise<Preparado> {
  const specs = path.resolve(specsBruto);
  if (!existsSync(specs) || !statSync(specs).isDirectory()) throw new ErroPrumo('CLI-01', `Pasta de especificações não encontrada: ${specs}.`);
  const projeto = await carregarProjeto(specs, o);
  const { arquivos, achados: sintaxe } = await lerFeatures(specs);
  if (!arquivos.length && !sintaxe.length) throw new ErroPrumo('CLI-02', `Nenhum arquivo .feature em ${specs}.`);
  const indice = montarIndice(arquivos, projeto.config);
  const { overrides, achados: aOv } = await carregarOverrides(specs);
  const { modelo, achados: aMod } = montarModelo({ arquivos, indice, config: projeto.config, overrides, specs });
  const arquivoConfig = projeto.caminho ? path.relative(specs, projeto.caminho).split(path.sep).join('/') : '.';
  return { specs, config: projeto.config, fonte: projeto.fonte, arquivoConfig, arquivos, indice, modelo, achados: [...projeto.achados, ...sintaxe, ...aOv, ...aMod] };
}

export function verificarPreparado(p: Preparado): Achado[] {
  return verificar({ arquivos: p.arquivos, indice: p.indice, modelo: p.modelo, config: p.config, achadosAnteriores: p.achados }, p.specs);
}

export interface ResultadoGeracao {
  preparado: Preparado;
  paginas: PaginaGerada[];
  achados: Achado[];
  saida: string;
  arquivoModelo: string;
}

/** `prumo gerar`: telas.json + HTML por tela e estado. */
export async function gerar(specs: string, o: { projeto?: string; saida?: string; recorte?: Recorte } = {}): Promise<ResultadoGeracao> {
  const p = await preparar(specs, o);
  const saida = path.resolve(o.saida ?? path.join(process.cwd(), 'saida', 'prototipos'));
  const r = await gerarPrototipos(p.modelo, p.config, { specs: p.specs, saida, recorte: o.recorte, arquivoConfig: p.arquivoConfig });
  const arquivoModelo = path.join(path.dirname(saida), 'modelo', 'telas.json');
  await gravarSeMudou(arquivoModelo, serializarModelo(p.modelo));
  const achados = ordenar([...verificarPreparado(p), ...r.achados]);
  return { preparado: p, paginas: r.paginas, achados, saida, arquivoModelo };
}

/** `prumo capturar`: gera e grava os PNGs no caminho que o @prototipo referencia. */
export async function gerarECapturar(
  specs: string,
  o: { projeto?: string; saida?: string; recorte?: Recorte; largura?: number; forcar?: boolean; navegador?: Navegador; aoGravar?: (r: ResultadoCaptura) => void } = {},
) {
  const g = await gerar(specs, o);
  const nav = o.navegador ?? new NavegadorPlaywright();
  await nav.abrir();
  try {
    const capturas = await capturar(g.paginas, nav, { specs: g.preparado.specs, largura: o.largura ?? g.preparado.config.largura_captura, forcar: o.forcar, aoGravar: o.aoGravar });
    return { ...g, capturas, bloqueados: nav.bloqueados() };
  } finally {
    await nav.fechar();
  }
}

/** `prumo comparar-png`: captura numa pasta temporária e compara com os PNGs atuais das especificações. */
export async function compararComAtuais(specs: string, o: { projeto?: string; saida?: string; recorte?: Recorte; navegador?: Navegador } = {}): Promise<{ itens: ItemComparacao[]; relatorio: string }> {
  const saida = path.resolve(o.saida ?? path.join(process.cwd(), 'saida', 'comparacao'));
  const temp = await mkdtemp(path.join(os.tmpdir(), 'prumo-comparar-'));
  try {
    const p = await preparar(specs, o);
    const r = await gerarPrototipos(p.modelo, p.config, { specs: p.specs, saida: path.join(temp, 'html'), recorte: o.recorte, arquivoConfig: p.arquivoConfig });
    const copia = r.paginas.map((x) => ({ ...x, destinoPng: x.destinoPng ? path.join(temp, 'png', path.relative(p.specs, x.destinoPng)) : undefined }));
    const nav = o.navegador ?? new NavegadorPlaywright();
    await nav.abrir();
    try {
      await capturar(copia, nav, { specs: temp, largura: p.config.largura_captura, forcar: true });
    } finally {
      await nav.fechar();
    }
    const pares = p.modelo.telas
      .filter((t) => dentroDoRecorte(t, o.recorte))
      .map((t) => {
        const rel = path.join(t.modulo, t.prototipo.imagem ?? `${t.id}.png`);
        return { tela: t.id, modulo: t.modulo, referencia: path.join(p.specs, rel), gerado: path.join(temp, 'png', rel) };
      })
      .filter((x) => existsSync(x.gerado));
    const itens = await compararPng(pares, saida);
    return { itens, relatorio: path.join(saida, 'index.html') };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
