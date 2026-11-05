import type { Achado } from '../config/esquema.js';
import type { ArquivoFeature, Filho } from '../parser/tipos.js';
import { normalizar, slug, tituloDeArquivo } from '../util/texto.js';
import type { Acao, Estado, Tela } from '../modelo/tipos.js';
import { detectarAcoes } from './acoes.js';

/** Ações de linha de tabela (Visualizar, Editar…): o destino é a tela da mesma entidade (RN-83). */
export const RE_ACAO_DE_LINHA = /^(analisar|visualizar|ver|editar|alterar|excluir|remover|ativar|desativar|inativar|detalhar|abrir|gerenciar|acessar)\b/;
/** Ações que agem na própria tela (filtros, paginação) e não precisam de destino. */
const LOCAIS = /^(filtrar|limpar|pesquisar|buscar|consultar|voltar|cancelar|fechar|anterior|proxim|imprimir|exportar)/;

/** Ação acionada num cenário (RN-84): a primeira detectada nos passos, que exista na tela. */
export function acaoDoCenario(filho: Filho, acoes: Acao[]): Acao | undefined {
  for (const p of filho.passos) {
    for (const rotulo of detectarAcoes(p.texto)) {
      const a = acoes.find((x) => x.id === slug(rotulo) || normalizar(x.rotulo) === normalizar(rotulo));
      if (a) return a;
    }
  }
  return undefined;
}

/** Destino "o sistema exibe **Título**" no passo seguinte ao que aciona a ação (RN-83). */
export function destinoExibido(filho: Filho, acao: Acao, telas: { nome: string }[]): string | undefined {
  const i = filho.passos.findIndex((p) => detectarAcoes(p.texto).some((r) => slug(r) === acao.id));
  if (i < 0) return undefined;
  const seguinte = filho.passos[i + 1]?.texto ?? '';
  const m = /\b(?:exibe|apresenta|abre|mostra|direciona(?:do)?\s+para)\s+(?:a\s+(?:tela|p[áa]gina)\s+(?:de\s+)?)?\*\*([^*]+)\*\*/i.exec(seguinte);
  if (!m) return undefined;
  const alvo = normalizar(m[1]!);
  return telas.find((t) => normalizar(tituloDeArquivo(t.nome)) === alvo || normalizar(tituloDeArquivo(t.nome)).endsWith(` ${alvo}`))?.nome;
}

/** Entidade de uma listagem: o título sem "Lista de", "Gestão de", "Consultar"… */
function entidade(titulo: string): string {
  return normalizar(titulo).replace(/^(lista|listagem|gestao|consulta|consultar|pesquisa|pesquisar|manter)( de| das| dos| da| do)?\s+/, '').replace(/s$/, '');
}

/**
 * Liga ações, estados e telas (RN-83, RN-84):
 * - `Estado.acao` pela ação acionada no cenário;
 * - `Acao.fluxo` com o primeiro sucesso e os erros/avisos em ordem;
 * - destino pelo "exibe **Título**", por ação de linha e pelo override `destino: estado:{id}`.
 */
export function ligarFluxos(telas: Tela[], arquivos: Map<string, ArquivoFeature>, achados: Achado[]): void {
  for (const t of telas) {
    const a = arquivos.get(t.id);
    const principal = t.acoes.find((x) => x.primaria && !LOCAIS.test(normalizar(x.rotulo)));
    for (const e of t.estados) {
      // O estado padrão vem do cenário principal; só erro, aviso e sucesso são resultado de uma ação.
      if (!e.cenario || !a || !['erro', 'aviso', 'sucesso'].includes(e.tipo)) continue;
      const filho = a.filhos.find((f) => f.posicao === e.cenario!.posicao);
      // Cenário sem "aciona **X**" (ex.: "informa um valor diferente"): o resultado aparece ao acionar a ação principal.
      const acao = (filho ? acaoDoCenario(filho, t.acoes) : undefined) ?? (e.tipo === 'erro' ? principal : undefined);
      if (acao) e.acao = acao.id;
    }
    for (const acao of t.acoes) {
      if (acao.destino?.startsWith('estado:')) {
        const id = acao.destino.slice('estado:'.length);
        acao.destino = undefined;
        const e = t.estados.find((x) => x.id === id);
        if (e) {
          acao.fluxo = { sucesso: e.tipo === 'sucesso' ? e.id : undefined, erros: e.tipo === 'erro' ? [e.id] : [], avisos: e.tipo === 'aviso' ? [e.id] : [] };
          acao.sinal = { regra: 'override', descricao: `destino: estado ${id}` };
        }
        continue;
      }
      const produzidos = t.estados.filter((e) => e.acao === acao.id);
      const sucessos = produzidos.filter((e) => e.tipo === 'sucesso');
      if (produzidos.length) {
        acao.fluxo = { sucesso: sucessos[0]?.id, erros: produzidos.filter((e) => e.tipo === 'erro').map((e) => e.id), avisos: produzidos.filter((e) => e.tipo === 'aviso').map((e) => e.id) };
        acao.sinal = { regra: 'RN-84', descricao: `cenários que acionam **${acao.rotulo}** → ${produzidos.map((e) => e.id).join(', ')}` };
        if (sucessos.length > 1) {
          achados.push({ severidade: 'aviso', codigo: 'prototipo/varios-sucessos', arquivo: acao.origem.arquivo, linha: acao.origem.linha, mensagem: `${sucessos.length} cenários de sucesso para ${acao.rotulo} em ${t.titulo}; o protótipo usa o primeiro.` });
        }
      }
      if (!acao.destino && a) {
        for (const f of a.filhos) {
          const d = destinoExibido(f, acao, [...arquivos.values()].map((x) => ({ nome: x.nome })));
          if (d && d !== t.id) {
            acao.destino = d;
            acao.sinal ??= { regra: 'RN-83', descricao: `"exibe **${tituloDeArquivo(d)}**" depois de acionar **${acao.rotulo}**`, origem: { arquivo: a.relativo, linha: f.linha } };
            break;
          }
        }
      }
      if (!acao.destino && RE_ACAO_DE_LINHA.test(normalizar(acao.rotulo))) {
        const ent = entidade(t.titulo);
        const quer = /^(editar|alterar)/.test(normalizar(acao.rotulo)) ? 'formulario' : 'leitura';
        const alvo = telas.find((x) => x.id !== t.id && x.modulo === t.modulo && x.layout === quer && ent && normalizar(x.titulo).includes(ent))
          ?? telas.find((x) => x.id !== t.id && x.modulo === t.modulo && ent && normalizar(x.titulo).includes(ent) && x.layout !== 'listagem');
        if (alvo) {
          acao.destino = alvo.id;
          acao.sinal ??= { regra: 'RN-83', descricao: `ação de linha **${acao.rotulo}** → tela de ${quer} "${alvo.titulo}"` };
        }
      }
      if (!acao.destino && !acao.fluxo && !LOCAIS.test(normalizar(acao.rotulo))) {
        achados.push({ severidade: 'info', codigo: 'prototipo/acao-sem-destino', arquivo: acao.origem.arquivo, linha: acao.origem.linha, mensagem: `A ação ${acao.rotulo} de ${t.titulo} não leva a nenhuma tela nem estado descrito.` });
      }
    }
  }
}
