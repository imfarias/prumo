/** Tipos compartilhados entre o processo principal e a janela (só dados, sem código de Node). */

export interface Recente {
  caminho: string;
  nome: string;
  versao: string;
  abertoEm: string;
}

export interface Preferencias {
  recentes: Recente[];
  editor: 'vscode' | 'sistema' | { executavel: string; argumentos: string[] };
  previaAoVivo: boolean;
  tema: 'sistema' | 'claro' | 'escuro';
  atualizacao: { ligada: boolean; url?: string; ultimaVerificacao?: string; lembrarDepoisAte?: string };
  menuContexto?: boolean;
}

export interface AchadoVisao {
  severidade: 'erro' | 'aviso' | 'info';
  codigo: string;
  arquivo: string;
  linha?: number;
  coluna?: number;
  mensagem: string;
  sugestao?: string;
}

export interface ProjetoAberto {
  specs: string;
  nome: string;
  versao: string;
  telas: number;
  erros: number;
  avisos: number;
  fonte: 'projeto.yml' | 'config.properties' | 'padrao';
  git: boolean;
  achados: AchadoVisao[];
  verificadoEm: string;
}

export interface CampoVisao {
  nome: string;
  grupo: string;
  componente: string;
  editavel: boolean;
  obrigatorio: boolean;
  sinais: string[];
}

export interface TelaVisao {
  id: string;
  titulo: string;
  modulo: string;
  layout: string;
  miniatura?: string; // URL prumo-arquivo:
  estados: { id: string; rotulo: string; url: string }[];
  campos: CampoVisao[];
  sinais: string[];
}

export type TipoTarefa = 'verificar' | 'gerar' | 'capturar' | 'comparar-png' | 'docs' | 'pdf' | 'comparar';

export interface EstadoTarefa {
  id: string;
  tipo: TipoTarefa;
  etapa: string;
  feito: number;
  total: number;
  estado: 'rodando' | 'concluida' | 'cancelada' | 'erro';
  resultado?: unknown;
  erro?: { codigo?: string; mensagem: string };
}

export interface ResultadoComparacaoVisao {
  versao: string;
  novas: { endereco: string; titulo: string; url: string }[];
  alteradas: { endereco: string; titulo: string; url: string; cenarios: number }[];
  removidas: { endereco: string; titulo: string }[];
  renomeadas: { de: string; para: string }[];
}

export interface InfoAtualizacao {
  versao: string;
  notas: string;
  url: string; // página da release
  arquivo?: { nome: string; tamanho: number };
}

export interface Sobre {
  versao: string;
  motor: string;
  electron: string;
  chromium: string;
  node: string;
  registro: string;
}
