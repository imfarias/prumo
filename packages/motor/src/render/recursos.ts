import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Achado, ConfigProjeto } from '../config/esquema.js';
import { dentroDe } from '../util/caminhos.js';
import { caminhoFonte, cssDosTokens, FONTES_EMBUTIDAS, fontFaces, fontesUsadas } from './tokens-css.js';

/** Grava só se o conteúdo mudou (mantém data de modificação e evita diff no Git). */
export async function gravarSeMudou(destino: string, conteudo: string | Buffer): Promise<boolean> {
  const novo = typeof conteudo === 'string' ? Buffer.from(conteudo, 'utf8') : conteudo;
  if (existsSync(destino)) {
    const atual = await readFile(destino);
    if (atual.equals(novo)) return false;
  }
  await mkdir(path.dirname(destino), { recursive: true });
  // Gravação atômica: cancelar no meio nunca deixa arquivo pela metade.
  const temp = `${destino}.${process.pid}.${Date.now().toString(36)}.tmp`;
  await writeFile(temp, novo);
  await rename(temp, destino);
  return true;
}

const RE_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/g;

/** Copia um CSS do projeto e tudo o que ele referencia por caminho relativo (fontes, imagens, @import). */
async function copiarCssComDependencias(origem: string, destino: string, raizOrigem: string, raizDestino: string, vistos: Set<string>) {
  if (vistos.has(origem)) return;
  vistos.add(origem);
  const css = await readFile(origem, 'utf8');
  await gravarSeMudou(destino, css);
  for (const m of css.matchAll(RE_URL)) {
    const ref = (m[2] ?? m[4] ?? '').split(/[?#]/)[0]!;
    if (!ref || /^(data:|https?:|\/\/|#)/i.test(ref)) continue;
    const de = path.resolve(path.dirname(origem), ref);
    if (!existsSync(de)) continue;
    const rel = path.relative(raizOrigem, de);
    if (rel.startsWith('..')) continue;
    const para = dentroDe(raizDestino, path.join(raizDestino, rel));
    if (de.endsWith('.css')) await copiarCssComDependencias(de, para, raizOrigem, raizDestino, vistos);
    else {
      await mkdir(path.dirname(para), { recursive: true });
      await copyFile(de, para);
    }
  }
}

/** govbr.css é gerado no build do motor (scripts/govbr-css.mjs); sem ele, o kit não tem o estilo do padrão. */
async function lerGovbrCss(kitDir: string): Promise<string> {
  const arquivo = path.join(kitDir, 'govbr.css');
  if (!existsSync(arquivo)) throw new Error(`Falta ${arquivo}: rode o build do motor (npm run build -w @prumo/motor).`);
  return readFile(arquivo, 'utf8');
}

export interface Recursos {
  logo?: string; // relativo a _recursos
  logoClaro?: string; // relativo a _recursos (RN-88)
  cssAdicional?: string; // relativo a _recursos
}

/** prumo.css (tokens + kit), fontes embutidas, logo e CSS adicional em <saida>/_recursos. */
export async function gravarRecursos(saida: string, kitDir: string, config: ConfigProjeto, specs: string, achados: Achado[], arquivoConfig: string): Promise<Recursos> {
  const dir = dentroDe(saida, path.join(saida, '_recursos'));
  await mkdir(path.join(dir, 'fontes'), { recursive: true });
  const govbr = config.identidade.design_system === 'govbr';
  // govbr: cores e fonte do padrão (as do projeto não se aplicam, FA-03); proprio: tokens do projeto.
  const css = govbr
    ? `${fontFaces('Raleway')}\n${await lerGovbrCss(kitDir)}\n${await readFile(path.join(kitDir, 'ajustes.css'), 'utf8')}`
    : cssDosTokens(config, achados, arquivoConfig) + (await readFile(path.join(kitDir, 'estilo.css'), 'utf8'));
  await gravarSeMudou(path.join(dir, 'prumo.css'), css);
  await gravarSeMudou(path.join(dir, 'prumo-prototipo.js'), await readFile(path.join(kitDir, '..', 'comum', 'prumo-prototipo.js')));
  for (const familia of govbr ? ['Raleway'] : fontesUsadas(config, [], arquivoConfig)) {
    for (const a of FONTES_EMBUTIDAS[familia]!.arquivos) {
      await gravarSeMudou(path.join(dir, 'fontes', a.nome), await readFile(caminhoFonte(familia, a.nome)));
    }
  }
  const r: Recursos = {};
  if (config.projeto.logo) {
    const origem = path.resolve(specs, config.projeto.logo);
    if (existsSync(origem)) {
      r.logo = `logo${path.extname(origem).toLowerCase()}`;
      await gravarSeMudou(path.join(dir, r.logo), await readFile(origem));
    } else {
      achados.push({ severidade: 'aviso', codigo: 'config/logo', arquivo: arquivoConfig, mensagem: `Logo "${config.projeto.logo}" não encontrado; as telas saem sem logo.` });
    }
  }
  if (config.projeto.logo_claro) {
    const origem = path.resolve(specs, config.projeto.logo_claro);
    if (existsSync(origem)) {
      r.logoClaro = `logo-claro${path.extname(origem).toLowerCase()}`;
      await gravarSeMudou(path.join(dir, r.logoClaro), await readFile(origem));
    } else {
      achados.push({ severidade: 'aviso', codigo: 'config/logo', arquivo: arquivoConfig, mensagem: `Logo claro "${config.projeto.logo_claro}" não encontrado; o cabeçalho claro usa o logo normal.` });
    }
  }
  if (config.identidade.css_adicional) {
    const origem = path.resolve(specs, config.identidade.css_adicional);
    if (existsSync(origem)) {
      const raiz = path.dirname(origem);
      const destino = path.join(dir, 'adicional', path.basename(origem));
      await copiarCssComDependencias(origem, destino, raiz, path.join(dir, 'adicional'), new Set());
      r.cssAdicional = `adicional/${path.basename(origem)}`;
    } else {
      achados.push({ severidade: 'aviso', codigo: 'config/css-adicional', arquivo: arquivoConfig, mensagem: `CSS adicional "${config.identidade.css_adicional}" não encontrado.` });
    }
  }
  return r;
}
