// Empacota o script da documentação (web/) num arquivo só, sem dependências externas.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(aqui, '../web/principal.ts')],
  outfile: path.join(aqui, '../kits/docs/prumo-docs.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  legalComments: 'none',
  logLevel: 'warning',
});
