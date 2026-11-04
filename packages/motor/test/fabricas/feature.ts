/** Fábrica de features no padrão Pirilampo, para casos de teste e problemas plantados. */
export interface CampoFabrica {
  nome: string;
  editavel?: boolean;
  obrigatorio?: boolean;
  regras?: string;
  exemplo?: string;
}

export interface OpcoesFeature {
  nome: string; // ex.: '01_Teste_Listagem'
  modulo?: string;
  tipo?: 'Consulta' | 'Manual' | 'Integração';
  narrativa?: boolean;
  grupo?: string; // '<Campos>', '<Filtros>'
  campos?: CampoFabrica[];
  colunas?: CampoFabrica[];
  passosPrincipais?: string[];
  cenariosExtras?: string[]; // blocos já formatados
  tags?: { principal?: string };
  prototipo?: boolean | string; // false = sem @prototipo; string = nome da imagem
}

const linhaDef = (c: CampoFabrica) =>
  `      | ${c.nome} | ${c.editavel === false ? 'N' : 'S'} | ${c.obrigatorio ? 'S' : 'N'} | ${c.regras ?? '-'} |`;

export function fabricaFeature(o: OpcoesFeature): string {
  const campos = o.campos ?? [];
  const exemplos = campos.filter((c) => c.exemplo !== undefined);
  const partes = [
    '﻿# language: pt',
    '# encoding: utf-8',
    '',
    `Funcionalidade: ${o.nome}`,
    '',
    ...(o.narrativa === false ? [] : ['  **COMO** pessoa de teste<br>', '', '  **QUERO** usar a tela<br>', '', '  **PARA** validar o Prumo.', '']),
    `  # Módulo: ${o.modulo ?? '01 Teste'}`,
    `  # Tipo: ${o.tipo ?? 'Manual'}`,
    '  # Fluxo: Fluxo de teste',
    '',
    '  Contexto: Critérios de Aceitação',
    '    Dado que a pessoa acessa a tela',
  ];
  if (campos.length) {
    partes.push(`    E o sistema apresenta os ${o.grupo ?? '<Campos>'}`, '      | Campo | Editável | Obrigatório | Regras |', ...campos.map(linhaDef));
  }
  partes.push('', `  ${o.tags?.principal ?? '@fluxo-principal'}`, '  Cenário: 01. Fluxo principal');
  if (exemplos.length) {
    partes.push(`    Dado que a pessoa preenche os ${o.grupo ?? '<Campos>'}`, '      | Campo | Exemplo |', ...exemplos.map((c) => `      | ${c.nome} | ${c.exemplo} |`));
  }
  partes.push(...(o.passosPrincipais ?? ['    Quando a pessoa aciona a opção **Salvar**', '    Então o sistema conclui a operação']));
  if (o.colunas?.length) {
    partes.push('    E o sistema apresenta as <Colunas>', '      | Campo | Editável | Obrigatório | Regras |', ...o.colunas.map((c) => linhaDef({ ...c, editavel: false })));
  }
  for (const c of o.cenariosExtras ?? []) partes.push('', c);
  if (o.prototipo !== false) {
    const img = typeof o.prototipo === 'string' ? o.prototipo : `${o.nome}.png`;
    partes.push('', '  @prototipo', '  Cenário: Protótipo', `  ![Image](${img})`);
  }
  return partes.join('\n') + '\n';
}

export const linkRegra = (n: number, arquivo = 'Regras_de_negócio_EXEMPLO_Regras_de_negócio') => `#/scenario/${arquivo}/${n}`;
