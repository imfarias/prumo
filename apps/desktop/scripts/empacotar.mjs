// Monta apps/desktop/dist: processo principal (ESM), preload (CJS), janela (Preact) e os recursos do motor.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..');
const DIST = path.join(APP, 'dist');
const MOTOR = path.resolve(APP, '../../packages/motor');
const require = createRequire(path.join(MOTOR, 'package.json'));
const producao = process.env.NODE_ENV === 'production' || process.argv.includes('--producao');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(path.join(DIST, 'janela', 'fontes'), { recursive: true });

// O kit de documentação usa o script compilado do motor; garante que exista.
if (!existsSync(path.join(MOTOR, 'kits/docs/prumo-docs.js'))) {
  await import(path.join(MOTOR, 'scripts/web.mjs')).then(() => undefined);
}

const comum = { bundle: true, logLevel: 'warning', legalComments: 'linked', sourcemap: producao ? false : 'linked', minify: producao };

await build({
  ...comum,
  entryPoints: [path.join(APP, 'src/principal/main.ts')],
  outfile: path.join(DIST, 'main.mjs'),
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // playwright-core só é usado pela CLI (import preguiçoso); no programa o navegador é o próprio Electron.
  external: ['electron', 'playwright-core'],
  // Em produção as variáveis de teste (diálogos e editor falsos) deixam de existir no código.
  define: producao ? { 'process.env.PRUMO_TESTE_DIALOGOS': 'undefined', 'process.env.PRUMO_EDITOR_TESTE': 'undefined' } : {},
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});

await build({
  ...comum,
  entryPoints: [path.join(APP, 'src/preload/preload.ts')],
  outfile: path.join(DIST, 'preload.cjs'),
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
});

await build({
  ...comum,
  entryPoints: [path.join(APP, 'src/janela/app.tsx')],
  outfile: path.join(DIST, 'janela', 'janela.js'),
  platform: 'browser',
  format: 'iife',
  target: 'chrome140',
  jsx: 'automatic',
  jsxImportSource: 'preact',
});

for (const f of ['index.html', 'estilo.css']) cpSync(path.join(APP, 'src/janela', f), path.join(DIST, 'janela', f));
const atkinson = path.join(path.dirname(require.resolve('@fontsource/atkinson-hyperlegible/package.json')), 'files');
const jost = path.join(path.dirname(require.resolve('@fontsource/jost/package.json')), 'files');
for (const n of ['atkinson-hyperlegible-latin-400-normal.woff2', 'atkinson-hyperlegible-latin-700-normal.woff2']) cpSync(path.join(atkinson, n), path.join(DIST, 'janela', 'fontes', n));

// Recursos do motor (PRUMO_RECURSOS): kits, fontes embutidas (subconjunto latino) e axe.
const REC = path.join(DIST, 'recursos');
cpSync(path.join(MOTOR, 'kits'), path.join(REC, 'kits'), { recursive: true });
mkdirSync(path.join(REC, 'fontes'), { recursive: true });
const { readdirSync } = await import('node:fs');
for (const [dir, prefixo] of [[atkinson, 'atkinson-hyperlegible-latin-'], [jost, 'jost-latin-']]) {
  for (const n of readdirSync(dir)) if (n.startsWith(prefixo) && n.endsWith('.woff2')) cpSync(path.join(dir, n), path.join(REC, 'fontes', n));
}
cpSync(require.resolve('axe-core/axe.min.js'), path.join(REC, 'axe.min.js'));
cpSync(path.join(APP, 'build/icon.png'), path.join(DIST, 'icone.png'));
console.log(`Prumo desktop empacotado em ${path.relative(process.cwd(), DIST) || DIST}${producao ? ' (produção)' : ''}.`);
