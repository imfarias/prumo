// Monta kits/govbr/govbr.css a partir do gov.br DS (@govbr-ds/core, MIT): tokens + base + só os componentes usados,
// reduzidos pelo PurgeCSS às regras que os templates do kit usam. Roda no build do motor (o arquivo não é versionado).
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PurgeCSS } from 'purgecss';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MOTOR = path.resolve(AQUI, '..');
const require = createRequire(path.join(MOTOR, 'package.json'));
const DIST = path.join(path.dirname(require.resolve('@govbr-ds/core/package.json')), 'dist');
const versao = JSON.parse(await readFile(path.join(DIST, '..', 'package.json'), 'utf8')).version;

const COMPONENTES = ['header', 'menu', 'breadcrumb', 'footer', 'input', 'select', 'checkbox', 'textarea', 'upload', 'button', 'table', 'pagination', 'message', 'tag', 'list', 'item', 'divider'];
const partes = [path.join(DIST, 'core-tokens.min.css'), path.join(DIST, 'core-base.min.css'), ...COMPONENTES.map((c) => path.join(DIST, 'components', c, `${c}.min.css`))];
const css = (await Promise.all(partes.map((p) => readFile(p, 'utf8')))).join('\n');

const [r] = await new PurgeCSS().purge({
  // fast-glob só entende barra normal (no Windows o path.join usa a invertida).
  content: [path.join(MOTOR, 'kits', 'govbr', '**', '*.njk'), path.join(MOTOR, 'kits', 'proprio', 'layouts', '*.njk'), path.join(MOTOR, 'kits', 'proprio', 'indice.njk')].map((p) => p.split(path.sep).join('/')),
  css: [{ raw: css }],
  // Classes montadas nos templates por variável ou por estado.
  safelist: {
    standard: ['danger', 'success', 'warning', 'info', 'active', 'primary', 'secondary', 'small', 'circle', 'vertical', 'home', 'page'],
  },
  variables: true,
  keyframes: true,
  fontFace: false,
});

const cabecalho = `/*! gov.br DS ${versao} (MIT, https://www.gov.br/ds) — reduzido pelo Prumo às regras usadas pelo kit govbr. */\n`;
const destino = path.join(MOTOR, 'kits', 'govbr', 'govbr.css');
await writeFile(destino, cabecalho + r.css);
console.log(`govbr.css: ${Math.round((cabecalho.length + r.css.length) / 1024)} KB (de ${Math.round(css.length / 1024)} KB)`);
