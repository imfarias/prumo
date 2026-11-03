/** Estruturas internas do parser (não serializadas no telas.json). */

export interface Origem {
  arquivo: string; // relativo à pasta de especificações, com '/'
  linha: number;
  coluna?: number;
}

export interface LinkCitado {
  rotulo: string;
  alvo: string; // texto depois do '#', ex.: '/scenario/Pasta_Arquivo/6' ou '!/feature/Pasta_Arquivo'
  tipo: 'cenario' | 'feature';
  endereco: string; // 'Pasta_Arquivo/6' ou 'Pasta_Arquivo'
  posicao?: number;
  origem: Origem;
}

export interface Tabela {
  cabecalho: string[];
  linhas: { celulas: string[]; linha: number }[];
  linha: number;
}

export interface Passo {
  palavra: string; // 'Dado ', 'Quando '…
  texto: string;
  linha: number;
  tabela?: Tabela;
  docString?: string;
}

export interface Filho {
  posicao: number; // posição Pirilampo: índice 0-based entre Contexto e Cenários
  tipo: 'Contexto' | 'Cenário' | 'Esquema';
  titulo: string;
  tags: string[];
  descricao: string;
  passos: Passo[];
  exemplos: Tabela[];
  linha: number;
  /** Comentários `# Chave: valor` dentro do bloco (ex.: `# Seção: Endereço`). */
  anotacoes: { chave: string; valor: string; linha: number }[];
}

export interface ArquivoFeature {
  caminho: string; // absoluto
  relativo: string; // relativo às specs, com '/'
  pasta: string; // pasta imediata (vira prefixo do endereço)
  nome: string; // sem .feature
  endereco: string; // `${pasta}_${nome}`
  titulo: string; // nome da Funcionalidade
  descricao: string;
  linha: number;
  tags: string[];
  metadados: Record<string, { valor: string; linha: number }>; // Módulo, Tipo, Fluxo, Tela, Perfil…
  filhos: Filho[];
  links: LinkCitado[];
  imagens: { alvo: string; origem: Origem }[];
}
