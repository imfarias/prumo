import path from 'node:path';
import type { Achado } from '../config/esquema.js';
import type { Preparado } from '../executar.js';
import { classificarTabela, ehArquivoDeApoio, filhoPrototipo } from '../modelo/montar.js';
import type { Tela } from '../modelo/tipos.js';
import { chaveCodigo, type Referencia } from '../parser/indice.js';
import { extrairLinks } from '../parser/links.js';
import type { ArquivoFeature, Filho, Tabela } from '../parser/tipos.js';
import { hash32 } from '../util/hash.js';
import { normalizar, slug, textoPuro, tituloDeArquivo } from '../util/texto.js';
import type { ResultadoComparacao } from './comparar.js';
import { escapar, renderizarInline, renderizarMarkdown, type DestinoLink, type OpcoesMarkdown } from './markdown.js';
import type { DocBusca, Documentacao, FilhoDoc, Modo, NoArvore, PaginaDoc, PassoDoc, Previa, TabelaDoc, UsoDoc } from './tipos.js';

/** Nome de arquivo ASCII estável para a página da funcionalidade (CT-U08). */
export function arquivoDaPagina(endereco: string): string {
  return `${slug(endereco).slice(0, 60)}-${hash32(endereco.normalize('NFC')).toString(36)}.html`;
}

export const rotaFuncionalidade = (end: string, pos?: number) => `#!/f/${encodeURIComponent(end)}${pos === undefined ? '' : `/c/${pos}`}`;

/** Interpreta os links do Pirilampo: '#/scenario/{end}/{n}', '#!/feature/{end}' e variações. */
export function lerRotaAntiga(href: string): { endereco: string; posicao?: number; termo?: string } | undefined {
  const m = /^#!?\/(scenario|feature|f)\/([^/]+)(?:\/(?:c\/)?([^/]*))?\/?$/.exec(href);
  if (!m) return undefined;
  let end: string;
  try {
    end = decodeURIComponent(m[2]!).normalize('NFC');
  } catch {
    end = m[2]!.normalize('NFC');
  }
  const resto = m[3] ? decodeURIComponent(m[3]) : undefined;
  if (m[1] === 'feature') return { endereco: end, termo: resto || undefined };
  const n = resto === undefined || resto === '' ? undefined : Number(resto);
  return { endereco: end, posicao: Number.isInteger(n) ? n : undefined };
}

interface Contexto {
  p: Preparado;
  modo: Modo;
  porEndereco: Map<string, ArquivoFeature>;
  referencias: Map<string, Referencia>; // endereço/posição → referência
  imagens: Map<string, string>;
}

/** Destino de um link dentro da página `atual` (modo pasta: relativo a f/; arquivo único: rota). */
function destino(ctx: Contexto, href: string, atual: ArquivoFeature): DestinoLink | undefined {
  const r = lerRotaAntiga(href);
  if (!r) return undefined;
  const alvo = ctx.porEndereco.get(r.endereco);
  const existe = alvo && (r.posicao === undefined || alvo.filhos.some((f) => f.posicao === r.posicao));
  if (!alvo || !existe) return { href: ctx.modo === 'pasta' ? '#' : rotaFuncionalidade(r.endereco, r.posicao), rota: href, quebrado: true };
  const chave = r.posicao === undefined ? undefined : `${alvo.endereco}/${r.posicao}`;
  const previa = chave && ctx.referencias.has(chave) ? chave : undefined;
  if (ctx.modo === 'unico') return { href: rotaFuncionalidade(alvo.endereco, r.posicao), rota: href, previa };
  const ancora = r.posicao === undefined ? '' : `#c-${r.posicao}`;
  const arquivo = alvo === atual ? '' : arquivoDaPagina(alvo.endereco);
  return { href: `${arquivo}${ancora}` || '#', rota: href, previa };
}

function opcoesMd(ctx: Contexto, atual: ArquivoFeature): OpcoesMarkdown {
  return {
    linkDe: (h) => destino(ctx, h, atual),
    imagemDe: (src) => {
      const abs = path.resolve(path.dirname(atual.caminho), decodeURIComponent(src));
      const rel = path.relative(ctx.p.specs, abs).split(path.sep).join('/');
      if (rel.startsWith('..')) return undefined;
      const dest = `img/${rel}`;
      ctx.imagens.set(abs, dest);
      return ctx.modo === 'pasta' ? `../recursos/${dest.split('/').map(encodeURIComponent).join('/')}` : `prumo-img:${dest}`;
    },
  };
}

function tabelaDoc(t: Tabela, o: OpcoesMarkdown): TabelaDoc {
  const tipo = classificarTabela(t);
  const simNao = (cab: string, v: string) =>
    tipo === 'definicao' && /^(editavel|obrigatorio)$/.test(normalizar(cab)) && /^[sn]$/i.test(v.trim())
      ? /^s$/i.test(v.trim()) ? '<span class="sim">Sim</span>' : '<span class="nao">Não</span>'
      : renderizarInline(v, o);
  return {
    tipo,
    cabecalho: t.cabecalho.map((c) => renderizarInline(c, o)),
    linhas: t.linhas.map((l) => l.celulas.map((c, i) => simNao(t.cabecalho[i] ?? '', c))),
  };
}

function filhoDoc(ctx: Contexto, a: ArquivoFeature, f: Filho, semImagens = false): FilhoDoc {
  const base = opcoesMd(ctx, a);
  // Arquivo único: o PNG do @prototipo não é embutido quando a tela já tem o protótipo interativo.
  const o: OpcoesMarkdown = semImagens ? { ...base, imagemDe: () => undefined } : base;
  const passos: PassoDoc[] = f.passos.map((p) => ({
    palavra: p.palavra.trim(),
    html: renderizarInline(p.texto, o),
    tabela: p.tabela ? tabelaDoc(p.tabela, o) : undefined,
    docString: p.docString,
  }));
  return {
    posicao: f.posicao,
    tipo: f.tipo,
    titulo: f.titulo,
    ancora: `c-${f.posicao}`,
    tags: f.tags,
    descricaoHtml: renderizarMarkdown(f.descricao, o),
    passos,
    exemplos: f.exemplos.map((t) => tabelaDoc(t, o)),
    codigo: chaveCodigo(f.titulo)?.chave,
  };
}

function filhoDaLinha(a: ArquivoFeature, linha: number): Filho | undefined {
  let atual: Filho | undefined;
  for (const f of a.filhos) if (f.linha <= linha) atual = f;
  return atual;
}

function textoDoFilhoParaBusca(f: Filho): string {
  const partes = [f.descricao, ...f.passos.flatMap((p) => [p.texto, ...(p.tabela ? [p.tabela.cabecalho.join(' '), ...p.tabela.linhas.map((l) => l.celulas.join(' '))] : [])])];
  for (const t of f.exemplos) partes.push(t.cabecalho.join(' '), ...t.linhas.map((l) => l.celulas.join(' ')));
  return textoPuro(partes.join(' ')).slice(0, 4000);
}

const TIPO_BUSCA: Record<string, DocBusca['tipo']> = { RNG: 'regra', LOV: 'lista', MSG: 'mensagem', EMAIL: 'email' };

function arvore(paginas: PaginaDoc[]): NoArvore[] {
  const raiz: NoArvore[] = [];
  const apoio: NoArvore = { titulo: 'Regras e mensagens', filhos: [] };
  for (const pg of paginas) {
    const pastas = path.posix.dirname(pg.relativo).split('/').filter((x) => x && x !== '.');
    let nivel = pg.apoio ? apoio.filhos : raiz;
    for (const nome of pastas) {
      let no = nivel.find((n) => !n.endereco && n.titulo === nome.replace(/_/g, ' '));
      if (!no) nivel.push((no = { titulo: nome.replace(/_/g, ' '), filhos: [] }));
      nivel = no.filhos;
    }
    nivel.push({ titulo: tituloDeArquivo(pg.nomeFeature) || pg.nomeFeature, endereco: pg.endereco, arquivo: pg.arquivo, filhos: [], situacao: pg.situacao, erro: !!pg.erroSintaxe });
  }
  const marcarPastas = (n: NoArvore): NoArvore['situacao'] => {
    if (n.endereco) return n.situacao;
    const s = n.filhos.map(marcarPastas);
    n.situacao = s.some((x) => x && x !== 'igual') ? 'alterada' : undefined;
    return n.situacao;
  };
  if (apoio.filhos.length) raiz.push(apoio);
  raiz.forEach(marcarPastas);
  return raiz;
}

export interface OpcoesModelo {
  modo: Modo;
  comparacao?: ResultadoComparacao;
  anterior?: Preparado;
  achados?: Achado[];
  /** Arquivos com erro de sintaxe (FA-11): caminho relativo → texto e erro. */
  comErro?: { relativo: string; fonte: string; linha?: number; mensagem: string }[];
}

/** Preparado (0001) → modelo da documentação. */
export function modeloDaDocumentacao(p: Preparado, o: OpcoesModelo): Documentacao {
  const porEndereco = new Map(p.arquivos.map((a) => [a.endereco.normalize('NFC'), a]));
  const referencias = new Map(p.indice.referencias.map((r) => [r.endereco, r]));
  const ctx: Contexto = { p, modo: o.modo, porEndereco, referencias, imagens: new Map() };
  const telas = new Map(p.modelo.telas.map((t) => [t.endereco, t]));

  // "Usada em": quem cita cada endereço/posição.
  const usos = new Map<string, UsoDoc[]>();
  for (const a of p.arquivos) {
    for (const l of a.links) {
      if (l.tipo !== 'cenario' || l.posicao === undefined) continue;
      const chave = `${l.endereco.normalize('NFC')}/${l.posicao}`;
      const f = filhoDaLinha(a, l.origem.linha);
      const lista = usos.get(chave) ?? [];
      if (!lista.some((u) => u.endereco === a.endereco && u.posicao === (f?.posicao ?? -1))) {
        const pos = f?.posicao ?? -1;
        const href = o.modo === 'pasta' ? `${arquivoDaPagina(a.endereco)}${pos >= 0 ? `#c-${pos}` : ''}` : rotaFuncionalidade(a.endereco, pos >= 0 ? pos : undefined);
        lista.push({ endereco: a.endereco, arquivo: arquivoDaPagina(a.endereco), pagina: tituloDeArquivo(a.nome) || a.nome, posicao: pos, cenario: f?.titulo ?? 'Descrição', href });
      }
      usos.set(chave, lista);
    }
  }

  const paginas: PaginaDoc[] = p.arquivos.map((a) => {
    const apoio = ehArquivoDeApoio(a, p.config);
    const om = opcoesMd(ctx, a);
    const mud = o.comparacao?.paginas.get(a.endereco);
    const temTela = telas.has(a.endereco);
    const filhos = a.filhos.map((f) => {
      const fd = filhoDoc(ctx, a, f, o.modo === 'unico' && temTela && f.tags.includes('@prototipo'));
      if (fd.codigo) fd.usadaEm = usos.get(`${a.endereco.normalize('NFC')}/${f.posicao}`) ?? [];
      const m = mud?.filhos.get(f.posicao);
      if (m) {
        fd.situacao = m.situacao;
        fd.diffHtml = m.diffHtml;
      } else if (mud) fd.situacao = mud.situacao === 'nova' ? 'nova' : 'igual';
      return fd;
    });
    const tela: Tela | undefined = telas.get(a.endereco);
    const citadas = [...new Map(a.links
      .filter((l) => l.tipo === 'cenario' && l.posicao !== undefined && referencias.has(`${l.endereco.normalize('NFC')}/${l.posicao}`))
      .map((l) => {
        const r = referencias.get(`${l.endereco.normalize('NFC')}/${l.posicao}`)!;
        const d = destino(ctx, l.alvo.startsWith('#') ? l.alvo : `#${l.alvo}`, a)!;
        return [r.chave, { codigo: r.codigo, titulo: r.titulo, href: d.href, previa: r.endereco }] as const;
      })).values()].sort((x, y) => (x.codigo < y.codigo ? -1 : 1));
    const proto = filhoPrototipo(a);
    const pg: PaginaDoc = {
      endereco: a.endereco,
      arquivo: arquivoDaPagina(a.endereco),
      nomeFeature: a.nome,
      titulo: tela?.titulo ?? (tituloDeArquivo(a.titulo || a.nome) || a.nome),
      modulo: a.metadados['Módulo']?.valor ?? a.pasta.replace(/_/g, ' '),
      pasta: a.pasta,
      relativo: a.relativo,
      tipo: a.metadados['Tipo']?.valor,
      fluxo: a.metadados['Fluxo']?.valor,
      narrativaHtml: renderizarMarkdown(a.descricao, om),
      filhos,
      removidos: (mud?.removidos ?? []).map((r) => ({ titulo: r.titulo, html: `<del><span class="sr">excluído: </span>${escapar(r.texto).replace(/\n/g, '<br>')}</del>` })),
      citadas,
      fonte: a.fonte,
      apoio,
      situacao: mud?.situacao,
    };
    if (tela && proto) {
      const estados = (t: Tela) => t.estados.map((e) => ({ id: e.id, rotulo: rotuloEstado(e.id), caminho: `prototipos/${t.modulo}/${t.id}/${e.id}.html` }));
      const pngAbs = path.join(p.specs, tela.modulo, tela.prototipo.imagem ?? `${tela.id}.png`);
      const png = opcoesMd(ctx, a).imagemDe(path.relative(path.dirname(a.caminho), pngAbs).split(path.sep).join('/'));
      pg.prototipo = { tela: tela.id, modulo: tela.modulo, estados: tela.prototipo.html ? [] : estados(tela), png, html: tela.prototipo.html ? `especificacoes/${tela.modulo}/${tela.prototipo.html}` : undefined };
      const antTela = o.anterior?.modelo.telas.find((t) => t.endereco === a.endereco);
      if (antTela && mud?.situacao === 'alterada') pg.prototipo.anterior = { estados: antTela.estados.map((e) => ({ id: e.id, rotulo: rotuloEstado(e.id), caminho: `prototipos-anterior/${antTela.modulo}/${antTela.id}/${e.id}.html` })) };
    }
    if (mud?.anterior && mud.situacao === 'alterada' && o.anterior) {
      const ctxAnt: Contexto = { p: o.anterior, modo: o.modo, porEndereco: new Map(o.anterior.arquivos.map((x) => [x.endereco.normalize('NFC'), x])), referencias: new Map(o.anterior.indice.referencias.map((r) => [r.endereco, r])), imagens: new Map() };
      pg.anterior = { narrativaHtml: renderizarMarkdown(mud.anterior.descricao, opcoesMd(ctxAnt, mud.anterior)), filhos: mud.anterior.filhos.map((f) => filhoDoc(ctxAnt, mud.anterior!, f)) };
    }
    return pg;
  });

  for (const e of o.comErro ?? []) {
    const pasta = path.posix.basename(path.posix.dirname(e.relativo));
    const nome = path.posix.basename(e.relativo, '.feature');
    const endereco = `${pasta}_${nome}`;
    paginas.push({
      endereco, arquivo: arquivoDaPagina(endereco), nomeFeature: nome, titulo: tituloDeArquivo(nome) || nome, modulo: pasta.replace(/_/g, ' '), pasta, relativo: e.relativo,
      narrativaHtml: '', filhos: [], removidos: [], citadas: [], fonte: e.fonte, apoio: false, erroSintaxe: { linha: e.linha, mensagem: e.mensagem },
    });
  }
  paginas.sort((x, y) => (x.relativo < y.relativo ? -1 : x.relativo > y.relativo ? 1 : 0));

  // Prévias das referências (FA-05).
  const previas: Record<string, Previa> = {};
  for (const r of p.indice.referencias) {
    const f = filhoDoc(ctx, r.arquivo, r.filho);
    previas[r.endereco] = { titulo: r.filho.titulo, html: htmlDoFilho(f), href: o.modo === 'pasta' ? `${arquivoDaPagina(r.arquivo.endereco)}#c-${r.posicao}` : rotaFuncionalidade(r.arquivo.endereco, r.posicao) };
  }

  // Busca (6.7).
  const busca: DocBusca[] = [];
  for (const a of p.arquivos) {
    const titulo = tituloDeArquivo(a.nome) || a.nome;
    busca.push({ id: a.endereco, tipo: 'funcionalidade', titulo, caminho: a.pasta.replace(/_/g, ' '), texto: textoPuro(a.descricao).slice(0, 2000), destino: `!/f/${a.endereco}` });
    for (const f of a.filhos) {
      const c = chaveCodigo(f.titulo);
      busca.push({
        id: `${a.endereco}/${f.posicao}`, tipo: c && ehArquivoDeApoio(a, p.config) ? TIPO_BUSCA[c.tipo]! : 'cenario', titulo: f.titulo, caminho: titulo,
        texto: textoDoFilhoParaBusca(f), destino: `!/f/${a.endereco}/c/${f.posicao}`, codigo: c && ehArquivoDeApoio(a, p.config) ? c.chave : undefined,
      });
    }
  }

  // Matriz (6.4).
  const comTela = paginas.filter((x) => !x.apoio && !x.erroSintaxe);
  const codigos = [...p.indice.referencias].sort((a, b) => ordemTipo(a.tipo) - ordemTipo(b.tipo) || (a.chave < b.chave ? -1 : 1));
  const marcas: [number, number][] = [];
  comTela.forEach((pg, i) => {
    const citados = new Set(pg.citadas.map((c) => c.previa));
    codigos.forEach((r, j) => citados.has(r.endereco) && marcas.push([i, j]));
  });

  const rotas: Documentacao['rotas'] = {};
  for (const pg of paginas) rotas[pg.endereco.normalize('NFC')] = { arquivo: pg.arquivo, filhos: pg.filhos.map((f) => f.posicao) };

  const contar = (t: string) => p.indice.referencias.filter((r) => r.tipo === t).length;
  return {
    modo: o.modo,
    projeto: { nome: p.config.projeto.nome, versao: p.config.projeto.versao, orgao: p.config.projeto.orgao, logo: p.config.projeto.logo },
    arvore: arvore(paginas),
    paginas,
    matriz: {
      telas: comTela.map((x) => ({ endereco: x.endereco, titulo: x.titulo, arquivo: x.arquivo })),
      codigos: codigos.map((r) => ({ codigo: r.codigo, tipo: r.tipo, titulo: r.titulo, previa: r.endereco })),
      marcas,
    },
    achados: (o.achados ?? []).filter((x) => x.severidade !== 'info').map((x) => {
      const pg = paginas.find((y) => y.relativo === x.arquivo);
      const f = pg && x.linha ? filhoDaLinha(porEndereco.get(pg.endereco.normalize('NFC'))!, x.linha) : undefined;
      return { ...x, href: pg ? (o.modo === 'pasta' ? `f/${pg.arquivo}${f ? `#c-${f.posicao}` : ''}` : rotaFuncionalidade(pg.endereco, f?.posicao)) : undefined };
    }),
    numeros: {
      funcionalidades: paginas.filter((x) => !x.apoio).length,
      telas: p.modelo.telas.length,
      cenarios: p.arquivos.filter((a) => !ehArquivoDeApoio(a, p.config)).reduce((s, a) => s + a.filhos.filter((f) => f.tipo !== 'Contexto').length, 0),
      regras: contar('RNG'),
      listas: contar('LOV'),
      mensagens: contar('MSG') + contar('EMAIL'),
    },
    comparacao: o.comparacao && {
      versao: o.comparacao.versao,
      novas: [...o.comparacao.paginas].filter(([, m]) => m.situacao === 'nova').map(([e]) => e),
      alteradas: [...o.comparacao.paginas].filter(([, m]) => m.situacao === 'alterada').map(([e]) => e),
      removidas: o.comparacao.removidas.map((r) => ({ endereco: r.endereco, titulo: tituloDeArquivo(r.nome) || r.nome })),
      renomeadas: o.comparacao.renomeadas,
    },
    busca,
    previas,
    rotas,
    imagens: ctx.imagens,
  };
}

function ordemTipo(t: string) {
  return ['RNG', 'LOV', 'MSG', 'EMAIL'].indexOf(t);
}

export function rotuloEstado(id: string): string {
  if (id === 'padrao') return 'Padrão';
  if (id === 'vazio') return 'Vazio';
  const m = /^(erro|sucesso|aviso|sem-permissao)-(\d+)$/.exec(id);
  if (!m) return id;
  const nome = { erro: 'Erro', sucesso: 'Sucesso', aviso: 'Aviso', 'sem-permissao': 'Sem permissão' }[m[1] as 'erro'];
  return `${nome} (cenário ${m[2]})`;
}

/** HTML de um filho para a prévia (o mesmo corpo da página, sem o título). */
export function htmlDoFilho(f: FilhoDoc): string {
  const tabela = (t: TabelaDoc) =>
    `<div class="tabela" role="region" tabindex="0"><table><thead><tr>${t.cabecalho.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${t.linhas.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const passos = f.passos.map((p) => `<p class="passo"><span class="palavra">${escapar(p.palavra)}</span> ${p.html}</p>${p.tabela ? tabela(p.tabela) : ''}`).join('');
  return `${f.descricaoHtml}${passos}${f.exemplos.map((t) => `<p class="palavra">Exemplos</p>${tabela(t)}`).join('')}`;
}
