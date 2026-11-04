import type { ConfigProjeto } from '../config/esquema.js';
import { chaveCodigo, type Indice } from '../parser/indice.js';
import type { ArquivoFeature, Filho } from '../parser/tipos.js';
import { extrairLinks } from '../parser/links.js';
import { mesmoTexto, normalizar } from '../util/texto.js';
import type { Campo, Estado, Layout, TipoEstado } from '../modelo/tipos.js';

/** Classifica uma MSG pelo texto (sucesso × erro); `projeto.yml > mensagens` sobrepõe. */
export function classificarMensagem(codigo: string, texto: string | undefined, config: ConfigProjeto): 'erro' | 'sucesso' | 'aviso' {
  const forcado = config.mensagens[codigo];
  if (forcado) return forcado;
  const t = normalizar(texto ?? '');
  if (/nenhum (registro|resultado)|nao (foi|foram) encontrad|sem resultado/.test(t)) return 'aviso';
  return /sucesso|realizad|enviad|salv|conclu|cadastrad|atualizad/.test(t) ? 'sucesso' : 'erro';
}

/** Exemplos (Campo | Exemplo) de um cenário: nome → valor. */
export function exemplosDoFilho(f: Filho): Record<string, string> {
  const ex: Record<string, string> = {};
  for (const p of f.passos) {
    const t = p.tabela;
    if (!t) continue;
    const iCampo = t.cabecalho.findIndex((h) => /^campo$/i.test(h));
    const iEx = t.cabecalho.findIndex((h) => /^(exemplo|valor)$/i.test(h));
    if (iCampo < 0 || iEx < 0) continue;
    for (const l of t.linhas) if (l.celulas[iCampo]) ex[l.celulas[iCampo]!] = l.celulas[iEx] ?? '';
  }
  return ex;
}

/** RN-20: um estado por cenário com MSG, mais vazio (listagem) e sem permissão. */
export function estadosDaTela(arquivo: ArquivoFeature, layout: Layout, campos: Campo[], indice: Indice, config: ConfigProjeto): Estado[] {
  const principal = arquivo.filhos.find((f) => f.tags.includes('@fluxo-principal'));
  const estados: Estado[] = [{
    id: 'padrao',
    tipo: 'padrao',
    cenario: principal ? { posicao: principal.posicao, titulo: principal.titulo } : undefined,
    exemplos: principal ? exemplosDoFilho(principal) : {},
  }];

  for (const f of arquivo.filhos) {
    if (f.tipo === 'Contexto' || f.tags.includes('@prototipo')) continue;
    const textos = f.passos.map((p) => p.texto);
    const msg = textos
      .flatMap((t) => extrairLinks(t, { arquivo: arquivo.relativo, linha: 0 }))
      .map((l) => chaveCodigo(l.rotulo))
      .find((c) => c?.tipo === 'MSG');
    const semPermissao = textos.some((t) => /n[ãa]o permitid|sem permiss[ãa]o/i.test(t));
    if (!msg && !semPermissao) continue;

    if (msg) {
      const ref = indice.porCodigo.get(msg.chave)?.[0];
      const tipo: TipoEstado = classificarMensagem(msg.chave, ref?.texto, config);
      const passoComMsg = f.passos.find((p) => p.texto.includes(msg.codigo) || new RegExp(msg.chave).test(p.texto)) ?? f.passos[f.passos.length - 1];
      const todos = textos.join(' ');
      // O campo citado primeiro no cenário (em negrito ou depois de "campo") recebe a mensagem.
      const citados = campos
        .map((c) => ({ c, i: todos.search(new RegExp(`(?:campo\\s+)?\\*\\*${escapar(c.nome)}\\*\\*|campo\\s+${escapar(c.nome)}\\b`, 'i')) }))
        .filter((x) => x.i >= 0)
        .sort((a, b) => a.i - b.i);
      const campo = citados[0]?.c ?? campos.find((c) => c.editavel && passoComMsg && mesmoTextoContido(c.nome, passoComMsg.texto));
      estados.push({
        id: `${tipo}-${f.posicao}`,
        tipo,
        cenario: { posicao: f.posicao, titulo: f.titulo },
        mensagem: {
          codigo: msg.chave,
          texto: ref?.texto ?? msg.codigo,
          local: tipo === 'erro' && campo ? 'campo' : 'topo',
          campo: tipo === 'erro' && campo ? campo.id : undefined,
        },
        exemplos: { ...estados[0]!.exemplos, ...exemplosDoFilho(f) },
      });
    } else {
      estados.push({ id: `sem-permissao-${f.posicao}`, tipo: 'sem-permissao', cenario: { posicao: f.posicao, titulo: f.titulo }, exemplos: {} });
    }
  }
  if (layout === 'listagem') estados.push({ id: 'vazio', tipo: 'vazio', exemplos: estados[0]!.exemplos });
  return estados;
}

function escapar(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mesmoTextoContido(nome: string, texto: string): boolean {
  const n = normalizar(nome);
  return n.length > 2 && normalizar(texto).includes(n) && !mesmoTexto(nome, texto);
}
