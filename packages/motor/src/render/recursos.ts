import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Achado, ConfigProjeto } from '../config/esquema.js';
import { dentroDe } from '../util/caminhos.js';
import { caminhoFonte, cssDosTokens, FONTES_EMBUTIDAS, fontesUsadas } from './tokens-css.js';

/** Grava só se o conteúdo mudou (mantém data de modificação e evita diff no Git). */
export async function gravarSeMudou(destino: string, conteudo: string | Buffer): Promise<boolean> {
  const novo = typeof conteudo === 'string' ? Buffer.from(conteudo, 'utf8') : conteudo;
  if (existsSync(destino)) {
    const atual = await readFile(destino);
    if (atual.equals(novo)) return false;
  }
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, novo);
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

export interface Recursos {
  logo?: string; // relativo a _recursos
  cssAdicional?: string; // relativo a _recursos
}

/** prumo.css (tokens + kit), fontes embutidas, logo e CSS adicional em <saida>/_recursos. */
export async function gravarRecursos(saida: string, kitDir: string, config: ConfigProjeto, specs: string, achados: Achado[], arquivoConfig: string): Promise<Recursos> {
  const dir = dentroDe(saida, path.join(saida, '_recursos'));
  await mkdir(path.join(dir, 'fontes'), { recursive: true });
  const css = cssDosTokens(config, achados, arquivoConfig) + (await readFile(path.join(kitDir, 'estilo.css'), 'utf8'));
  await gravarSeMudou(path.join(dir, 'prumo.css'), css);
  for (const familia of fontesUsadas(config, [], arquivoConfig)) {
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
