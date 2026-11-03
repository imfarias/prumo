import type { ConfigProjeto } from '../config/esquema.js';
import type { Indice } from '../parser/indice.js';
import { normalizar } from '../util/texto.js';
import type { Campo, Componente, Sinal } from '../modelo/tipos.js';

/** Decisão de componente com o sinal que a justifica. */
export interface Decisao {
  componente: Componente;
  sinal: Sinal;
  mascara?: Campo['mascara'];
  opcoes?: string[];
}

const palavra = (n: string, re: RegExp) => re.test(n);

/** Chave de máscara do projeto.yml que casa com o nome do campo (palavra inteira, sem acento). */
export function mascaraPorNome(nome: string, config: ConfigProjeto): { chave: string; mascara: Campo['mascara'] } | undefined {
  const n = normalizar(nome);
  const chaves = Object.keys(config.mascaras).sort((a, b) => b.length - a.length);
  for (const chave of chaves) {
    const k = normalizar(chave).replace(/[^a-z0-9]+/g, ' ').trim();
    if (new RegExp(`(^|[^a-z0-9])${k.replace(/ /g, '[^a-z0-9]+')}($|[^a-z0-9])`).test(n)) return { chave, mascara: config.mascaras[chave] };
  }
  if (palavra(n, /\b(telefone|celular|fax)\b/) && config.mascaras.Fone) return { chave: 'Fone', mascara: config.mascaras.Fone };
  return undefined;
}

/**
 * Regras RN-13 a RN-19, na ordem de precedência do desenho técnico (seção 6, passo 4).
 * Devolve `undefined` quando nenhuma regra resolve (FA-07).
 */
export function decidirComponente(campo: Pick<Campo, 'nome' | 'editavel' | 'regras' | 'regraTexto' | 'origem'>, indice: Indice, config: ConfigProjeto): Decisao | undefined {
  const n = normalizar(campo.nome);
  const regraTexto = normalizar(campo.regraTexto ?? '');
  const origem = campo.origem;

  const lov = campo.regras.find((r) => r.codigo?.startsWith('LOV-'));
  if (!campo.editavel) {
    const opcoes = lov ? indice.porCodigo.get(lov.codigo!)?.[0]?.opcoes : undefined;
    return {
      componente: 'leitura',
      opcoes: opcoes?.length ? opcoes : undefined,
      sinal: { regra: 'RN-13', descricao: `Editável = N → valor só leitura${opcoes?.length ? ` (valores da ${lov!.codigo})` : ''}`, origem },
    };
  }

  const ehDocumentos = palavra(n, /\b(documentos?|anexos?|arquivos?)\b/);
  if (lov && ehDocumentos) {
    const ref = indice.porCodigo.get(lov.codigo!)?.[0];
    return {
      componente: 'arquivos',
      opcoes: ref?.opcoes?.length ? ref.opcoes : undefined,
      sinal: { regra: 'RN-19', descricao: `documentos com a regra ${lov.codigo} → lista de arquivos com os itens da lista`, origem },
    };
  }
  if (lov) {
    const ref = indice.porCodigo.get(lov.codigo!)?.[0];
    return {
      componente: 'selecao',
      opcoes: ref?.opcoes?.length ? ref.opcoes : undefined,
      sinal: { regra: 'RN-14', descricao: `regra ${lov.codigo} → seleção${ref?.opcoes?.length ? ` com ${ref.opcoes.length} opções da lista` : ' (a LOV não tem tabela de opções)'}`, origem },
    };
  }

  if (/^(confirme|confirmacao de|confirmar)\b/.test(n)) {
    return { componente: 'confirmacao', sinal: { regra: 'RN-16', descricao: 'nome começa com "Confirme" → campo de confirmação', origem } };
  }

  if (palavra(n, /autoriz|declar|veracidade|aceite|concordo|termo de/) || palavra(regraTexto, /veracidade|declaracao/)) {
    return { componente: 'caixa', sinal: { regra: 'RN-17', descricao: 'texto de autorização/declaração → caixa de seleção', origem } };
  }

  if (palavra(n, /codigo verificador|captcha/)) {
    return { componente: 'captcha', sinal: { regra: 'RN-18', descricao: '"Código verificador" → captcha', origem } };
  }

  if (ehDocumentos) {
    return { componente: 'arquivos', sinal: { regra: 'RN-19', descricao: 'documentos/anexos → lista de arquivos com envio de PDF', origem } };
  }

  if (palavra(n, /\bsenha\b/)) {
    return { componente: 'senha', sinal: { regra: 'RN-15', descricao: 'nome contém "Senha" → campo de senha', origem } };
  }

  const m = mascaraPorNome(campo.nome, config);
  if (m) {
    const tipo: Componente = /fone|fax|telefone|celular/i.test(m.chave) ? 'tel' : 'mascara';
    const motivo = tipo === 'tel' ? 'nome indica telefone' : `nome contém ${m.chave}`;
    return { componente: tipo, mascara: m.mascara, sinal: { regra: 'RN-15', descricao: `${motivo} → máscara ${Array.isArray(m.mascara) ? m.mascara.join(' ou ') : m.mascara}`, origem } };
  }
  if (palavra(n, /e-?mail/)) return { componente: 'email', sinal: { regra: 'RN-15', descricao: 'nome contém E-mail → campo de e-mail', origem } };
  if (palavra(n, /\b(data|periodo|nascimento|inicio|termino|vencimento|validade|emissao)\b/)) {
    return { componente: 'data', sinal: { regra: 'RN-15', descricao: 'nome indica data → campo de data', origem } };
  }
  if (palavra(n, /\b(valor|salario|preco)\b/)) return { componente: 'valor', sinal: { regra: 'RN-15', descricao: 'nome contém Valor → campo monetário', origem } };
  if (palavra(n, /\b(quantidade|qtd|numero de)\b/)) return { componente: 'numero', sinal: { regra: 'RN-15', descricao: 'nome indica quantidade → campo numérico', origem } };
  if (palavra(n, /\b(mensagem|descricao|justificativa|observac|comentario)/)) {
    return { componente: 'texto-longo', sinal: { regra: 'RN-15', descricao: 'nome indica texto livre → área de texto', origem } };
  }
  return undefined;
}
