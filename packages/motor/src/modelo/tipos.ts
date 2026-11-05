import type { Mascara } from '../dados/mascara.js';
import type { Origem } from '../parser/tipos.js';

export type { Origem };

/** Fato do requisito que levou a uma decisão de inferência; fica no telas.json para revisão. */
export interface Sinal {
  regra: string; // 'RN-14', 'override'…
  descricao: string;
  origem?: Origem;
}

export type Componente =
  | 'texto' | 'mascara' | 'email' | 'tel' | 'data' | 'valor' | 'numero' | 'selecao' | 'confirmacao'
  | 'caixa' | 'captcha' | 'arquivos' | 'texto-longo' | 'senha' | 'leitura';

export const COMPONENTES: readonly Componente[] = [
  'texto', 'mascara', 'email', 'tel', 'data', 'valor', 'numero', 'selecao', 'confirmacao',
  'caixa', 'captcha', 'arquivos', 'texto-longo', 'senha', 'leitura',
];

export interface RefCitada {
  codigo?: string; // 'RNG-06' (chave normalizada) quando o rótulo é um código
  rotulo: string;
  destino: string; // endereço 'Pasta_Arquivo/6' ou 'Pasta_Arquivo'
  origem: Origem;
}

export interface Campo {
  id: string;
  nome: string;
  rotulo: string;
  grupo: string; // 'Filtros', 'Campos', 'Colunas'…
  editavel: boolean;
  obrigatorio: boolean;
  regras: RefCitada[];
  regraTexto?: string;
  componente: Componente;
  mascara?: Mascara;
  opcoes?: string[];
  confirma?: string; // id do campo confirmado
  exemplo?: string;
  largura?: string;
  secao?: string;
  ajuda?: string;
  sinais: Sinal[];
  origem: Origem;
}

export interface Acao {
  id: string;
  rotulo: string;
  primaria: boolean;
  destino?: string; // id da tela de destino
  /** Estados que a ação produz nos cenários (RN-84). */
  fluxo?: { sucesso?: string; erros: string[]; avisos: string[] };
  /** Por que a ação tem destino ou fluxo. */
  sinal?: Sinal;
  origem: Origem;
}

export type TipoEstado = 'padrao' | 'erro' | 'sucesso' | 'aviso' | 'vazio' | 'sem-permissao';

export interface Estado {
  id: string;
  tipo: TipoEstado;
  cenario?: { posicao: number; titulo: string };
  mensagem?: { codigo: string; texto: string; local: 'topo' | 'campo'; campo?: string };
  exemplos: Record<string, string>; // nome do campo → valor
  /** Ação acionada no cenário que produz este estado (RN-84). */
  acao?: string;
}

export type Layout = 'listagem' | 'formulario' | 'formulario-etapas' | 'leitura' | 'api';
export const LAYOUTS: readonly Layout[] = ['listagem', 'formulario', 'formulario-etapas', 'leitura', 'api'];
/** "Janela sobre o portal": não é um layout, e sim a forma de apresentar o layout inferido (override ou `# Tela:`). */
export const ehJanela = (v: string | undefined) => !!v && /^janela([-_ ]sobre)?$/.test(v.trim().toLowerCase());

export interface Tela {
  id: string; // nome da feature sem .feature
  endereco: string; // endereço Pirilampo da funcionalidade
  modulo: string; // pasta
  titulo: string;
  tipo: 'Consulta' | 'Manual' | 'Integração' | null;
  layout: Layout;
  /** Apresentada como janela sobre o portal (0004). */
  janela?: boolean;
  casca: string;
  perfil: string | null;
  fluxo?: string;
  narrativa?: { como: string; quero: string; para: string };
  filtros: Campo[];
  campos: Campo[];
  colunas: Campo[];
  secoes: { titulo: string; campos: string[] }[];
  dados: { titulo: string; cabecalho: string[]; linhas: string[][] }[];
  acoes: Acao[];
  estados: Estado[];
  api?: { metodo: string; caminho: string; exemplos: { titulo: string; valores: Record<string, string> }[] };
  prototipo: { imagem?: string; html?: string; titulo?: string; origem: Origem };
  sinais: Sinal[];
  origem: Origem;
}

export interface ReferenciaModelo {
  codigo: string;
  tipo: 'RNG' | 'LOV' | 'MSG' | 'EMAIL';
  titulo: string;
  endereco: string;
  origem: Origem;
  usadaEm: Origem[];
  opcoes?: string[];
  texto?: string;
}

export interface ModeloTelas {
  versaoModelo: string;
  projeto: { nome: string; versao: string };
  telas: Tela[];
  referencias: ReferenciaModelo[];
}
