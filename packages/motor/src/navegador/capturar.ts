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
import { andar, type OpcoesExecucao } from '../util/execucao.js';

export interface ResultadoCaptura {
  tela: string;
  destino: string;
  situacao: 'gravado' | 'sem-mudanca';
}

/** Duas imagens são "iguais" se têm o mesmo tamanho e nenhum pixel difere (antialiasing ignorado). */
function mesmaImagem(a: Buffer, b: Buffer): boolean {
  if (a.equals(b)) return true;
  try {
    const x = PNG.sync.read(a);
    const y = PNG.sync.read(b);
    if (x.width !== y.width || x.height !== y.height) return false;
    return pixelmatch(x.data, y.data, null, x.width, x.height, { threshold: 0, includeAA: false }) === 0;
  } catch {
    return false;
  }
}

/** Captura o estado padrão de cada tela e grava em Especificações/<módulo>/<tela>.png (FA-09: não regrava igual). */
export async function capturar(
  paginas: PaginaGerada[],
  navegador: Navegador,
  o: { specs: string; largura: number; forcar?: boolean; paralelo?: number; aoGravar?: (r: ResultadoCaptura) => void } & OpcoesExecucao,
): Promise<ResultadoCaptura[]> {
  const alvos = paginas.filter((p) => p.destinoPng);
  const resultados: ResultadoCaptura[] = new Array(alvos.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < alvos.length) {
      const i = proximo++;
      const p = alvos[i]!;
      andar(o, `Capturando: ${p.tela}`, i, alvos.length);
      const destino = dentroDe(o.specs, p.destinoPng!);
      const png = await navegador.capturar(pathToFileURL(p.arquivo).href, { largura: o.largura });
      let situacao: ResultadoCaptura['situacao'] = 'gravado';
      if (!o.forcar && existsSync(destino) && mesmaImagem(await readFile(destino), png)) situacao = 'sem-mudanca';
      else await gravarSeMudou(destino, png);
      resultados[i] = { tela: p.tela, destino: path.resolve(destino), situacao };
      o.aoGravar?.(resultados[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.paralelo ?? 4, alvos.length) }, trabalhador));
  andar(o, 'Capturas concluídas', alvos.length, alvos.length);
  return resultados;
}
