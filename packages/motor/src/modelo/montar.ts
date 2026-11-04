import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Achado, ConfigProjeto } from '../config/esquema.js';
import type { OverrideTela, Overrides } from '../config/overrides.js';
import { chaveCodigo, type Indice } from '../parser/indice.js';
import { extrairLinks } from '../parser/links.js';
import type { ArquivoFeature, Filho, Tabela } from '../parser/tipos.js';
import { acoesDaTela } from '../inferencia/acoes.js';
import { decidirComponente } from '../inferencia/campos.js';
import { estadosDaTela, exemplosDoFilho } from '../inferencia/estados.js';
import { mesmoTexto, normalizar, slug, textoPuro, tituloDeArquivo } from '../util/texto.js';
import { VERSAO_MODELO } from '../versao.js';
import {
  COMPONENTES, LAYOUTS,
  type Campo, type Componente, type Layout, type ModeloTelas, type RefCitada, type ReferenciaModelo, type Sinal, type Tela,
} from './tipos.js';

export interface EntradaModelo {
  arquivos: ArquivoFeature[];
  indice: Indice;
  config: ConfigProjeto;
  overrides: Overrides;
  specs: string;
}

/** Arquivos de apoio (regras, mensagens) não viram tela. */
export function ehArquivoDeApoio(a: ArquivoFeature, config: ConfigProjeto): boolean {
  const pastas = [...config.referencias.regras, ...config.referencias.mensagens].map(normalizar);
  return pastas.includes(normalizar(a.pasta));
}

export function filhoPrototipo(a: ArquivoFeature): Filho | undefined {
  return a.filhos.find((f) => f.tags.includes('@prototipo'));
}

type TipoTabela = 'definicao' | 'exemplo' | 'outra';

/** RN-06/RN-07: tabela de definição (Campo + Editável/Obrigatório/Regras), de exemplo (Campo + Exemplo) ou outra. */
export function classificarTabela(t: Tabela): TipoTabela {
  const cab = t.cabecalho.map((h) => normalizar(h));
  if (!cab.includes('campo')) return 'outra';
  if (cab.some((h) => ['editavel', 'obrigatorio', 'regras', 'regra'].includes(h))) return 'definicao';
  if (cab.some((h) => h === 'exemplo' || h === 'valor')) return 'exemplo';
  return 'outra';
}

/** Nome do grupo: último `<Parâmetro>` do texto do passo; sem parâmetro, "Campos". */
export function grupoDoPasso(texto: string): string {
  const todos = [...texto.matchAll(/<([^<>]{1,40})>/g)].map((m) => m[1]!.trim());
  return todos[todos.length - 1] ?? 'Campos';
}

const simNao = (v: string | undefined) => /^s(im)?$/i.test((v ?? '').trim());

interface CampoBruto {
  nome: string;
  grupo: string;
  editavel: boolean;
  obrigatorio: boolean;
  regras: RefCitada[];
  regraTexto?: string;
  secao?: string;
  origem: { arquivo: string; linha: number };
}

function camposDasTabelas(a: ArquivoFeature): { brutos: CampoBruto[]; dados: Tela['dados'] } {
  const porChave = new Map<string, CampoBruto>();
  const dados: Tela['dados'] = [];
  for (const f of a.filhos) {
    let secaoAtual: string | undefined;
    for (const p of f.passos) {
      const limite = p.tabela?.linha ?? p.linha;
      const anot = f.anotacoes.filter((x) => normalizar(x.chave) === 'secao' && x.linha < limite).pop();
      secaoAtual = anot?.valor ?? secaoAtual;
      const t = p.tabela;
      if (!t) continue;
      const tipo = classificarTabela(t);
      const grupo = grupoDoPasso(p.texto);
      if (tipo === 'outra') {
        if (!f.tags.includes('@prototipo')) dados.push({ titulo: grupo, cabecalho: t.cabecalho, linhas: t.linhas.map((l) => l.celulas) });
        continue;
      }
      if (tipo !== 'definicao') continue;
      const idx = (re: RegExp) => t.cabecalho.findIndex((h) => re.test(normalizar(h)));
      const iCampo = idx(/^campo$/);
      const iEd = idx(/^editavel$/);
      const iOb = idx(/^obrigatorio$/);
      const iRe = idx(/^regras?$/);
      for (const l of t.linhas) {
        const nome = textoPuro(l.celulas[iCampo] ?? '');
        if (!nome) continue;
        const chave = `${normalizar(grupo)}|${normalizar(nome)}`;
        const celRegra = iRe >= 0 ? (l.celulas[iRe] ?? '') : '';
        const origem = { arquivo: a.relativo, linha: l.linha };
        const regras: RefCitada[] = extrairLinks(celRegra, origem).map((lk) => ({
          codigo: chaveCodigo(lk.rotulo)?.chave,
          rotulo: lk.rotulo,
          destino: lk.posicao !== undefined ? `${lk.endereco}/${lk.posicao}` : lk.endereco,
          origem,
        }));
        const semLinks = celRegra.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/[,;]/g, ' ').trim();
        const regraTexto = semLinks && semLinks !== '-' ? textoPuro(semLinks) : undefined;
        const existente = porChave.get(chave);
        if (existente) {
          if (!existente.regras.length && regras.length) existente.regras = regras;
          existente.regraTexto ??= regraTexto;
          continue;
        }
        porChave.set(chave, {
          nome, grupo, origem, regras, regraTexto, secao: secaoAtual,
          editavel: iEd >= 0 ? simNao(l.celulas[iEd]) : false,
          obrigatorio: iOb >= 0 ? simNao(l.celulas[iOb]) : false,
        });
      }
    }
  }
  return { brutos: [...porChave.values()], dados };
}

function narrativa(descricao: string): Tela['narrativa'] {
  const t = textoPuro(descricao);
  const m = /COMO\s+(.*?)\s+QUERO\s+(.*?)\s+PARA\s+(.*)$/i.exec(t.replace(/-{3,}/g, ' '));
  return m ? { como: m[1]!.trim(), quero: m[2]!.trim(), para: m[3]!.trim() } : undefined;
}

function decidirLayout(a: ArquivoFeature, tipo: Tela['tipo'], brutos: CampoBruto[], sinais: Sinal[]): Layout {
  const anot = a.metadados['Tela']?.valor;
  const origem = { arquivo: a.relativo, linha: a.metadados['Tela']?.linha ?? a.linha };
  if (anot && (LAYOUTS as readonly string[]).includes(anot)) {
    sinais.push({ regra: 'anotacao', descricao: `# Tela: ${anot}`, origem });
    return anot as Layout;
  }
  const grupos = new Set(brutos.map((b) => normalizar(b.grupo)));
  if (tipo === 'Integração') {
    sinais.push({ regra: 'RN-12', descricao: 'Tipo: Integração → página de referência da API', origem });
    return 'api';
  }
  if (tipo === 'Consulta' && grupos.has('filtros')) {
    sinais.push({ regra: 'RN-10', descricao: 'Tipo: Consulta com <Filtros> → listagem com filtros e tabela', origem });
    return 'listagem';
  }
  const editaveis = brutos.some((b) => b.editavel && normalizar(b.grupo) !== 'filtros');
  if (grupos.has('blocos') && editaveis) {
    sinais.push({ regra: 'RN-11', descricao: '<Blocos> com campos editáveis → formulário em etapas', origem });
    return 'formulario-etapas';
  }
  if (tipo === 'Manual' || editaveis) {
    sinais.push({ regra: 'RN-11', descricao: `${tipo === 'Manual' ? 'Tipo: Manual' : 'campos editáveis'} → formulário`, origem });
    return 'formulario';
  }
  if (tipo === 'Consulta') {
    sinais.push({ regra: 'RN-10', descricao: 'Tipo: Consulta sem filtros → leitura', origem });
    return 'leitura';
  }
  sinais.push({ regra: 'padrao', descricao: 'sem Tipo nem campos editáveis → leitura', origem });
  return 'leitura';
}

function api(a: ArquivoFeature): Tela['api'] {
  const textos = [a.metadados['Fluxo']?.valor ?? '', ...a.filhos.flatMap((f) => f.passos.map((p) => p.texto))].join('\n');
  const m = /\*{0,2}(GET|POST|PUT|PATCH|DELETE)\*{0,2}[^"\n/]*"?([/][^"\s]*)"?/i.exec(textos);
  const caminho = m?.[2] ?? /(\/[a-z0-9_{}/-]+)/i.exec(textos)?.[1];
  const exemplos = a.filhos
    .filter((f) => f.tipo !== 'Contexto' && !f.tags.includes('@prototipo'))
    .map((f) => ({ titulo: f.titulo, valores: exemplosDoFilho(f) }))
    .filter((x) => Object.keys(x.valores).length);
  return caminho ? { metodo: (m?.[1] ?? 'GET').toUpperCase(), caminho, exemplos } : undefined;
}

/** Monta o modelo de telas a partir das features, com inferência e overrides (seção 6 do desenho). */
export function montarModelo(e: EntradaModelo): { modelo: ModeloTelas; achados: Achado[] } {
  const { arquivos, indice, config, overrides } = e;
  const achados: Achado[] = [];
  const telasArquivos = arquivos.filter((a) => !ehArquivoDeApoio(a, config));
  const telas: Tela[] = [];

  for (const a of telasArquivos) {
    const proto = filhoPrototipo(a);
    if (!proto) continue;
    const sinais: Sinal[] = [];
    const tipoBruto = a.metadados['Tipo']?.valor;
    const tipo = (['Consulta', 'Manual', 'Integração'] as const).find((t) => mesmoTexto(t, tipoBruto ?? '')) ?? null;
    const { brutos, dados } = camposDasTabelas(a);
    const ov: OverrideTela = overrides.telas[a.nome] ?? {};
    let layout = decidirLayout(a, tipo, brutos, sinais);
    if (ov.layout) {
      if ((LAYOUTS as readonly string[]).includes(ov.layout)) {
        layout = ov.layout as Layout;
        sinais.push({ regra: 'override', descricao: `layout: ${ov.layout}` });
      } else {
        achados.push(avisoOverride(overrides, [a.nome, 'layout'], `Layout "${ov.layout}" desconhecido; use ${LAYOUTS.join(', ')}.`));
      }
    }

    const principal = a.filhos.find((f) => f.tags.includes('@fluxo-principal'));
    const exemplos = principal ? exemplosDoFilho(principal) : {};
    const outrosExemplos = Object.assign({}, ...a.filhos.map(exemplosDoFilho)) as Record<string, string>;
    const ids = new Set<string>();
    const campos: Campo[] = brutos.map((b) => {
      let id = slug(b.nome);
      for (let i = 2; ids.has(id); i++) id = `${slug(b.nome)}-${i}`;
      ids.add(id);
      const decisao = decidirComponente(b, indice, config);
      const sinaisCampo: Sinal[] = [];
      let componente: Componente = 'texto';
      if (decisao) {
        componente = decisao.componente;
        sinaisCampo.push(decisao.sinal);
      } else if (b.editavel) {
        sinaisCampo.push({ regra: 'FA-07', descricao: 'nenhuma regra de inferência resolveu → texto simples', origem: b.origem });
        achados.push({ severidade: 'info', codigo: 'inferencia/sem-regra', arquivo: b.origem.arquivo, linha: b.origem.linha, mensagem: `Campo "${b.nome}" virou texto simples: nenhuma regra de inferência se aplica.` });
      }
      const exemplo = Object.entries(exemplos).find(([k]) => mesmoTexto(k, b.nome))?.[1] ??
        Object.entries(outrosExemplos).find(([k]) => mesmoTexto(k, b.nome))?.[1];
      return {
        id, nome: b.nome, rotulo: b.nome, grupo: b.grupo, editavel: b.editavel, obrigatorio: b.obrigatorio,
        regras: b.regras, regraTexto: b.regraTexto, componente, mascara: decisao?.mascara,
        opcoes: decisao?.opcoes, exemplo, secao: b.secao, sinais: sinaisCampo, origem: b.origem,
      };
    });

    // Confirmação ligada ao campo de mesmo nome sem o prefixo (RN-16).
    for (const c of campos.filter((x) => x.componente === 'confirmacao')) {
      const base = c.nome.replace(/^(confirme|confirma[çc][ãa]o de|confirmar)\s+(o|a|do|da)?\s*/i, '');
      const alvo = campos.find((x) => x !== c && mesmoTexto(x.nome, base));
      if (alvo) {
        c.confirma = alvo.id;
        if (alvo.componente === 'email' || alvo.mascara) {
          c.mascara = alvo.mascara;
        }
      }
    }

    // Campo sem regra cujo nome é o de uma LOV ("Situação" ↔ "LOV-01 - Situação") usa as opções dela.
    for (const c of campos) {
      if (c.opcoes?.length || c.regras.some((r) => r.codigo?.startsWith('LOV-'))) continue;
      const lov = indice.referencias.find((r) => r.tipo === 'LOV' && r.opcoes?.length && mesmoTexto(r.titulo, c.nome));
      if (!lov) continue;
      c.opcoes = lov.opcoes;
      if (c.editavel && ['texto', 'leitura'].includes(c.componente)) c.componente = 'selecao';
      c.sinais.push({ regra: 'RN-14', descricao: `nome igual ao da ${lov.codigo} → opções da lista`, origem: c.origem });
    }

    aplicarOverridesCampos(campos, ov, a.nome, overrides, achados);
    if (ov.ordem) campos.sort((x, y) => ordemDe(ov.ordem!, x.nome) - ordemDe(ov.ordem!, y.nome));

    // Distribuição dos grupos (desenho, seção 6, passo 2).
    const filtros: Campo[] = [];
    const formulario: Campo[] = [];
    const colunas: Campo[] = [];
    const g = (c: Campo) => normalizar(c.grupo);
    const deCampos = campos.filter((c) => g(c) === 'campos');
    // Listagem: <Campos> só leitura são colunas. Consulta sem filtros: só vira tabela com 2+ colunas.
    const camposSoLeitura = deCampos.every((c) => !c.editavel) && (layout === 'listagem' || deCampos.length >= 2);
    for (const c of campos) {
      if (g(c) === 'filtros') filtros.push(c);
      else if (g(c) === 'colunas') colunas.push(c);
      else if (g(c) === 'campos' && camposSoLeitura && (layout === 'listagem' || (layout === 'leitura' && tipo === 'Consulta'))) colunas.push(c);
      else formulario.push(c);
    }
    if (colunas.some((c) => g(c) === 'campos')) {
      sinais.push({ regra: 'RN-10', descricao: `<Campos> só leitura ${layout === 'listagem' ? 'numa listagem' : 'numa consulta'} → colunas da tabela` });
    }

    const secoes = ov.secoes ?? secoesInferidas(formulario);
    const acoes = acoesDaTela(a, telasArquivos);
    if (ov.acoes) {
      acoes.splice(0, acoes.length, ...ov.acoes.map((x, i) => ({
        id: slug(x.rotulo), rotulo: x.rotulo, primaria: x.primaria ?? i === 0, destino: x.destino,
        origem: { arquivo: overrides.arquivo, linha: overrides.linhaDe([a.nome, 'acoes']) ?? 1 },
      })));
      sinais.push({ regra: 'override', descricao: 'acoes definidas no override' });
    }
    if (layout === 'listagem') {
      if (!acoes.some((x) => mesmoTexto(x.rotulo, 'Filtrar'))) acoes.unshift({ id: 'filtrar', rotulo: 'Filtrar', primaria: !acoes.some((x) => x.primaria), origem: { arquivo: a.relativo, linha: a.linha } });
      if (!acoes.some((x) => mesmoTexto(x.rotulo, 'Limpar'))) acoes.push({ id: 'limpar', rotulo: 'Limpar', primaria: false, origem: { arquivo: a.relativo, linha: a.linha } });
    }

    const modulo = a.pasta;
    const cfgModulo = config.modulos[modulo] ?? {};
    const perfil = ov.perfil ?? a.metadados['Perfil']?.valor ?? cfgModulo.perfil ?? null;
    const casca = ov.casca ?? cfgModulo.casca ?? (perfil ? 'autenticada' : 'publica');

    const imagem = a.imagens.find((i) => i.origem.linha >= proto.linha)?.alvo;
    const htmlProprio = path.join(path.dirname(a.caminho), `${a.nome}.html`);
    const tituloProto = textoPuro(proto.descricao.split('\n').find((l) => /\*\*/.test(l)) ?? '');

    telas.push({
      id: a.nome,
      endereco: a.endereco,
      modulo,
      titulo: tituloProto || tituloDeArquivo(a.titulo || a.nome),
      tipo,
      layout,
      casca,
      perfil,
      fluxo: a.metadados['Fluxo']?.valor,
      narrativa: narrativa(a.descricao),
      filtros,
      campos: formulario,
      colunas,
      secoes,
      dados,
      acoes,
      estados: estadosDaTela(a, layout, [...filtros, ...formulario], indice, config),
      api: layout === 'api' ? api(a) : undefined,
      prototipo: {
        imagem,
        html: existsSync(htmlProprio) ? `${a.nome}.html` : undefined,
        titulo: tituloProto || undefined,
        origem: { arquivo: a.relativo, linha: proto.linha },
      },
      sinais,
      origem: { arquivo: a.relativo, linha: a.linha },
    });
  }

  for (const id of Object.keys(overrides.telas)) {
    if (!telas.some((t) => t.id === id)) achados.push(avisoOverride(overrides, [id], `Override para a tela "${id}", que não existe.`));
  }

  return {
    modelo: { versaoModelo: VERSAO_MODELO, projeto: { nome: config.projeto.nome, versao: config.projeto.versao }, telas, referencias: referencias(arquivos, indice) },
    achados,
  };
}

function ordemDe(ordem: string[], nome: string): number {
  const i = ordem.findIndex((o) => mesmoTexto(o, nome));
  return i < 0 ? ordem.length : i;
}

function secoesInferidas(campos: Campo[]): Tela['secoes'] {
  const secoes: Tela['secoes'] = [];
  for (const c of campos) {
    if (!c.secao) continue;
    let s = secoes.find((x) => x.titulo === c.secao);
    if (!s) secoes.push((s = { titulo: c.secao, campos: [] }));
    s.campos.push(c.id);
  }
  return secoes;
}

function avisoOverride(o: Overrides, caminho: string[], mensagem: string): Achado {
  return { severidade: 'aviso', codigo: 'override/campo-inexistente', arquivo: o.arquivo, linha: o.linhaDe(caminho), mensagem };
}

function aplicarOverridesCampos(campos: Campo[], ov: OverrideTela, tela: string, overrides: Overrides, achados: Achado[]) {
  for (const [nome, oc] of Object.entries(ov.campos ?? {})) {
    const c = campos.find((x) => mesmoTexto(x.nome, nome) || x.id === nome);
    if (!c) {
      achados.push(avisoOverride(overrides, [tela, 'campos', nome], `Override do campo "${nome}", que não existe na tela ${tela}.`));
      continue;
    }
    if (oc.componente) {
      if ((COMPONENTES as readonly string[]).includes(oc.componente)) {
        c.componente = oc.componente as Componente;
        c.sinais.push({ regra: 'override', descricao: `componente: ${oc.componente}` });
      } else {
        achados.push(avisoOverride(overrides, [tela, 'campos', nome, 'componente'], `Componente "${oc.componente}" desconhecido.`));
      }
    }
    if (oc.largura) c.largura = oc.largura;
    if (oc.rotulo) c.rotulo = oc.rotulo;
    if (oc.ajuda) c.ajuda = oc.ajuda;
    if (oc.opcoes) c.opcoes = oc.opcoes;
    if (oc.secao) c.secao = oc.secao;
  }
}

/** Referências com "usada em" (rastreabilidade, base da fase 2). */
function referencias(arquivos: ArquivoFeature[], indice: Indice): ReferenciaModelo[] {
  const usos = new Map<string, { arquivo: string; linha: number }[]>();
  for (const a of arquivos) {
    for (const l of a.links) {
      if (l.tipo !== 'cenario' || l.posicao === undefined) continue;
      const end = `${l.endereco}/${l.posicao}`;
      const lista = usos.get(end) ?? [];
      lista.push({ arquivo: l.origem.arquivo, linha: l.origem.linha });
      usos.set(end, lista);
    }
  }
  return indice.referencias.map((r) => ({
    codigo: r.codigo,
    tipo: r.tipo,
    titulo: r.titulo,
    endereco: r.endereco,
    origem: r.origem,
    usadaEm: usos.get(r.endereco) ?? [],
    opcoes: r.opcoes,
    texto: r.texto,
  }));
}
