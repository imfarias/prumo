import type { Achado } from '../config/esquema.js';

export type Situacao = 'nova' | 'alterada' | 'removida' | 'igual';
export type Modo = 'pasta' | 'unico';

export interface NoArvore {
  titulo: string;
  endereco?: string; // presente nas folhas (funcionalidades)
  arquivo?: string;
  filhos: NoArvore[];
  situacao?: Situacao;
  erro?: boolean;
}

export interface TabelaDoc {
  tipo: 'definicao' | 'exemplo' | 'outra';
  cabecalho: string[]; // HTML seguro
  linhas: string[][]; // HTML seguro
}

export interface PassoDoc {
  palavra: string;
  html: string;
  tabela?: TabelaDoc;
  docString?: string;
}

export interface UsoDoc {
  endereco: string;
  arquivo: string;
  pagina: string; // título da página que cita
  posicao: number; // filho que cita (-1 = descrição)
  cenario: string;
  href: string;
}

export interface FilhoDoc {
  posicao: number;
  tipo: 'Contexto' | 'Cenário' | 'Esquema';
  titulo: string;
  ancora: string; // c-{posicao}
  tags: string[];
  descricaoHtml: string;
  passos: PassoDoc[];
  exemplos: TabelaDoc[];
  codigo?: string;
  usadaEm?: UsoDoc[];
  situacao?: Situacao;
  diffHtml?: string;
}

export interface PrototipoDoc {
  tela: string;
  modulo: string;
  estados: { id: string; rotulo: string; caminho: string }[]; // caminho relativo à raiz da documentação
  png?: string; // recurso de imagem
  anterior?: { estados: { id: string; rotulo: string; caminho: string }[] };
  html?: string; // protótipo próprio (FA-07)
}

export interface PaginaDoc {
  endereco: string;
  arquivo: string; // nome seguro em f/
  nomeFeature: string;
  titulo: string;
  modulo: string;
  pasta: string;
  relativo: string;
  tipo?: string;
  fluxo?: string;
  narrativaHtml: string;
  filhos: FilhoDoc[];
  removidos: { titulo: string; html: string }[];
  prototipo?: PrototipoDoc;
  citadas: { codigo: string; titulo: string; href: string; previa: string }[];
  fonte: string;
  apoio: boolean;
  situacao?: Situacao;
  erroSintaxe?: { linha?: number; mensagem: string };
  anterior?: { narrativaHtml: string; filhos: FilhoDoc[] };
}

export interface DocBusca {
  id: string;
  tipo: 'funcionalidade' | 'cenario' | 'regra' | 'lista' | 'mensagem' | 'email';
  titulo: string;
  caminho: string;
  texto: string;
  destino: string; // rota nova: !/f/{end} ou !/f/{end}/c/{n}
  codigo?: string;
}

export interface Previa {
  titulo: string;
  html: string;
  href: string;
}

export interface Documentacao {
  modo: Modo;
  projeto: { nome: string; versao: string; orgao: string; logo?: string };
  arvore: NoArvore[];
  paginas: PaginaDoc[];
  matriz: { telas: { endereco: string; titulo: string; arquivo: string }[]; codigos: { codigo: string; tipo: string; titulo: string; previa: string }[]; marcas: [number, number][] };
  achados: (Achado & { href?: string })[];
  numeros: { funcionalidades: number; telas: number; cenarios: number; regras: number; listas: number; mensagens: number };
  comparacao?: { versao: string; novas: string[]; alteradas: string[]; removidas: { endereco: string; titulo: string }[]; renomeadas: { de: string; para: string }[] };
  busca: DocBusca[];
  previas: Record<string, Previa>;
  rotas: Record<string, { arquivo: string; filhos: number[] }>; // endereço (NFC) → arquivo e posições existentes
  imagens: Map<string, string>; // origem absoluta → destino relativo a recursos/
}
