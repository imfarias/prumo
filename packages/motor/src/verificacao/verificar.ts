import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Achado, ConfigProjeto } from '../config/esquema.js';
import { confereMascara } from '../dados/mascara.js';
import { chaveCodigo, type Indice } from '../parser/indice.js';
import type { ArquivoFeature, Origem } from '../parser/tipos.js';
import { classificarTabela, ehArquivoDeApoio, filhoPrototipo } from '../modelo/montar.js';
import type { ModeloTelas } from '../modelo/tipos.js';
import { mesmoTexto } from '../util/texto.js';

export interface EntradaVerificacao {
  arquivos: ArquivoFeature[];
  indice: Indice;
  modelo: ModeloTelas;
  config: ConfigProjeto;
  achadosAnteriores?: Achado[]; // sintaxe, configuração, inferência
}

const RE_CODIGO_TEXTO = /\b(?:RNG|LOV|MSG)\s*-\s*\d+\b|\bE-?mail\s*-\s*\d+\b/gi;

/** Todo texto livre de um arquivo com a linha: descrições, passos, células e exemplos. */
function* textos(a: ArquivoFeature): Generator<{ texto: string; linha: number }> {
  yield* linhas(a.descricao, a.linha + 1);
  for (const f of a.filhos) {
    yield* linhas(f.descricao, f.linha + 1);
    for (const p of f.passos) {
      yield { texto: p.texto, linha: p.linha };
      for (const l of p.tabela?.linhas ?? []) for (const c of l.celulas) yield { texto: c, linha: l.linha };
    }
    for (const t of f.exemplos) for (const l of t.linhas) for (const c of l.celulas) yield { texto: c, linha: l.linha };
  }
}

function* linhas(texto: string, inicio: number) {
  if (!texto) return;
  let i = 0;
  for (const t of texto.split('\n')) yield { texto: t, linha: inicio + i++ };
}

function intervalo(a: ArquivoFeature): string {
  return a.filhos.length ? `0–${a.filhos.length - 1}` : 'nenhum cenário';
}

/** Lint dos requisitos (RN-30 a RN-42). Devolve os achados ordenados por arquivo e linha. */
export function verificar(e: EntradaVerificacao, specs: string): Achado[] {
  const { arquivos, indice, modelo, config } = e;
  const achados: Achado[] = [...(e.achadosAnteriores ?? [])];
  const add = (severidade: Achado['severidade'], codigo: string, o: Origem, mensagem: string, sugestao?: string) =>
    achados.push({ severidade, codigo, arquivo: o.arquivo, linha: o.linha, coluna: o.coluna, mensagem, ...(sugestao ? { sugestao } : {}) });

  // RN-30, RN-31, RN-32 — links.
  for (const a of arquivos) {
    for (const l of a.links) {
      if (l.tipo === 'feature') {
        if (!indice.porFeature.has(l.endereco)) {
          add('erro', 'link/feature-inexistente', l.origem, `Link para a funcionalidade inexistente #${l.alvo}.`, sugerirFeature(l.endereco, indice));
        }
        continue;
      }
      const alvo = indice.porFeature.get(l.endereco);
      const codigo = chaveCodigo(l.rotulo);
      const correto = codigo ? indice.porCodigo.get(codigo.chave)?.[0] : undefined;
      const dica = correto ? `${l.rotulo} está em #/scenario/${correto.endereco}.` : undefined;
      if (!alvo) {
        add('erro', 'link/cenario-inexistente', l.origem, `Link [${l.rotulo}] para o arquivo inexistente "${l.endereco}".`, dica);
        continue;
      }
      if (l.posicao === undefined || !indice.porEndereco.has(`${l.endereco}/${l.posicao}`)) {
        add('erro', 'link/cenario-inexistente', l.origem, `Link [${l.rotulo}] para a posição ${l.posicao ?? '?'}, fora do intervalo do arquivo (${intervalo(alvo)}).`, dica);
        continue;
      }
      if (codigo) {
        const destino = indice.porEndereco.get(`${l.endereco}/${l.posicao}`)!.filho;
        const codDestino = chaveCodigo(destino.titulo);
        if (!codDestino || codDestino.chave !== codigo.chave) {
          add('erro', 'link/rotulo-divergente', l.origem, `Link [${l.rotulo}] aponta para "${destino.titulo}" (/${l.posicao}).`, dica);
        }
      }
    }
  }

  // RN-33, RN-34 — códigos citados × definidos.
  const citados = new Map<string, Origem[]>();
  for (const a of arquivos) {
    for (const { texto, linha } of textos(a)) {
      for (const m of texto.matchAll(RE_CODIGO_TEXTO)) {
        const c = chaveCodigo(m[0]);
        if (!c) continue;
        const lista = citados.get(c.chave) ?? [];
        lista.push({ arquivo: a.relativo, linha, coluna: (m.index ?? 0) + 1 });
        citados.set(c.chave, lista);
      }
    }
  }
  for (const [chave, origens] of citados) {
    if (indice.porCodigo.has(chave)) continue;
    for (const o of origens) add('erro', 'ref/inexistente', o, `${chave} é citado mas não está definido nas regras ou mensagens.`);
  }
  for (const r of indice.referencias) {
    const usos = (citados.get(r.chave) ?? []).filter((o) => !(o.arquivo === r.origem.arquivo && o.linha === r.origem.linha));
    if (!usos.length) add('aviso', 'ref/nao-usada', r.origem, `${r.codigo} está definido e não é citado em nenhuma funcionalidade.`);
  }

  // RN-35 — duplicados.
  for (const [chave, lista] of indice.porCodigo) {
    if (lista.length < 2) continue;
    for (const r of lista.slice(1)) add('erro', 'ref/duplicada', r.origem, `${chave} definido mais de uma vez (primeira definição em ${lista[0]!.origem.arquivo}:${lista[0]!.origem.linha}).`);
  }

  // RN-36, RN-37, RN-39 — a partir do modelo.
  for (const t of modelo.telas) {
    const arquivo = arquivos.find((a) => a.nome === t.id && a.relativo === t.origem.arquivo)!;
    const todos = [...t.filtros, ...t.campos, ...t.colunas];
    if (config.verificacao.exigir_regra_em_editavel) {
      for (const c of todos) {
        if (c.editavel && !c.regras.length && !c.regraTexto) add('aviso', 'campo/sem-regra', c.origem, `Campo editável "${c.nome}" sem regra.`);
      }
    }
    for (const f of arquivo.filhos) {
      for (const p of f.passos) {
        if (!p.tabela || classificarTabela(p.tabela) !== 'exemplo') continue;
        const iCampo = p.tabela.cabecalho.findIndex((h) => /^campo$/i.test(h));
        const iEx = p.tabela.cabecalho.findIndex((h) => /^(exemplo|valor)$/i.test(h));
        for (const l of p.tabela.linhas) {
          const campo = todos.find((c) => mesmoTexto(c.nome, l.celulas[iCampo] ?? ''));
          const valor = (l.celulas[iEx] ?? '').trim();
          if (!campo?.mascara || !valor || valor === '-') continue;
          if (!confereMascara(campo.mascara, valor)) {
            const m = Array.isArray(campo.mascara) ? campo.mascara.join(' ou ') : campo.mascara;
            add('erro', 'exemplo/mascara', { arquivo: arquivo.relativo, linha: l.linha }, `Exemplo "${valor}" do campo "${campo.nome}" não bate com a máscara ${m}.`);
          }
        }
      }
    }
    for (const acao of t.acoes) {
      if (acao.destino?.startsWith('?')) add('erro', 'acao/destino-inexistente', acao.origem, `A ação "${acao.rotulo}" leva à funcionalidade "${acao.destino.slice(1)}", que não existe.`);
      else if (acao.destino && !modelo.telas.some((x) => x.id === acao.destino)) add('erro', 'acao/destino-inexistente', acao.origem, `A ação "${acao.rotulo}" leva à tela "${acao.destino}", que não tem protótipo.`);
    }
  }

  // RN-38, RN-40, RN-41 — por arquivo de tela.
  for (const a of arquivos) {
    if (ehArquivoDeApoio(a, config)) continue;
    const origem = { arquivo: a.relativo, linha: a.linha };
    if (!a.filhos.some((f) => f.tags.includes('@fluxo-principal'))) add('aviso', 'fluxo/sem-principal', origem, 'Funcionalidade sem cenário @fluxo-principal.');
    if (!filhoPrototipo(a)) add('aviso', 'prototipo/ausente', origem, 'Funcionalidade sem cenário @prototipo; não gera tela.');
    for (const img of a.imagens) {
      if (/^[a-z]+:/i.test(img.alvo)) continue;
      const caminho = path.resolve(path.dirname(a.caminho), img.alvo);
      if (!existsSync(caminho)) add('erro', 'prototipo/imagem-inexistente', img.origem, `Imagem "${img.alvo}" não encontrada. Rode \`prumo capturar\` para gerá-la.`);
    }
  }

  // Severidade configurável por código.
  for (const a of achados) {
    const s = config.verificacao.severidades[a.codigo];
    if (s) a.severidade = s;
  }
  void specs;
  return ordenar(achados);
}

function sugerirFeature(endereco: string, indice: Indice): string | undefined {
  const fim = endereco.split('_').slice(-2).join('_');
  const parecida = [...indice.porFeature.keys()].find((k) => k.endsWith(fim));
  return parecida ? `Você quis dizer #!/feature/${parecida}?` : undefined;
}

export function ordenar(achados: Achado[]): Achado[] {
  const peso = { erro: 0, aviso: 1, info: 2 } as const;
  return achados.sort(
    (a, b) =>
      (a.arquivo < b.arquivo ? -1 : a.arquivo > b.arquivo ? 1 : 0) ||
      (a.linha ?? 0) - (b.linha ?? 0) ||
      peso[a.severidade] - peso[b.severidade] ||
      (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0),
  );
}
