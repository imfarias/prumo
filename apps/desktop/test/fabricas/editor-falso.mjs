// Editor falso dos testes (PRUMO_EDITOR_TESTE): grava "arquivo:linha" em PRUMO_EDITOR_SAIDA (ou ao lado deste script).
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [arquivo, linha] = process.argv.slice(2);
const saida = process.env.PRUMO_EDITOR_SAIDA || path.join(path.dirname(fileURLToPath(import.meta.url)), 'editor-falso.saida.txt');
appendFileSync(saida, `${arquivo}:${linha}\n`);
