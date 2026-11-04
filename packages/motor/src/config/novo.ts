import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ErroPrumo } from '../util/erros.js';

const q = (v: string) => JSON.stringify(v);

/**
 * Projeto novo (FA-04 da 0003): `Especificações/` com projeto.yml, um módulo de exemplo fictício,
 * regras e mensagens mínimas. A estrutura passa na verificação sem erros.
 */
export async function criarProjetoNovo(pasta: string, o: { nome: string; versao: string; orgao?: string }): Promise<{ specs: string }> {
  const specs = path.join(pasta, 'Especificações');
  if (existsSync(specs) && readdirSync(specs).length) throw new ErroPrumo('NOVO', `A pasta ${specs} já existe e não está vazia.`);
  const nome = o.nome.trim();
  if (!nome) throw new ErroPrumo('NOVO', 'Informe o nome do projeto.');
  const prefixo = nome.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'PROJETO';
  const arquivos: Record<string, string> = {
    'projeto.yml': [
      '# Configuração do Prumo para este projeto de requisitos.',
      'projeto:',
      `  nome: ${q(nome)}`,
      `  versao: ${q(o.versao.trim() || '1.0')}`,
      `  orgao: ${q(o.orgao?.trim() ?? '')}`,
      '',
      '# Identidade visual: os tokens geram o CSS das telas e da documentação.',
      'identidade:',
      '  design_system: proprio',
      '  cores: { fundo: "#FFFFFF", texto: "#1B1B1B", primaria: "#1351B4", menu: "#0E1A33", menu_texto: "#C3CDE3", destaque: "#FFCD07", erro: "#B3261E" }',
      '  fontes: { titulo: Atkinson Hyperlegible, texto: Atkinson Hyperlegible }',
      '',
      'modulos:',
      '  01_Inicio: { casca: publica }',
      '',
    ].join('\n'),
    [`Regras_de_negócio/${prefixo}_Regras_de_negócio.feature`]: [
      '# language: pt',
      `Funcionalidade: ${prefixo}_Regras_de_negócio`,
      '',
      '  Contexto: Critério de Aceitação',
      '    Dado que o sistema deva atender as seguintes regras de negócio',
      '',
      '  Cenário: RNG-01 - Validação de e-mail',
      '    Quando o usuário informa um e-mail',
      '    Então o sistema confere o formato nome@dominio',
      '',
    ].join('\n'),
    [`Mensagem_de_Interface/${prefixo}_Mensagens_de_Interface.feature`]: [
      '# language: pt',
      `Funcionalidade: ${prefixo}_Mensagens_de_Interface`,
      '',
      '  Cenário: Mensagem de Interface',
      `    Dado as seguintes mensagens definidas ao sistema **${nome}**:`,
      '',
      '  Cenário: MSG-01',
      '    Dado que o sistema deva apresentar a seguinte mensagem',
      '      | Mensagem                        |',
      '      | Operação realizada com sucesso! |',
      '',
    ].join('\n'),
    '01_Inicio/01_Inicio_Contato.feature': [
      '# language: pt',
      '# encoding: utf-8',
      '',
      'Funcionalidade: 01_Inicio_Contato',
      '',
      '  **COMO** visitante<br>',
      '',
      '  **QUERO** enviar uma mensagem<br>',
      '',
      '  **PARA** falar com a equipe.',
      '',
      '  # Módulo: 01 Início',
      '  # Tipo: Manual',
      '  # Fluxo: Formulário de contato (exemplo criado pelo Prumo; troque pelo seu requisito)',
      '',
      '  Contexto: Critérios de Aceitação',
      '    Dado que o visitante acessa o formulário de contato',
      '    E o sistema apresenta os <Campos>',
      '      | Campo    | Editável | Obrigatório | Regras                                                                                |',
      `      | Nome     | S        | S           | -                                                                                     |`,
      `      | E-mail   | S        | S           | [RNG-01](#/scenario/Regras_de_negócio_${prefixo}_Regras_de_negócio/1)                |`,
      '      | Mensagem | S        | S           | -                                                                                     |',
      '',
      '  @fluxo-principal',
      '  Cenário: 01. Enviar mensagem',
      '    Quando o visitante aciona a opção **Enviar**',
      `    Então o sistema apresenta a [MSG-01](#/scenario/Mensagem_de_Interface_${prefixo}_Mensagens_de_Interface/1)`,
      '',
      '  @prototipo',
      '  Cenário: Protótipo',
      '  **Contato**',
      '',
    ].join('\n'),
  };
  for (const [rel, conteudo] of Object.entries(arquivos)) {
    const alvo = path.join(specs, ...rel.split('/'));
    await mkdir(path.dirname(alvo), { recursive: true });
    await writeFile(alvo, conteudo, 'utf8');
  }
  return { specs };
}
