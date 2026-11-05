import { describe, expect, it } from 'vitest';
import { acaoDoCenario } from '../../src/inferencia/fluxo.js';
import { classificarSelo, colunaComSelo } from '../../src/inferencia/selo.js';
import { preparar } from '../../src/executar.js';
import type { Acao, Campo } from '../../src/modelo/tipos.js';
import type { Filho } from '../../src/parser/tipos.js';
import { EXEMPLO } from '../fabricas/projeto.js';

const acao = (rotulo: string, id = rotulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')): Acao => ({ id, rotulo, primaria: false, origem: { arquivo: 'x', linha: 1 } });
const filho = (...passos: string[]): Filho => ({ posicao: 1, tipo: 'Cenário', titulo: 't', tags: [], descricao: '', passos: passos.map((texto, i) => ({ palavra: 'E', texto, linha: i + 1 })) as Filho['passos'], exemplos: [], linha: 1, anotacoes: [] });

describe('ação acionada no cenário (CT-U01)', () => {
  const acoes = [acao('Enviar'), acao('Salvar'), acao('Filtrar')];
  it('reconhece as redações comuns, sem acento e sem caixa', () => {
    expect(acaoDoCenario(filho('Quando o visitante aciona a opção **Enviar**'), acoes)?.id).toBe('enviar');
    expect(acaoDoCenario(filho('Quando o usuário aciona o botão **Salvar**'), acoes)?.id).toBe('salvar');
    expect(acaoDoCenario(filho('Quando clica em **enviar**'), acoes)?.id).toBe('enviar');
    expect(acaoDoCenario(filho('E seleciona **Filtrar**'), acoes)?.id).toBe('filtrar');
    expect(acaoDoCenario(filho('Quando informa um valor diferente'), acoes)).toBeUndefined();
  });
});

describe('fluxos do exemplo (CT-U02, CT-U03, CT-U05)', async () => {
  const p = await preparar(EXEMPLO);
  const tela = (id: string) => p.modelo.telas.find((t) => t.id === id)!;
  it('Contato: Enviar leva ao sucesso e, simulando, ao erro dos e-mails diferentes', () => {
    const enviar = tela('03_Portal_Contato').acoes.find((a) => a.id === 'enviar')!;
    expect(enviar.fluxo).toEqual({ sucesso: 'sucesso-1', erros: ['erro-2'], avisos: [] });
    expect(enviar.sinal?.regra).toBe('RN-84');
    expect(tela('03_Portal_Contato').estados.find((e) => e.id === 'erro-2')!.acao).toBe('enviar');
    expect(tela('03_Portal_Contato').estados.find((e) => e.id === 'padrao')!.acao).toBeUndefined();
  });
  it('Entrar: destino na tela autenticada e o erro no fluxo', () => {
    const entrar = tela('01_Acesso_Entrar').acoes[0]!;
    expect(entrar.destino).toBe('01_Gestão_Parceiras');
    expect(entrar.fluxo?.erros).toEqual(['erro-2']);
  });
  it('Filtrar: o "nenhum resultado" é aviso do fluxo; ações locais não geram achado', () => {
    expect(tela('02_Portal_Lista_Parceiras').acoes.find((a) => a.id === 'filtrar')!.fluxo?.avisos).toEqual(['aviso-2']);
    const sem = p.achados.filter((a) => a.codigo === 'prototipo/acao-sem-destino').map((a) => a.mensagem);
    // Filtrar, Limpar e Exportar agem na própria tela e não pedem destino.
    expect(sem.some((m) => /Filtrar|Limpar|Exportar/.test(m))).toBe(false);
  });
});

describe('selo de situação (CT-U08)', () => {
  it('cor pelo sentido do valor, com os negativos antes dos positivos', () => {
    expect(classificarSelo('Autorizada')).toBe('sucesso');
    expect(classificarSelo('Ativa')).toBe('sucesso');
    expect(classificarSelo('Não autorizada')).toBe('erro');
    expect(classificarSelo('Inativa')).toBe('erro');
    expect(classificarSelo('Aguardando análise')).toBe('aviso');
    expect(classificarSelo('Em andamento')).toBe('aviso');
    expect(classificarSelo('Outra coisa')).toBe('neutro');
  });
  it('só colunas Situação/Status com opções', () => {
    const c = { nome: 'Situação', opcoes: ['A'] } as Campo;
    expect(colunaComSelo(c)).toBe(true);
    expect(colunaComSelo({ ...c, opcoes: undefined })).toBe(false);
    expect(colunaComSelo({ ...c, nome: 'Status do pedido' })).toBe(true);
    expect(colunaComSelo({ ...c, nome: 'Município' })).toBe(false);
  });
});
