// Gera o ícone do Prumo (build/icon.png, 512 px): um prumo (fio + peso) sobre fundo azul-petróleo.
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const L = 512;
const png = new PNG({ width: L, height: L });
const FUNDO = [16, 78, 99];
const TRACO = [244, 239, 226];
const OURO = [226, 170, 60];

function dentroArredondado(x, y, r) {
  const m = 24;
  const cx = Math.min(Math.max(x, m + r), L - m - r);
  const cy = Math.min(Math.max(y, m + r), L - m - r);
  return x >= m && y >= m && x < L - m && y < L - m && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
// Peso: losango arredondado (gota invertida) centrado em (256, 330).
function noPeso(x, y) {
  const dx = Math.abs(x - 256), dy = y - 300;
  if (dy < -60 || dy > 120) return false;
  if (dy <= 40) return dx <= 20 + (dy + 60) * 0.75;
  return dx <= 95 - (dy - 40) * 1.19;
}
for (let y = 0; y < L; y++) {
  for (let x = 0; x < L; x++) {
    const i = (y * L + x) * 4;
    let cor = null;
    if (dentroArredondado(x, y, 96)) {
      cor = FUNDO;
      if (y >= 100 && y < 118 && x >= 150 && x < 362) cor = TRACO; // travessa
      if (x >= 250 && x < 262 && y >= 118 && y < 240) cor = TRACO; // fio
      if (noPeso(x, y)) cor = OURO;
    }
    if (cor) { png.data[i] = cor[0]; png.data[i + 1] = cor[1]; png.data[i + 2] = cor[2]; png.data[i + 3] = 255; }
    else png.data[i + 3] = 0;
  }
}
const destino = path.join(path.dirname(fileURLToPath(import.meta.url)), '../build/icon.png');
writeFileSync(destino, PNG.sync.write(png));
console.log(destino);
