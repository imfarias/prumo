import { sorteador } from '../util/hash.js';
import { normalizar } from '../util/texto.js';
import { aplicarMascara, type Mascara } from './mascara.js';
import { cnpjDe12, cpf } from './documentos.js';

/**
 * Dados fictícios determinísticos para o que a feature não exemplifica.
 * Nunca usa nomes de pessoas reais: combina palavras genéricas e termina com o sufixo do projeto.
 */
export interface OpcoesFicticios {
  cnpj: 'numerico' | 'alfanumerico';
  sufixo: string;
  mascaras: Record<string, Mascara>;
}

const RAMOS = ['Comércio', 'Serviços', 'Indústria', 'Distribuidora', 'Livraria', 'Transportes', 'Construtora', 'Cooperativa'];
const COMPLEMENTOS = ['Central', 'do Norte', 'do Sul', 'Brasil', 'Nacional', 'Integrada', 'Regional', 'União'];
const PRENOMES = ['Pessoa', 'Responsável', 'Usuária', 'Usuário', 'Contato', 'Titular'];
const SOBRENOMES = ['Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito'];
const MUNICIPIOS = ['Cidade Exemplo/DF', 'Vila Exemplo/MG', 'Porto Exemplo/BA', 'Campo Exemplo/PR'];
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export type Gerador = ReturnType<typeof criarGerador>;

export function criarGerador(semente: string, opcoes: OpcoesFicticios) {
  const r = sorteador(semente);
  const int = (n: number) => Math.floor(r() * n);
  const escolha = <T>(lista: T[]): T => lista[int(lista.length)]!;
  const digitos = (n: number) => Array.from({ length: n }, () => String(int(10))).join('');
  const comMascara = (chave: string, cru: string, padrao: string) => {
    const m = opcoes.mascaras[chave];
    return (m && aplicarMascara(m, cru)) ?? padrao;
  };

  return {
    cpf: () => cpf(100_000_000 + int(899_999_999)),
    cnpj: () => {
      if (opcoes.cnpj === 'alfanumerico') {
        const raiz = Array.from({ length: 8 }, (_, i) => (i < 2 || i % 3 === 0 ? String(int(10)) : LETRAS[int(LETRAS.length)]!)).join('');
        return cnpjDe12(raiz + '0001');
      }
      return cnpjDe12(digitos(8) + '0001');
    },
    empresa: () => `${escolha(RAMOS)} ${escolha(COMPLEMENTOS)} ${opcoes.sufixo} Ltda.`.replace(/\s+/g, ' '),
    pessoa: () => `${escolha(PRENOMES)} ${escolha(SOBRENOMES)} ${opcoes.sufixo}`,
    email: () => `contato${int(90) + 10}@exemplo.com.br`,
    telefone: () => comMascara('Fone', '61' + '3' + digitos(7), `(61) 3${digitos(3)}-${digitos(4)}`),
    cep: () => comMascara('CEP', '70' + digitos(6), `70.${digitos(3)}-${digitos(3)}`),
    data: () => {
      const d = new Date(Date.UTC(2025, 0, 1) + int(540) * 86_400_000);
      return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    },
    valor: () => `R$ ${(int(9000) + 100).toLocaleString('pt-BR')},${digitos(2)}`,
    numero: () => String(int(900) + 10),
    municipio: () => escolha(MUNICIPIOS),
    texto: (nome: string) => `${nome} ${opcoes.sufixo}`,
  };
}

/** Escolhe o gerador pelo nome do campo (sem acento, palavra inteira). */
export function valorFicticio(nomeCampo: string, g: Gerador, contexto = ''): string {
  const n = normalizar(nomeCampo);
  // "Nome" numa tela de empresas (operadoras, beneficiárias…) é nome de empresa, não de pessoa.
  if (/^(nome|razao social)$/.test(n) && /empresa|operadora|beneficiaria|parceira|fornecedor|instituic/.test(normalizar(contexto))) return g.empresa();
  const tem = (re: RegExp) => re.test(n);
  if (tem(/\bcnpj\b/)) return g.cnpj();
  if (tem(/\bcpf\b/)) return g.cpf();
  if (tem(/\bcep\b/)) return g.cep();
  if (tem(/e-?mail/)) return g.email();
  if (tem(/\b(fone|telefone|celular|fax|sac)\b/)) return g.telefone();
  if (tem(/\b(data|periodo|inicio|termino|vencimento|validade|emissao)\b/)) return g.data();
  if (tem(/\bvalor\b|\bsalario\b|\btotal\b/)) return g.valor();
  if (tem(/\b(quantidade|qtd|numero|n[ºo])\b/)) return g.numero();
  if (tem(/\b(municipio|cidade)\b/)) return g.municipio();
  if (tem(/\b(razao social|empresa|operadora|beneficiaria|nome fantasia)\b/)) return g.empresa();
  if (tem(/\b(nome|responsavel|usuario)\b/)) return g.pessoa();
  return g.texto(nomeCampo);
}
