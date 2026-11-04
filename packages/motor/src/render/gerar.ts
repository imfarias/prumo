import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import type { Achado, ConfigProjeto } from '../config/esquema.js';
import { criarGerador, valorFicticio, type Gerador } from '../dados/ficticios.js';
import { listaDeMascaras } from '../dados/mascara.js';
import type { Campo, Estado, ModeloTelas, Tela } from '../modelo/tipos.js';
import { dentroDe } from '../util/caminhos.js';
import { mesmoTexto, normalizar, slug, tituloDeArquivo } from '../util/texto.js';
import { gravarRecursos, gravarSeMudou } from './recursos.js';

export interface PaginaGerada {
  tela: string;
  estado: string;
  arquivo: string; // absoluto
  destinoPng?: string; // absoluto, só no estado padrão
}

export interface Recorte {
  modulos?: string[];
  telas?: string[];
}

export function dentroDoRecorte(t: Tela, r?: Recorte): boolean {
  if (r?.modulos?.length && !r.modulos.some((m) => mesmoTexto(m, t.modulo))) return false;
  if (r?.telas?.length && !r.telas.some((x) => mesmoTexto(x, t.id))) return false;
  return true;
}

const KITS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../kits');

export function diretorioDoKit(config: ConfigProjeto, achados: Achado[], arquivo: string): string {
  if (config.identidade.design_system === 'govbr') {
    achados.push({ severidade: 'aviso', codigo: 'identidade/kit', arquivo, mensagem: 'O kit govbr chega na fase 4; usando o kit proprio com os tokens do projeto.' });
  }
  return path.join(KITS, 'proprio');
}

const seg = (s: string) => encodeURIComponent(s);
const hrefTela = (t: { modulo: string; id: string }, estado = 'padrao') => `../../${seg(t.modulo)}/${seg(t.id)}/${seg(estado)}.html`;

const LARGURAS: Record<string, string> = { '1/4': 'c3', '1/3': 'c4', '1/2': 'c6', '2/3': 'c8', '3/4': 'c9', '1/1': 'c12' };

function classeLargura(c: Campo, filtro: boolean): string {
  if (c.largura && LARGURAS[c.largura]) return LARGURAS[c.largura]!;
  if (['texto-longo', 'caixa', 'arquivos', 'captcha'].includes(c.componente)) return 'c12';
  if (filtro) return 'c4';
  if (['mascara', 'tel', 'data', 'valor', 'numero', 'senha'].includes(c.componente)) return 'c4';
  return 'c6';
}

function placeholderDaMascara(c: Campo): string | undefined {
  if (c.componente === 'data') return 'dd/mm/aaaa';
  if (!c.mascara) return undefined;
  return listaDeMascaras(c.mascara)[0]!.replace(/[#X]/g, '0').replace(/A/g, 'A');
}

const TIPO_INPUT: Record<string, string> = { email: 'email', tel: 'tel', senha: 'password', numero: 'text', valor: 'text', data: 'text', confirmacao: 'text' };
const AUTOCOMPLETE: Record<string, string> = { email: 'email', tel: 'tel', senha: 'current-password', captcha: 'off' };

function valorDe(c: Campo, e: Estado): string | undefined {
  const ex = Object.entries(e.exemplos).find(([k]) => mesmoTexto(k, c.nome));
  return ex?.[1] ?? c.exemplo;
}

interface CampoVM {
  id: string; testid: string; rotulo: string; componente: string; valor: string; obrigatorio: boolean;
  classe: string; opcoes?: string[]; placeholder?: string; tipoInput: string; autocomplete?: string;
  erro?: string; ajuda?: string; texto?: string; marcada?: boolean; desafio?: string; itens?: { nome: string }[];
}

function campoVM(c: Campo, tela: Tela, e: Estado, g: Gerador, filtro: boolean, todos: Campo[]): CampoVM {
  const ts = slug(tela.id);
  const id = `${ts}-${c.id}`;
  const prefixo = c.componente === 'leitura' ? 'valor' : c.componente === 'selecao' ? 'selecao' : 'campo';
  let valor = valorDe(c, e) ?? '';
  if (!valor && !filtro && c.componente !== 'caixa' && c.componente !== 'captcha' && c.componente !== 'arquivos') {
    valor = c.componente === 'senha' ? 'senha-exemplo' : valorFicticio(c.nome, g, tela.titulo);
  }
  let opcoes = c.opcoes;
  if (c.componente === 'selecao') {
    opcoes = opcoes?.length ? [...opcoes] : ['Opção 1 Exemplo', 'Opção 2 Exemplo', 'Opção 3 Exemplo'];
    if (valor && !opcoes.includes(valor)) opcoes.unshift(valor);
    if (!valor && !filtro) valor = opcoes[0]!;
  }
  if (c.componente === 'confirmacao' && c.confirma) {
    const alvo = todos.find((x) => x.id === c.confirma);
    if (alvo) valor = valorDe(alvo, e) ?? valor;
  }
  const alvoConfirmado = c.confirma ? todos.find((x) => x.id === c.confirma) : undefined;
  const erro = e.mensagem?.local === 'campo' && e.mensagem.campo === c.id ? e.mensagem.texto : undefined;
  return {
    id,
    testid: `${ts}-${prefixo}-${c.id}`,
    rotulo: c.rotulo,
    componente: c.componente === 'confirmacao' ? 'texto' : c.componente,
    valor,
    obrigatorio: c.obrigatorio && c.componente !== 'leitura',
    classe: classeLargura(c, filtro),
    opcoes,
    placeholder: placeholderDaMascara(c),
    tipoInput: TIPO_INPUT[c.componente] ?? (alvoConfirmado?.componente === 'email' ? 'email' : 'text'),
    autocomplete: AUTOCOMPLETE[c.componente] ?? (alvoConfirmado?.componente === 'email' ? 'email' : undefined),
    erro,
    ajuda: c.ajuda,
    texto: c.componente === 'caixa' ? (c.regraTexto ?? c.rotulo) : undefined,
    marcada: c.componente === 'caixa' && e.tipo !== 'erro',
    desafio: c.componente === 'captcha' ? 'K7Q2PX' : undefined,
    itens: c.componente === 'arquivos' ? (c.opcoes?.length ? c.opcoes : ['Documento 1 Exemplo', 'Documento 2 Exemplo']).map((nome) => ({ nome })) : undefined,
  };
}

/** Ações que agem sobre um registro (vão para a coluna "Ações" da tabela, não para a barra). */
const RE_ACAO_DE_LINHA = /^(analisar|visualizar|ver|editar|alterar|excluir|remover|ativar|desativar|inativar|detalhar|abrir|gerenciar|acessar)\b/;
const ehColunaAcoes = (c: Campo) => /^a[cç](o|õ)es?$/.test(normalizar(c.nome).replace(/[^a-z]/g, '')) || /^acoes?$/.test(normalizar(c.nome));

type Celula = string | { acoes: { rotulo: string; href?: string }[] };

function acoesDeLinha(tela: Tela, telas: Tela[]) {
  return tela.acoes
    .filter((a) => RE_ACAO_DE_LINHA.test(normalizar(a.rotulo)))
    .map((a) => {
      const destino = a.destino ? telas.find((t) => t.id === a.destino) : undefined;
      return { id: a.id, rotulo: a.rotulo, href: destino ? hrefTela(destino) : '#' };
    });
}

function linhasDaTabela(tela: Tela, e: Estado, config: ConfigProjeto, colunas: Campo[], telas: Tela[]): Celula[][] {
  const vazio = e.tipo === 'vazio' || e.tipo === 'aviso' || e.tipo === 'sem-permissao';
  if (vazio) return [];
  const n = Math.min(config.padroes.paginacao, 5);
  const linhas: Celula[][] = [];
  const deLinha = acoesDeLinha(tela, telas);
  for (let i = 0; i < n; i++) {
    linhas.push(colunas.map((col): Celula => {
      if (ehColunaAcoes(col)) return { acoes: deLinha.length ? deLinha : [{ rotulo: 'Visualizar', href: '#' }] };
      const filtro = tela.filtros.find((f) => mesmoTexto(f.nome, col.nome));
      if (i === 0) {
        const ex = valorDe(col, e) ?? (filtro ? valorDe(filtro, e) : undefined);
        if (ex) return ex;
      }
      const opcoes = filtro?.opcoes ?? col.opcoes;
      if (opcoes?.length) return opcoes[i % opcoes.length]!;
      return valorFicticio(col.nome, criarGerador(`${tela.id}|${col.id}|${i}`, geradorOpcoes(config)), tela.titulo);
    }));
  }
  return linhas;
}

function geradorOpcoes(config: ConfigProjeto) {
  return { cnpj: config.dados_ficticios.cnpj, sufixo: config.dados_ficticios.sufixo_nomes, mascaras: config.mascaras };
}

const ICONE_ACAO: [RegExp, string][] = [[/^filtrar|pesquisar|buscar|consultar/, 'lupa'], [/^enviar/, 'enviar']];

function acoesVM(tela: Tela, telas: Tela[], filtro: boolean) {
  const ts = slug(tela.id);
  const doFiltro = (a: Tela['acoes'][number]) => ['filtrar', 'limpar', 'pesquisar'].includes(a.id);
  const temColunaAcoes = tela.colunas.some(ehColunaAcoes);
  return tela.acoes
    .filter((a) => (tela.layout === 'listagem' ? doFiltro(a) === filtro : !filtro))
    .filter((a) => !(temColunaAcoes && RE_ACAO_DE_LINHA.test(normalizar(a.rotulo))))
    .map((a) => {
      const destino = a.destino ? telas.find((t) => t.id === a.destino) : undefined;
      return {
        rotulo: a.rotulo,
        primaria: a.primaria,
        href: destino ? hrefTela(destino) : undefined,
        testid: `${ts}-acao-${a.id}`,
        icone: ICONE_ACAO.find(([re]) => re.test(normalizar(a.rotulo)))?.[1],
      };
    });
}

function mensagemTopo(e: Estado) {
  if (e.tipo === 'sem-permissao') return { classe: 'erro', icone: 'alerta', texto: e.mensagem?.texto ?? 'Acesso não permitido.' };
  if (!e.mensagem || e.mensagem.local === 'campo') return undefined;
  const mapa = { erro: ['erro', 'alerta'], sucesso: ['sucesso', 'visto'], aviso: ['aviso-atencao', 'info'] } as const;
  const [classe, icone] = mapa[e.tipo as keyof typeof mapa] ?? ['erro', 'alerta'];
  return { classe, icone, texto: e.mensagem.texto };
}

function menuDoPerfil(tela: Tela, telas: Tela[], config: ConfigProjeto) {
  const itens = tela.perfil ? config.perfis[tela.perfil] ?? [] : [];
  return itens.map((rotulo) => {
    const destino = telas.find((t) => mesmoTexto(t.titulo, rotulo) || mesmoTexto(tituloDeArquivo(t.id), rotulo));
    return { rotulo, atual: destino?.id === tela.id || mesmoTexto(rotulo, tela.titulo), href: destino ? hrefTela(destino) : '#' };
  });
}

function tabelaDados(d: Tela['dados'][number], i: number) {
  return { id: `dados-${i + 1}`, legenda: d.titulo, colunas: d.cabecalho.map((rotulo) => ({ rotulo })), linhas: d.linhas.map((l) => l.map((v) => v.replace(/[*`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))) };
}

export function contextoDaPagina(tela: Tela, e: Estado, modelo: ModeloTelas, config: ConfigProjeto, recursos: { logo?: string; cssAdicional?: string }) {
  const g = criarGerador(`${tela.id}|${e.id}`, geradorOpcoes(config));
  const gFixo = criarGerador(tela.id, geradorOpcoes(config));
  const ts = slug(tela.id);
  const todos = [...tela.filtros, ...tela.campos];
  const filtros = tela.filtros.map((c) => campoVM(c, tela, e, criarGerador(`${tela.id}|${c.id}`, geradorOpcoes(config)), true, todos));
  const campos = tela.campos.map((c) => campoVM(c, tela, e, criarGerador(`${tela.id}|${c.id}`, geradorOpcoes(config)), false, todos));
  const secoes = tela.secoes.map((s) => ({ id: slug(s.titulo), titulo: s.titulo, campos: campos.filter((c) => s.campos.includes(c.id.slice(ts.length + 1))) }));
  const comSecao = new Set(secoes.flatMap((s) => s.campos.map((c) => c.id)));
  const semSecao = campos.filter((c) => !comSecao.has(c.id));
  const leitura = tela.layout === 'leitura' ? semSecao.filter((c) => c.componente === 'leitura') : [];
  const colunas = tela.colunas.map((c) => ({ id: c.id, rotulo: c.rotulo, numerico: ['mascara', 'data', 'valor', 'numero', 'tel'].includes(c.componente) || /cnpj|cpf|data|total|quantidade/i.test(normalizar(c.nome)) }));
  const linhas = linhasDaTabela(tela, e, config, tela.colunas, modelo.telas);
  const total = linhas.length ? linhas.length * 3 + 2 : 0;
  const msgAviso = tela.estados.find((x) => x.tipo === 'aviso')?.mensagem?.texto;
  const resumoErros = campos.concat(filtros).filter((c) => c.erro).map((c) => ({ id: c.id, rotulo: c.rotulo, texto: c.erro! }));
  void g;

  const telas = modelo.telas;
  return {
    projeto: { nome: config.projeto.nome, versao: config.projeto.versao, orgao: config.projeto.orgao, logo: recursos.logo },
    cssAdicional: recursos.cssAdicional,
    recursos: '../../_recursos',
    inicio: '../../index.html',
    cascaTemplate: tela.casca === 'autenticada' ? 'casca-autenticada.njk' : 'casca-publica.njk',
    casca: {
      ...(config.cascas[tela.casca] ?? {}),
      atalhos: [],
      menu: menuDoPerfil(tela, telas, config),
      conta: config.cascas[tela.casca]?.conta_no_pe ?? [],
      usuario: { nome: gFixo.pessoa(), perfil: tela.perfil ?? '' },
    },
    tela: { id: tela.id, testid: ts, titulo: tela.titulo, descricao: undefined },
    migalha: [{ rotulo: 'Início', href: '../../index.html' }, { rotulo: tituloDeArquivo(tela.modulo) }, { rotulo: tela.titulo }],
    estado: { id: e.id, tipo: e.tipo, mensagemTopo: mensagemTopo(e), resumoErros },
    layout: tela.layout,
    filtros,
    secoes,
    semSecao: tela.layout === 'leitura' ? semSecao.filter((c) => c.componente !== 'leitura') : semSecao,
    leitura: leitura.map((c) => ({ id: c.id, testid: c.testid, rotulo: c.rotulo, valor: c.valor })),
    tabela: { legenda: `Resultado: ${tela.titulo}`, colunas, linhas },
    paginacao: { total, paginas: Math.max(1, Math.ceil(total / config.padroes.paginacao)) },
    vazioTexto: msgAviso ?? 'Nenhum registro encontrado.',
    acoesFiltro: acoesVM(tela, telas, true),
    acoes: acoesVM(tela, telas, false),
    dados: tela.dados.map(tabelaDados),
    api: tela.api
      ? (() => {
          const nomes = [...new Set(tela.api.exemplos.flatMap((x) => Object.keys(x.valores)).filter((k) => !/^valor$/i.test(k)))];
          return {
            metodo: tela.api.metodo,
            caminho: tela.api.caminho,
            parametros: nomes,
            tabelaParametros: {
              legenda: 'Parâmetros',
              colunas: [{ rotulo: 'Parâmetro' }, { rotulo: 'Exemplo' }],
              linhas: nomes.map((n) => [n, tela.api!.exemplos.find((x) => x.valores[n])?.valores[n] ?? '']),
            },
            respostas: tela.api.exemplos.map((x) => ({ titulo: x.titulo, json: JSON.stringify(x.valores, null, 2) })),
          };
        })()
      : undefined,
  };
}

export interface OpcoesGeracao {
  specs: string;
  saida: string;
  recorte?: Recorte;
  arquivoConfig?: string;
}

/** Uma página HTML por tela e estado + navegação (index.html) + recursos. */
export async function gerarPrototipos(modelo: ModeloTelas, config: ConfigProjeto, o: OpcoesGeracao): Promise<{ paginas: PaginaGerada[]; achados: Achado[] }> {
  const achados: Achado[] = [];
  const arquivoConfig = o.arquivoConfig ?? 'projeto.yml';
  const kit = diretorioDoKit(config, achados, arquivoConfig);
  const recursos = await gravarRecursos(o.saida, kit, config, o.specs, achados, arquivoConfig);
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(kit, { noCache: true }), { autoescape: true, throwOnUndefined: false, trimBlocks: true, lstripBlocks: true });
  env.addFilter('slug', slug);
  const paginas: PaginaGerada[] = [];
  const telas = modelo.telas.filter((t) => dentroDoRecorte(t, o.recorte));

  for (const t of telas) {
    const destinoPng = path.join(o.specs, t.modulo, t.prototipo.imagem ?? `${t.id}.png`);
    if (t.prototipo.html) {
      paginas.push({ tela: t.id, estado: 'padrao', arquivo: path.join(o.specs, t.modulo, t.prototipo.html), destinoPng });
      continue;
    }
    for (const e of t.estados) {
      const html = env.render(`layouts/${t.layout}.njk`, contextoDaPagina(t, e, modelo, config, recursos));
      const arquivo = dentroDe(o.saida, path.join(o.saida, t.modulo, t.id, `${e.id}.html`));
      await gravarSeMudou(arquivo, limpar(html));
      paginas.push({ tela: t.id, estado: e.id, arquivo, destinoPng: e.id === 'padrao' ? destinoPng : undefined });
    }
  }

  const modulos = [...new Set(telas.map((t) => t.modulo))].map((m) => ({
    nome: tituloDeArquivo(m),
    telas: telas.filter((t) => t.modulo === m).map((t) => ({
      id: t.id, testid: slug(t.id), titulo: t.titulo, layout: t.layout,
      href: t.prototipo.html ? '#' : `${seg(t.modulo)}/${seg(t.id)}/padrao.html`,
      estados: t.prototipo.html ? [] : t.estados.map((e) => ({ rotulo: e.id, href: `${seg(t.modulo)}/${seg(t.id)}/${seg(e.id)}.html` })),
    })),
  }));
  await gravarSeMudou(path.join(o.saida, 'index.html'), limpar(env.render('indice.njk', { projeto: config.projeto, modulos, total: telas.length })));
  return { paginas, achados };
}

/** Tira espaços em branco no fim das linhas e linhas vazias repetidas: HTML estável e legível no diff. */
function limpar(html: string): string {
  return html.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
