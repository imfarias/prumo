/**
 * Marca "Software: Prumo" num PNG (chunk tEXt logo após o IHDR), para o programa saber quais PNGs das
 * especificações foram gerados pelo Prumo e avisar antes de sobrescrever os feitos à mão (DSK-08).
 */
const ASSINATURA = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHAVE = 'Software';
const VALOR = 'Prumo';

const TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (const x of b) c = TABELA[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function* chunks(png: Buffer) {
  let i = 8;
  while (i + 8 <= png.length) {
    const tam = png.readUInt32BE(i);
    const tipo = png.toString('latin1', i + 4, i + 8);
    yield { inicio: i, tam, tipo, dados: png.subarray(i + 8, i + 8 + tam), fim: i + 12 + tam };
    i += 12 + tam;
  }
}

export function pngDoPrumo(png: Buffer): boolean {
  if (!png.subarray(0, 8).equals(ASSINATURA)) return false;
  for (const c of chunks(png)) {
    if (c.tipo === 'tEXt' && c.dados.toString('latin1') === `${CHAVE}\0${VALOR}`) return true;
    if (c.tipo === 'IDAT') return false;
  }
  return false;
}

export function marcarPng(png: Buffer): Buffer {
  if (!png.subarray(0, 8).equals(ASSINATURA) || pngDoPrumo(png)) return png;
  const ihdr = chunks(png).next().value;
  if (!ihdr || ihdr.tipo !== 'IHDR') return png;
  const dados = Buffer.from(`${CHAVE}\0${VALOR}`, 'latin1');
  const tipo = Buffer.from('tEXt', 'latin1');
  const chunk = Buffer.alloc(12 + dados.length);
  chunk.writeUInt32BE(dados.length, 0);
  tipo.copy(chunk, 4);
  dados.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([tipo, dados])), 8 + dados.length);
  return Buffer.concat([png.subarray(0, ihdr.fim), chunk, png.subarray(ihdr.fim)]);
}
