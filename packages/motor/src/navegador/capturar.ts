import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PaginaGerada } from '../render/gerar.js';
import { gravarSeMudou } from '../render/recursos.js';
import { dentroDe } from '../util/caminhos.js';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Navegador } from './navegador.js';
import { marcarPng } from './marca-png.js';
import { andar, type OpcoesExecucao } from '../util/execucao.js';

export interface ResultadoCaptura {
  tela: string;
  destino: string;
  situacao: 'gravado' | 'sem-mudanca';
  /** Captura de celular (390 px, `<tela>-celular.png`, RN-87). */
  celular?: boolean;
}

/** Largura da captura de celular (RN-87). */
export const LARGURA_CELULAR = 390;
/** `<tela>.png` → `<tela>-celular.png`, ao lado do PNG de computador. */
export const destinoCelular = (png: string) => png.replace(/(\.png)?$/i, '-celular.png');

/**
 * Duas imagens são "iguais" se têm o mesmo tamanho e no máximo 0,01% dos pixels difere (antialiasing ignorado).
 * O Chromium sem GPU (CI Linux) varia alguns pixels entre capturas da mesma página; regravar por isso suja o Git.
 * Uma mudança real (cor, texto, campo) atinge muito mais que isso.
 */
const TOLERANCIA_MESMA = 0.0001;
function mesmaImagem(a: Buffer, b: Buffer): boolean {
  if (a.equals(b)) return true;
  try {
    const x = PNG.sync.read(a);
    const y = PNG.sync.read(b);
    if (x.width !== y.width || x.height !== y.height) return false;
    return pixelmatch(x.data, y.data, null, x.width, x.height, { threshold: 0, includeAA: false }) <= Math.floor(x.width * x.height * TOLERANCIA_MESMA);
  } catch {
    return false;
  }
}

/** Captura o estado padrão de cada tela e grava em Especificações/<módulo>/<tela>.png (FA-09: não regrava igual). */
export async function capturar(
  paginas: PaginaGerada[],
  navegador: Navegador,
  o: { specs: string; largura: number; forcar?: boolean; celular?: boolean; paralelo?: number; aoGravar?: (r: ResultadoCaptura) => void } & OpcoesExecucao,
): Promise<ResultadoCaptura[]> {
  // Com celular, cada tela tem duas capturas: a de computador e a de 390 px (nunca no lugar da outra).
  const alvos = paginas.filter((p) => p.destinoPng).flatMap((p) => (o.celular ? [{ p, celular: false }, { p, celular: true }] : [{ p, celular: false }]));
  const resultados: ResultadoCaptura[] = new Array(alvos.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < alvos.length) {
      const i = proximo++;
      const { p, celular } = alvos[i]!;
      andar(o, `Capturando: ${p.tela}${celular ? ' (celular)' : ''}`, i, alvos.length);
      const destino = dentroDe(o.specs, celular ? destinoCelular(p.destinoPng!) : p.destinoPng!);
      // #captura: o script do protótipo não monta a barra, e o PNG sai como antes (0004).
      const png = marcarPng(await navegador.capturar(pathToFileURL(p.arquivo).href + '#captura', { largura: celular ? LARGURA_CELULAR : o.largura }));
      let situacao: ResultadoCaptura['situacao'] = 'gravado';
      if (!o.forcar && existsSync(destino) && mesmaImagem(await readFile(destino), png)) situacao = 'sem-mudanca';
      else await gravarSeMudou(destino, png);
      resultados[i] = { tela: p.tela, destino: path.resolve(destino), situacao, ...(celular ? { celular: true } : {}) };
      o.aoGravar?.(resultados[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.paralelo ?? 4, alvos.length) }, trabalhador));
  andar(o, 'Capturas concluídas', alvos.length, alvos.length);
  return resultados;
}
