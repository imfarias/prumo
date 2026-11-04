import { diffArrays } from 'diff';
import { isMap, parseDocument, type Document } from 'yaml';
import { ErroPrumo } from '../util/erros.js';

export type Caminho = (string | number)[];
export interface Mudanca {
  caminho: Caminho;
  valor?: unknown;
  remover?: boolean;
}
export interface LinhaDiff {
  tipo: 'igual' | 'incluida' | 'removida';
  texto: string;
}

const OPCOES = { lineWidth: 0 } as const;

function aplicar(doc: Document, mudancas: Mudanca[]) {
  for (const m of mudancas) {
    if (m.remover) {
      if (doc.hasIn(m.caminho)) doc.deleteIn(m.caminho);
      continue;
    }
    // Cria mapas intermediários que não existem (ex.: documentacao.comparar_com).
    for (let i = 1; i < m.caminho.length; i++) {
      const parcial = m.caminho.slice(0, i);
      if (!doc.hasIn(parcial)) doc.setIn(parcial, doc.createNode({}));
      else if (!isMap(doc.getIn(parcial, true)) && typeof m.caminho[i] === 'string') {
        throw new ErroPrumo('YAML', `Não dá para gravar ${m.caminho.join('.')}: ${parcial.join('.')} não é um bloco de chaves.`);
      }
    }
    doc.setIn(m.caminho, m.valor);
  }
}

/**
 * Edita um YAML mudando só as linhas das chaves alteradas (RN-74): comentários, ordem, aspas e o estilo
 * das linhas não tocadas ficam como estavam. Devolve o texto novo e o diff por linha para mostrar antes de gravar.
 */
export function editarYaml(original: string, mudancas: Mudanca[]): { texto: string; diff: LinhaDiff[]; mudou: boolean } {
  const semBom = original.replace(/^﻿/, '');
  const fim = semBom.includes('\r\n') ? '\r\n' : '\n';
  const linhasOrig = semBom.replace(/\r\n/g, '\n').split('\n');
  const doc = parseDocument(semBom, { keepSourceTokens: false });
  if (doc.errors.length) throw new ErroPrumo('CLI-03', `YAML inválido na linha ${doc.errors[0]!.linePos?.[0]?.line ?? 0}: ${doc.errors[0]!.message.split('\n')[0]}`);
  const antes = doc.toString(OPCOES).split('\n');
  aplicar(doc, mudancas);
  const depois = doc.toString(OPCOES).split('\n');

  let texto: string[];
  if (antes.length === linhasOrig.length || (antes.length === linhasOrig.length + 1 && antes.at(-1) === '')) {
    // A serialização do documento intacto alinha linha a linha com o original: troca só os trechos que mudaram.
    texto = [];
    let i = 0;
    for (const parte of diffArrays(antes, depois)) {
      if (parte.removed) {
        i += parte.value.length;
        continue;
      }
      if (parte.added) {
        texto.push(...parte.value);
        continue;
      }
      for (let k = 0; k < parte.value.length; k++) texto.push(linhasOrig[i + k] ?? parte.value[k]!);
      i += parte.value.length;
    }
  } else {
    texto = depois;
  }
  while (texto.length > 1 && texto.at(-1) === '' && texto.at(-2) === '') texto.pop();
  if (linhasOrig.at(-1) === '' && texto.at(-1) !== '') texto.push('');

  const diff: LinhaDiff[] = [];
  for (const p of diffArrays(linhasOrig, texto)) {
    for (const t of p.value) diff.push({ tipo: p.added ? 'incluida' : p.removed ? 'removida' : 'igual', texto: t });
  }
  const resultado = texto.join(fim);
  return { texto: resultado, diff, mudou: resultado !== semBom };
}
