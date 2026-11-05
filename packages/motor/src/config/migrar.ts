import { existsSync, readdirSync } from 'node:fs';
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

/**
 * Nome do projeto pela pasta: ".../snbp_documentacao/3 - Requisitos/Especificações" → "SNBP".
 * Sobe as pastas de requisitos e tira o sufixo "documentação"; sigla curta vai em maiúsculas.
 */
export function nomeDaPasta(specs: string): string {
  const partes = path.resolve(specs).split(/[\\/]+/).filter(Boolean).reverse();
  const pasta = partes.find((p) => !/^(especifica[cç](o|õ)es|\d+\s*-\s*requisitos|requisitos|doc|docs)$/i.test(p)) ?? 'Projeto';
  const base = pasta.replace(/[-_ ]*(documenta[cç][aã]o|documentacao|docs?)$/i, '').replace(/[-_]+/g, ' ').trim() || pasta;
  return base.length <= 6 && !/\s/.test(base) ? base.toUpperCase() : base.replace(/(^|\s)(\p{L})/gu, (_m, e: string, l: string) => e + l.toUpperCase());
}

/** Logo ao lado das especificações (na pasta, em Logo/ ou na pasta de cima), relativo às especificações. */
export function acharLogo(specs: string): string | undefined {
  const lugares = [specs, path.join(specs, 'Logo'), path.join(specs, 'logo'), path.dirname(specs)];
  for (const dir of lugares) {
    if (!existsSync(dir)) continue;
    const achado = readdirSync(dir).find((n) => /logo/i.test(n) && /\.(png|svg|jpe?g)$/i.test(n));
    if (achado) return path.relative(specs, path.join(dir, achado)).split(path.sep).join('/');
  }
  return undefined;
}

/**
 * Cria o projeto.yml, com comentários explicando cada bloco (FA-05): a partir do config.properties do Pirilampo
 * ou, sem ele, com a configuração padrão (nome pela pasta e logo encontrado ao lado das especificações).
 */
export async function migrarConfig(specs: string, opcoes: { forcar?: boolean } = {}) {
  const prop = path.join(specs, 'config.properties');
  const destino = path.join(specs, 'projeto.yml');
  if (!existsSync(specs)) throw new ErroPrumo('CLI-01', `A pasta ${specs} não existe.`);
  if (existsSync(destino) && !opcoes.forcar) {
    throw new ErroPrumo('MIGRAR', `Já existe ${destino}. Use --forcar para sobrescrever.`);
  }
  const doPirilampo = existsSync(prop);
  const b: Convertido = doPirilampo
    ? (propertiesParaProjeto(lerProperties(await readFile(prop, 'utf8'))) as unknown as Convertido)
    : { projeto: { nome: nomeDaPasta(specs), versao: '1.0', logo: acharLogo(specs) }, identidade: { cores: {} }, documentacao: {} };
  const p = configPadrao();
  const cores = { ...p.identidade.cores, ...b.identidade.cores };
  const d = { ...p.documentacao, ...b.documentacao };
  const conta = p.cascas.autenticada?.conta_no_pe ?? [];

  const linhas = [
    '# Configuração do Prumo para este projeto de requisitos.',
    doPirilampo
      ? '# Gerado a partir do config.properties do Pirilampo; quando os dois existem, este arquivo vale.'
      : '# Criado com a configuração padrão (não havia config.properties). Ajuste nome, órgão, logo e cores.',
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
  return { caminho: destino, origem: doPirilampo ? ('config.properties' as const) : ('padrao' as const) };
}
