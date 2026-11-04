/**
 * Lista fechada de canais entre a janela e o processo principal (RN-72), com a validação da forma dos dados.
 * Qualquer canal fora daqui é recusado no preload e de novo no principal.
 */

export class ErroCanal extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroCanal';
  }
}

type Validador<T> = (d: unknown) => T;

const obj = (d: unknown): Record<string, unknown> => {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new ErroCanal('dados devem ser um objeto');
  return d as Record<string, unknown>;
};
const texto = (v: unknown, nome: string, max = 4096): string => {
  if (typeof v !== 'string' || v.length > max) throw new ErroCanal(`${nome} deve ser texto`);
  return v;
};
const textoOpc = (v: unknown, nome: string) => (v === undefined ? undefined : texto(v, nome));
const nada: Validador<undefined> = (d) => {
  if (d !== undefined && d !== null) throw new ErroCanal('este canal não recebe dados');
  return undefined;
};
const listaTextos = (v: unknown, nome: string): string[] | undefined => {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > 500 || v.some((x) => typeof x !== 'string')) throw new ErroCanal(`${nome} deve ser lista de textos`);
  return v as string[];
};
const um = <T extends string>(v: unknown, nome: string, opcoes: readonly T[]): T => {
  if (!opcoes.includes(v as T)) throw new ErroCanal(`${nome} inválido`);
  return v as T;
};
const caminhoYaml = (v: unknown): (string | number)[] => {
  if (!Array.isArray(v) || !v.length || v.length > 12 || v.some((x) => typeof x !== 'string' && typeof x !== 'number')) throw new ErroCanal('caminho inválido');
  return v as (string | number)[];
};
const mudancas = (v: unknown) => {
  if (!Array.isArray(v) || v.length > 200) throw new ErroCanal('mudancas deve ser lista');
  return v.map((m) => {
    const o = obj(m);
    return { caminho: caminhoYaml(o.caminho), valor: o.valor, remover: o.remover === true ? true : undefined };
  });
};

export const TIPOS_TAREFA = ['verificar', 'gerar', 'capturar', 'comparar-png', 'docs', 'pdf', 'comparar'] as const;

export const CANAIS = {
  'projeto:abrirDialogo': nada,
  'projeto:abrir': (d: unknown) => ({ caminho: texto(obj(d).caminho, 'caminho') }),
  'projeto:criar': (d: unknown) => {
    const o = obj(d);
    return { pasta: texto(o.pasta, 'pasta'), nome: texto(o.nome, 'nome', 80), versao: texto(o.versao, 'versao', 40), orgao: textoOpc(o.orgao, 'orgao') };
  },
  'projeto:atual': nada,
  'projeto:recentes': nada,
  'projeto:esquecer': (d: unknown) => ({ caminho: texto(obj(d).caminho, 'caminho') }),
  'config:ler': (d: unknown) => ({ arquivo: um(obj(d).arquivo, 'arquivo', ['projeto.yml', 'telas.overrides.yml'] as const) }),
  'config:previa': (d: unknown) => {
    const o = obj(d);
    return { arquivo: um(o.arquivo, 'arquivo', ['projeto.yml', 'telas.overrides.yml'] as const), mudancas: mudancas(o.mudancas) };
  },
  'config:salvar': (d: unknown) => {
    const o = obj(d);
    return { arquivo: um(o.arquivo, 'arquivo', ['projeto.yml', 'telas.overrides.yml'] as const), mudancas: mudancas(o.mudancas), base: texto(o.base, 'base', 2_000_000) };
  },
  'config:criarProjetoYml': nada,
  'tarefa:iniciar': (d: unknown) => {
    const o = obj(d);
    const tipo = um(o.tipo, 'tipo', TIPOS_TAREFA);
    const p = o.parametros === undefined ? {} : obj(o.parametros);
    return {
      tipo,
      parametros: {
        modulos: listaTextos(p.modulos, 'modulos'),
        telas: listaTextos(p.telas, 'telas'),
        saida: textoOpc(p.saida, 'saida'),
        arquivoUnico: p.arquivoUnico === undefined ? undefined : p.arquivoUnico === true,
        orientacao: p.orientacao === undefined ? undefined : um(p.orientacao, 'orientacao', ['retrato', 'paisagem'] as const),
        soMudancas: p.soMudancas === true ? true : undefined,
        comparar: textoOpc(p.comparar, 'comparar'),
        forcar: p.forcar === true ? true : undefined,
      },
    };
  },
  'tarefa:cancelar': (d: unknown) => ({ id: texto(obj(d).id, 'id', 64) }),
  'verificacao:abrirNoEditor': (d: unknown) => {
    const o = obj(d);
    const linha = o.linha === undefined ? undefined : Number(o.linha);
    if (linha !== undefined && (!Number.isInteger(linha) || linha < 0)) throw new ErroCanal('linha inválida');
    return { arquivo: texto(o.arquivo, 'arquivo'), linha };
  },
  'verificacao:exportar': nada,
  'prototipos:listar': nada,
  'docs:abrirNoNavegador': (d: unknown) => ({ alvo: um(obj(d).alvo, 'alvo', ['docs', 'prototipos', 'comparacao'] as const) }),
  'sistema:abrirPasta': (d: unknown) => ({ alvo: um(obj(d).alvo, 'alvo', ['specs', 'docs', 'prototipos', 'comparacao', 'pdf', 'registro'] as const) }),
  'sistema:abrirArquivo': (d: unknown) => ({ alvo: um(obj(d).alvo, 'alvo', ['pdf', 'projeto.yml', 'telas.overrides.yml'] as const) }),
  'sistema:escolherPasta': (d: unknown) => ({ titulo: texto(obj(d ?? {}).titulo ?? 'Escolha uma pasta', 'titulo', 200) }),
  'sistema:escolherArquivo': (d: unknown) => {
    const o = obj(d);
    return { titulo: texto(o.titulo ?? 'Escolha um arquivo', 'titulo', 200), extensoes: listaTextos(o.extensoes, 'extensoes') ?? [] };
  },
  'sistema:salvarComo': (d: unknown) => ({ nome: texto(obj(d).nome, 'nome', 200) }),
  'sistema:abrirLink': (d: unknown) => {
    const url = texto(obj(d).url, 'url', 2000);
    if (!/^https:\/\//.test(url)) throw new ErroCanal('só links https');
    return { url };
  },
  'comparar:refs': nada,
  'prefs:ler': nada,
  'prefs:salvar': (d: unknown) => {
    const o = obj(d);
    const saida: Record<string, unknown> = {};
    if (o.previaAoVivo !== undefined) saida.previaAoVivo = o.previaAoVivo === true;
    if (o.tema !== undefined) saida.tema = um(o.tema, 'tema', ['sistema', 'claro', 'escuro'] as const);
    if (o.editor !== undefined) {
      if (o.editor === 'vscode' || o.editor === 'sistema') saida.editor = o.editor;
      else {
        const e = obj(o.editor);
        saida.editor = { executavel: texto(e.executavel, 'executavel'), argumentos: listaTextos(e.argumentos, 'argumentos') ?? ['{arquivo}'] };
      }
    }
    if (o.atualizacaoLigada !== undefined) saida.atualizacaoLigada = o.atualizacaoLigada === true;
    if (o.menuContexto !== undefined) saida.menuContexto = o.menuContexto === true;
    return saida;
  },
  'atualizacao:verificar': nada,
  'atualizacao:baixar': nada,
  'atualizacao:instalar': nada,
  'atualizacao:lembrarDepois': nada,
  'sobre:ler': nada,
} as const;

export type Canal = keyof typeof CANAIS;
export type DadosDe<C extends Canal> = ReturnType<(typeof CANAIS)[C]>;

export const EVENTOS = ['tarefa:andamento', 'tarefa:fim', 'previa:atualizada', 'projeto:mudouNoDisco', 'projeto:aberto', 'atualizacao:disponivel', 'projeto:abrirPedido'] as const;
export type Evento = (typeof EVENTOS)[number];

export function validar<C extends Canal>(canal: C, dados: unknown): DadosDe<C> {
  const v = (CANAIS as Record<string, Validador<unknown>>)[canal];
  if (!v) throw new ErroCanal(`canal desconhecido: ${String(canal)}`);
  return v(dados) as DadosDe<C>;
}

export const ehCanal = (c: unknown): c is Canal => typeof c === 'string' && Object.prototype.hasOwnProperty.call(CANAIS, c);
export const ehEvento = (e: unknown): e is Evento => typeof e === 'string' && (EVENTOS as readonly string[]).includes(e);
