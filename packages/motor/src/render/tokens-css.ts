import { arquivoFonte } from '../util/recursos.js';
import type { Achado, ConfigProjeto } from '../config/esquema.js';
import { contraste, misturar } from './contraste.js';

/** Fontes embutidas (SIL OFL): só subconjunto latino, pesos usados pelo kit. */
export const FONTES_EMBUTIDAS: Record<string, { pacote: string; arquivos: { peso: number; estilo: string; nome: string }[] }> = {
  'Jost': {
    pacote: '@fontsource/jost',
    arquivos: [
      { peso: 500, estilo: 'normal', nome: 'jost-latin-500-normal.woff2' },
      { peso: 700, estilo: 'normal', nome: 'jost-latin-700-normal.woff2' },
    ],
  },
  // Kit govbr (0004): a Raleway é a reserva que o próprio gov.br DS declara para a Rawline, que não está no npm.
  'Raleway': {
    pacote: '@fontsource/raleway',
    arquivos: [
      { peso: 400, estilo: 'normal', nome: 'raleway-latin-400-normal.woff2' },
      { peso: 400, estilo: 'italic', nome: 'raleway-latin-400-italic.woff2' },
      { peso: 600, estilo: 'normal', nome: 'raleway-latin-600-normal.woff2' },
      { peso: 700, estilo: 'normal', nome: 'raleway-latin-700-normal.woff2' },
    ],
  },
  'Atkinson Hyperlegible': {
    pacote: '@fontsource/atkinson-hyperlegible',
    arquivos: [
      { peso: 400, estilo: 'normal', nome: 'atkinson-hyperlegible-latin-400-normal.woff2' },
      { peso: 400, estilo: 'italic', nome: 'atkinson-hyperlegible-latin-400-italic.woff2' },
      { peso: 700, estilo: 'normal', nome: 'atkinson-hyperlegible-latin-700-normal.woff2' },
    ],
  },
};

export function caminhoFonte(familia: string, nome: string): string {
  return arquivoFonte(FONTES_EMBUTIDAS[familia]!.pacote, nome);
}

/** Famílias usadas pela identidade que existem embutidas; as demais caem na fonte do sistema com aviso. */
export function fontesUsadas(config: ConfigProjeto, achados: Achado[], arquivo: string): string[] {
  const usadas = new Set<string>();
  for (const [papel, f] of Object.entries(config.identidade.fontes)) {
    if (FONTES_EMBUTIDAS[f]) usadas.add(f);
    else achados.push({ severidade: 'aviso', codigo: 'identidade/fonte', arquivo, mensagem: `A fonte "${f}" (${papel}) não está embutida no Prumo; a tela usa a fonte do sistema. Disponíveis: ${Object.keys(FONTES_EMBUTIDAS).join(', ')}.` });
  }
  return [...usadas];
}

/** @font-face de uma família embutida (caminhos relativos a _recursos/). */
export function fontFaces(familia: string): string {
  return FONTES_EMBUTIDAS[familia]!.arquivos
    .map((a) => `@font-face{font-family:"${familia}";font-style:${a.estilo};font-weight:${a.peso};font-display:block;src:url("fontes/${a.nome}") format("woff2")}`)
    .join('\n');
}

/** CSS do projeto: @font-face das fontes embutidas + variáveis derivadas dos tokens. */
export function cssDosTokens(config: ConfigProjeto, achados: Achado[], arquivo: string): string {
  const c = config.identidade.cores;
  const pares: [string, string, string][] = [
    ['texto', c.texto, c.fundo],
    ['primaria', c.primaria, c.fundo],
    ['menu_texto', c.menu_texto, c.menu],
    ['erro', c.erro, c.fundo],
  ];
  for (const [nome, frente, fundo] of pares) {
    const r = contraste(frente, fundo);
    if (r < 4.5) achados.push({ severidade: 'aviso', codigo: 'identidade/contraste', arquivo, mensagem: `Contraste de "${nome}" sobre o fundo é ${r}:1; o mínimo é 4,5:1 (WCAG AA).` });
  }
  const familias = fontesUsadas(config, achados, arquivo);
  const faces = familias.flatMap((f) =>
    FONTES_EMBUTIDAS[f]!.arquivos.map(
      (a) => `@font-face{font-family:"${f}";font-style:${a.estilo};font-weight:${a.peso};font-display:block;src:url("fontes/${a.nome}") format("woff2")}`,
    ),
  );
  const pilha = (f: string) => `"${f}", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const vars = {
    '--fundo': c.fundo,
    '--texto': c.texto,
    '--texto-sec': misturar(c.texto, c.fundo, 0.3),
    '--primaria': c.primaria,
    '--primaria-escura': misturar(c.primaria, '#000000', 0.25),
    '--primaria-clara': misturar(c.primaria, '#FFFFFF', 0.9),
    '--menu': c.menu,
    '--menu-2': misturar(c.menu, '#FFFFFF', 0.08),
    '--menu-texto': c.menu_texto,
    '--destaque': c.destaque,
    '--destaque-claro': misturar(c.destaque, '#FFFFFF', 0.8),
    '--erro': c.erro,
    '--erro-claro': misturar(c.erro, '#FFFFFF', 0.9),
    '--sucesso': c.sucesso ?? '#1C7543',
    '--sucesso-claro': misturar(c.sucesso ?? '#1C7543', '#FFFFFF', 0.88),
    '--linha': misturar(c.texto, c.fundo, 0.87),
    '--borda-campo': misturar(c.texto, c.fundo, 0.45),
    '--nevoa': misturar(c.primaria, '#FFFFFF', 0.95),
    '--fonte-titulo': pilha(config.identidade.fontes.titulo),
    '--fonte-texto': pilha(config.identidade.fontes.texto),
    '--container-max': `${config.padroes.container_max}px`,
  };
  return `${faces.join('\n')}\n:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}\n`;
}
