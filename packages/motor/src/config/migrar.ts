import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ErroPrumo } from '../util/erros.js';
import { configPadrao } from './esquema.js';
import { lerProperties, propertiesParaProjeto } from './properties.js';

const q = (v: unknown) => JSON.stringify(v);

interface Convertido {
  projeto: { nome: string; versao: string; logo?: string };
  identidade: { cores: Record<string, string> };
  documentacao: Record<string, unknown>;
}

/** Cria o projeto.yml a partir do config.properties, com comentários explicando cada bloco (FA-05). */
export async function migrarConfig(specs: string, opcoes: { forcar?: boolean } = {}) {
  const prop = path.join(specs, 'config.properties');
  const destino = path.join(specs, 'projeto.yml');
  if (!existsSync(prop)) throw new ErroPrumo('CLI-01', `Não há config.properties em ${specs}.`);
  if (existsSync(destino) && !opcoes.forcar) {
    throw new ErroPrumo('MIGRAR', `Já existe ${destino}. Use --forcar para sobrescrever.`);
  }
  const b = propertiesParaProjeto(lerProperties(await readFile(prop, 'utf8'))) as unknown as Convertido;
  const p = configPadrao();
  const cores = { ...p.identidade.cores, ...b.identidade.cores };
  const d = { ...p.documentacao, ...b.documentacao };
  const conta = p.cascas.autenticada?.conta_no_pe ?? [];

  const linhas = [
    '# Configuração do Prumo para este projeto de requisitos.',
    '# Gerado a partir do config.properties do Pirilampo; quando os dois existem, este arquivo vale.',
    '',
    'projeto:',
    `  nome: ${q(b.projeto.nome)}`,
    `  versao: ${q(b.projeto.versao)}`,
    '  orgao: ""',
    ...(b.projeto.logo ? [`  logo: ${q(b.projeto.logo)}`] : []),
    '',
    '# Identidade visual: os tokens geram o CSS das telas e da documentação.',
    'identidade:',
    '  design_system: proprio      # proprio | govbr',
    '  cores:',
    ...Object.entries(cores).map(([k, v]) => `    ${k}: ${q(v)}`),
    '  fontes:',
    `    titulo: ${q(p.identidade.fontes.titulo)}`,
    `    texto: ${q(p.identidade.fontes.texto)}`,
    '  # css_adicional: caminho/para/estilo.css   # CSS do projeto, incluído depois do kit',
    '',
    '# Largura, em pixels, da captura das telas.',
    `largura_captura: ${p.largura_captura}`,
    '',
    '# Moldura de cada grupo de telas.',
    'cascas:',
    '  publica: { topo: true, rodape: true }',
    `  autenticada: { menu: true, conta_no_pe: [${conta.map(q).join(', ')}] }`,
    '',
    '# Menu de cada perfil e, por pasta de módulo, a casca e o perfil padrão.',
    'perfis: {}',
    'modulos: {}',
    '',
    '# Máscaras: # dígito, A letra, X letra ou dígito.',
    'mascaras:',
    ...Object.entries(p.mascaras).map(([k, v]) => `  ${k}: ${Array.isArray(v) ? `[${v.map(q).join(', ')}]` : q(v)}`),
    '',
    'dados_ficticios:',
    '  cnpj: numerico              # numerico | alfanumerico (IN RFB 2.229/2024)',
    '  sufixo_nomes: Exemplo',
    '',
    'documentacao:',
    `  arquivo_unico: ${d.arquivo_unico}        # true = um index.html só, como o Pirilampo`,
    `  pdf: ${d.pdf}               # retrato | paisagem`,
    `  prototipo_aberto: ${d.prototipo_aberto}`,
    ...(d.embutir_imagens !== undefined ? [`  embutir_imagens: ${d.embutir_imagens}`] : []),
    '',
  ];
  await writeFile(destino, linhas.join('\n'), 'utf8');
  return { caminho: destino };
}
