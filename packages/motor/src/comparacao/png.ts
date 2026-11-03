import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface ParComparacao {
  tela: string;
  modulo: string;
  referencia: string; // PNG atual (ex.: feito à mão)
  gerado: string; // PNG do Prumo
}

export interface ItemComparacao {
  tela: string;
  modulo: string;
  diferenca: number | null; // % de pixels diferentes; null = sem referência
  tamanhoReferencia?: string;
  tamanhoGerado: string;
}

function lerPng(b: Buffer) {
  return PNG.sync.read(b);
}

/** Coloca a imagem num quadro maior, com fundo branco, para comparar tamanhos diferentes. */
function emQuadro(img: PNG, w: number, h: number): Buffer {
  const out = new PNG({ width: w, height: h });
  out.data.fill(255);
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out.data;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Relatório lado a lado (CA-13): referência × gerado × diferença, com a % por tela. */
export async function compararPng(pares: ParComparacao[], saida: string): Promise<ItemComparacao[]> {
  await mkdir(path.join(saida, 'imagens'), { recursive: true });
  const itens: ItemComparacao[] = [];
  const blocos: string[] = [];
  for (const [i, p] of pares.entries()) {
    const base = `${String(i + 1).padStart(3, '0')}`;
    const gerado = lerPng(await readFile(p.gerado));
    await copyFile(p.gerado, path.join(saida, 'imagens', `${base}-gerado.png`));
    let diferenca: number | null = null;
    let tamRef: string | undefined;
    if (existsSync(p.referencia)) {
      const ref = lerPng(await readFile(p.referencia));
      tamRef = `${ref.width}×${ref.height}`;
      const w = Math.max(ref.width, gerado.width);
      const h = Math.max(ref.height, gerado.height);
      const dif = new PNG({ width: w, height: h });
      const n = pixelmatch(emQuadro(ref, w, h), emQuadro(gerado, w, h), dif.data, w, h, { threshold: 0.1 });
      diferenca = Math.round((n / (w * h)) * 10000) / 100;
      await copyFile(p.referencia, path.join(saida, 'imagens', `${base}-referencia.png`));
      await writeFile(path.join(saida, 'imagens', `${base}-diferenca.png`), PNG.sync.write(dif));
    }
    itens.push({ tela: p.tela, modulo: p.modulo, diferenca, tamanhoReferencia: tamRef, tamanhoGerado: `${gerado.width}×${gerado.height}` });
    blocos.push(`<section id="t${base}"><h2>${esc(p.modulo)} · ${esc(p.tela)} — ${diferenca === null ? 'sem referência' : `${diferenca}% diferente`}</h2>
<div class="lado">${diferenca === null ? '' : `<figure><img src="imagens/${base}-referencia.png" alt="Referência de ${esc(p.tela)}"><figcaption>Atual (${tamRef})</figcaption></figure>`}
<figure><img src="imagens/${base}-gerado.png" alt="Gerado de ${esc(p.tela)}"><figcaption>Prumo (${gerado.width}×${gerado.height})</figcaption></figure>
${diferenca === null ? '' : `<figure><img src="imagens/${base}-diferenca.png" alt="Diferença de ${esc(p.tela)}"><figcaption>Diferença</figcaption></figure>`}</div></section>`);
  }
  const linhas = itens
    .map((x, i) => `<tr><td><a href="#t${String(i + 1).padStart(3, '0')}">${esc(x.tela)}</a></td><td>${esc(x.modulo)}</td><td class="n">${x.diferenca ?? '—'}${x.diferenca === null ? '' : '%'}</td><td>${x.tamanhoReferencia ?? '—'}</td><td>${x.tamanhoGerado}</td></tr>`)
    .join('\n');
  await writeFile(
    path.join(saida, 'index.html'),
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comparação de protótipos</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px}table{border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px 10px;text-align:left}.n{text-align:right;font-variant-numeric:tabular-nums}.lado{display:flex;gap:12px;align-items:flex-start}figure{margin:0;flex:1}img{width:100%;border:1px solid #ccc}h2{font-size:16px;margin-top:40px}</style></head>
<body><main><h1>Comparação: PNGs atuais × gerados pelo Prumo</h1><p>${itens.length} telas. A porcentagem é a fração de pixels diferentes (fundo branco onde os tamanhos não coincidem).</p>
<table><thead><tr><th scope="col">Tela</th><th scope="col">Módulo</th><th scope="col">Diferença</th><th scope="col">Atual</th><th scope="col">Gerado</th></tr></thead><tbody>
${linhas}</tbody></table>
${blocos.join('\n')}</main></body></html>\n`,
    'utf8',
  );
  return itens;
}
