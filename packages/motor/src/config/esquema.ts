import type { Mascara } from '../dados/mascara.js';

/** Achado de verificação ou de configuração. Problema do requisito nunca vira exceção. */
export interface Achado {
  severidade: 'erro' | 'aviso' | 'info';
  codigo: string;
  arquivo: string;
  linha?: number;
  coluna?: number;
  mensagem: string;
  sugestao?: string;
}

export interface Casca {
  topo?: boolean;
  rodape?: boolean;
  menu?: boolean;
  conta_no_pe?: string[];
}

/** Forma do projeto.yml já com os padrões aplicados. */
export interface ConfigProjeto {
  projeto: { nome: string; versao: string; orgao: string; logo?: string; logo_claro?: string };
  identidade: {
    design_system: 'proprio' | 'govbr';
    cores: Record<'fundo' | 'texto' | 'primaria' | 'menu' | 'menu_texto' | 'destaque' | 'erro', string> & Record<string, string>;
    fontes: { titulo: string; texto: string };
    css_adicional?: string;
  };
  largura_captura: number;
  /** Captura também a 390 px (`<tela>-celular.png`, RN-87). */
  captura: { celular: boolean };
  cascas: Record<string, Casca>;
  perfis: Record<string, string[]>;
  modulos: Record<string, { casca?: string; perfil?: string }>;
  padroes: { listas_sempre_em_tela: boolean; paginacao: number; container_max: number; selo_situacao: boolean };
  dados_ficticios: { cnpj: 'numerico' | 'alfanumerico'; sufixo_nomes: string };
  mascaras: Record<string, Mascara>;
  mensagens: Record<string, 'erro' | 'sucesso' | 'aviso'>;
  verificacao: { exigir_regra_em_editavel: boolean; severidades: Record<string, Achado['severidade']> };
  referencias: { regras: string[]; mensagens: string[] };
  documentacao: { arquivo_unico: boolean; pdf: 'retrato' | 'paisagem'; prototipo_aberto: boolean } & Record<string, unknown>;
  /** Demais chaves aceitas e preservadas para as próximas fases (atualizacao, ia…). */
  extras: Record<string, unknown>;
}

export function configPadrao(): ConfigProjeto {
  return {
    projeto: { nome: 'Projeto', versao: '1.0', orgao: '' },
    identidade: {
      design_system: 'proprio',
      cores: {
        fundo: '#FFFFFF',
        texto: '#1B1B1B',
        primaria: '#1351B4',
        menu: '#0E1A33',
        menu_texto: '#C3CDE3',
        destaque: '#FFCD07',
        erro: '#B3261E',
      },
      fontes: { titulo: 'Atkinson Hyperlegible', texto: 'Atkinson Hyperlegible' },
    },
    largura_captura: 1440,
    captura: { celular: false },
    cascas: {
      publica: { topo: true, rodape: true },
      autenticada: { menu: true, conta_no_pe: ['Alterar Senha', 'Sair do Sistema'] },
    },
    perfis: {},
    modulos: {},
    padroes: { listas_sempre_em_tela: true, paginacao: 10, container_max: 1280, selo_situacao: false },
    dados_ficticios: { cnpj: 'numerico', sufixo_nomes: 'Exemplo' },
    mascaras: {
      CNPJ: '##.###.###/####-##',
      CPF: '###.###.###-##',
      CEP: '##.###-###',
      Fone: ['(##) ####-####', '(##) #####-####'],
    },
    mensagens: {},
    verificacao: { exigir_regra_em_editavel: false, severidades: {} },
    referencias: { regras: ['Regras_de_negócio'], mensagens: ['Mensagem_de_Interface'] },
    documentacao: { arquivo_unico: false, pdf: 'retrato', prototipo_aberto: true },
    extras: {},
  };
}

const CHAVES_CONHECIDAS = new Set([
  'projeto', 'identidade', 'largura_captura', 'captura', 'cascas', 'perfis', 'modulos', 'padroes', 'dados_ficticios',
  'mascaras', 'mensagens', 'verificacao', 'referencias', 'documentacao', 'atualizacao', 'ia',
]);

const HEX = /^#[0-9A-Fa-f]{6}$/;
type Bruto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Bruto => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Mescla o YAML (ou o properties convertido) sobre os padrões e valida.
 * `linhaDe` devolve a linha de uma chave no arquivo, para os achados.
 */
export function validarConfig(bruto: unknown, arquivo: string, linhaDe: (caminho: string[]) => number | undefined = () => undefined) {
  const achados: Achado[] = [];
  const c = configPadrao();
  const aviso = (caminho: string[], mensagem: string, severidade: Achado['severidade'] = 'aviso') =>
    achados.push({ severidade, codigo: 'config/invalida', arquivo, linha: linhaDe(caminho), mensagem });

  if (bruto === null || bruto === undefined) return { config: c, achados };
  if (!ehObjeto(bruto)) {
    aviso([], 'O projeto.yml precisa ser um mapa de chaves (projeto:, identidade:, …).', 'erro');
    return { config: c, achados };
  }

  for (const k of Object.keys(bruto)) {
    if (!CHAVES_CONHECIDAS.has(k)) aviso([k], `Chave desconhecida "${k}"; ela é ignorada.`);
  }

  const p = bruto.projeto;
  if (ehObjeto(p)) {
    if (typeof p.nome === 'string' && p.nome.trim()) c.projeto.nome = p.nome.trim().slice(0, 80);
    else aviso(['projeto', 'nome'], 'projeto.nome é obrigatório.', 'erro');
    if (p.versao !== undefined) c.projeto.versao = String(p.versao);
    else aviso(['projeto', 'versao'], 'projeto.versao é obrigatório.', 'erro');
    if (typeof p.orgao === 'string') c.projeto.orgao = p.orgao;
    if (typeof p.logo === 'string' && p.logo) c.projeto.logo = p.logo;
    if (typeof p.logo_claro === 'string' && p.logo_claro) c.projeto.logo_claro = p.logo_claro;
    else if (p.logo_claro !== undefined && p.logo_claro !== null) aviso(['projeto', 'logo_claro'], 'projeto.logo_claro deve ser o caminho de uma imagem.');
  } else {
    aviso(['projeto'], 'Falta o bloco projeto: com nome e versao.', 'erro');
  }

  const id = bruto.identidade;
  if (ehObjeto(id)) {
    if (id.design_system === 'proprio' || id.design_system === 'govbr') c.identidade.design_system = id.design_system;
    else if (id.design_system !== undefined) aviso(['identidade', 'design_system'], 'design_system deve ser "proprio" ou "govbr".');
    if (ehObjeto(id.cores)) {
      for (const [k, v] of Object.entries(id.cores)) {
        if (typeof v === 'string' && HEX.test(v)) c.identidade.cores[k] = v.toUpperCase();
        else aviso(['identidade', 'cores', k], `A cor "${k}" precisa estar no formato #RRGGBB.`);
      }
    }
    if (ehObjeto(id.fontes)) {
      if (typeof id.fontes.titulo === 'string') c.identidade.fontes.titulo = id.fontes.titulo;
      if (typeof id.fontes.texto === 'string') c.identidade.fontes.texto = id.fontes.texto;
    }
    if (typeof id.css_adicional === 'string' && id.css_adicional) c.identidade.css_adicional = id.css_adicional;
  }

  if (bruto.largura_captura !== undefined) {
    const n = Number(bruto.largura_captura);
    if (Number.isInteger(n) && n >= 320 && n <= 3840) c.largura_captura = n;
    else aviso(['largura_captura'], 'largura_captura deve ser um inteiro entre 320 e 3840.');
  }

  if (bruto.captura !== undefined) {
    if (ehObjeto(bruto.captura) && (bruto.captura.celular === undefined || typeof bruto.captura.celular === 'boolean')) c.captura.celular = bruto.captura.celular === true;
    else aviso(['captura', 'celular'], 'captura.celular deve ser true ou false.');
  }

  if (ehObjeto(bruto.cascas)) {
    for (const [nome, v] of Object.entries(bruto.cascas)) if (ehObjeto(v)) c.cascas[nome] = { ...(c.cascas[nome] ?? {}), ...(v as Casca) };
  }
  if (ehObjeto(bruto.perfis)) {
    for (const [nome, v] of Object.entries(bruto.perfis)) {
      if (Array.isArray(v)) c.perfis[nome] = v.map(String);
      else aviso(['perfis', nome], `O perfil "${nome}" precisa ser uma lista de itens de menu.`);
    }
  }
  if (ehObjeto(bruto.modulos)) {
    for (const [nome, v] of Object.entries(bruto.modulos)) {
      if (!ehObjeto(v)) continue;
      c.modulos[nome] = {
        casca: typeof v.casca === 'string' ? v.casca : undefined,
        perfil: typeof v.perfil === 'string' ? v.perfil : undefined,
      };
      if (c.modulos[nome].casca && !c.cascas[c.modulos[nome].casca!]) aviso(['modulos', nome, 'casca'], `Casca "${v.casca}" não definida em cascas:.`);
      if (c.modulos[nome].perfil && !c.perfis[c.modulos[nome].perfil!]) aviso(['modulos', nome, 'perfil'], `Perfil "${v.perfil}" não definido em perfis:.`);
    }
  }
  if (ehObjeto(bruto.padroes)) {
    const pd = bruto.padroes;
    if (typeof pd.listas_sempre_em_tela === 'boolean') c.padroes.listas_sempre_em_tela = pd.listas_sempre_em_tela;
    if (Number.isInteger(pd.paginacao)) c.padroes.paginacao = pd.paginacao as number;
    if (Number.isInteger(pd.container_max)) c.padroes.container_max = pd.container_max as number;
    // Selo de situação no kit proprio (RN-86); no govbr vem sempre. Desligado por padrão para não mudar PNGs existentes.
    if (typeof pd.selo_situacao === 'boolean') c.padroes.selo_situacao = pd.selo_situacao;
  }
  if (ehObjeto(bruto.dados_ficticios)) {
    const d = bruto.dados_ficticios;
    if (d.cnpj === 'numerico' || d.cnpj === 'alfanumerico') c.dados_ficticios.cnpj = d.cnpj;
    if (typeof d.sufixo_nomes === 'string') c.dados_ficticios.sufixo_nomes = d.sufixo_nomes;
  }
  if (ehObjeto(bruto.mascaras)) {
    for (const [k, v] of Object.entries(bruto.mascaras)) {
      if (typeof v === 'string' || (Array.isArray(v) && v.every((x) => typeof x === 'string'))) c.mascaras[k] = v as Mascara;
      else aviso(['mascaras', k], `A máscara "${k}" precisa ser texto ou lista de textos.`);
    }
  }
  if (ehObjeto(bruto.mensagens)) {
    for (const [k, v] of Object.entries(bruto.mensagens)) if (v === 'erro' || v === 'sucesso' || v === 'aviso') c.mensagens[k.toUpperCase()] = v;
  }
  if (ehObjeto(bruto.verificacao)) {
    const v = bruto.verificacao;
    if (typeof v.exigir_regra_em_editavel === 'boolean') c.verificacao.exigir_regra_em_editavel = v.exigir_regra_em_editavel;
    if (ehObjeto(v.severidades)) {
      for (const [k, s] of Object.entries(v.severidades)) if (s === 'erro' || s === 'aviso' || s === 'info') c.verificacao.severidades[k] = s;
    }
  }
  if (ehObjeto(bruto.referencias)) {
    const r = bruto.referencias;
    if (Array.isArray(r.regras)) c.referencias.regras = r.regras.map(String);
    if (Array.isArray(r.mensagens)) c.referencias.mensagens = r.mensagens.map(String);
  }
  if (ehObjeto(bruto.documentacao)) {
    const d = bruto.documentacao;
    c.documentacao = { ...c.documentacao, ...d };
    if (typeof d.arquivo_unico === 'boolean') c.documentacao.arquivo_unico = d.arquivo_unico;
    if (d.pdf === 'retrato' || d.pdf === 'paisagem') c.documentacao.pdf = d.pdf;
    if (typeof d.prototipo_aberto === 'boolean') c.documentacao.prototipo_aberto = d.prototipo_aberto;
  }
  for (const k of ['atualizacao', 'ia']) if (bruto[k] !== undefined) c.extras[k] = bruto[k];

  return { config: c, achados };
}
