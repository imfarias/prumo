import { describe, expect, it } from 'vitest';
import type { Achado } from '../../src/config/esquema.js';
import { formatarJson, formatarTexto, resumo } from '../../src/verificacao/formatar.js';

const achados: Achado[] = [
  { severidade: 'erro', codigo: 'link/cenario-inexistente', arquivo: 'a.feature', linha: 3, mensagem: 'Link quebrado.', sugestao: 'Use /6.' },
  { severidade: 'aviso', codigo: 'fluxo/sem-principal', arquivo: 'b.feature', mensagem: 'Sem fluxo principal.' },
  { severidade: 'info', codigo: 'inferencia/sem-regra', arquivo: 'c.feature', linha: 9, mensagem: 'Texto simples.' },
];

describe('formatação dos achados', () => {
  it('texto: severidade, arquivo:linha, código e sugestão; info só quando pedido', () => {
    expect(formatarTexto(achados)).toBe(
      '  erro   a.feature:3  link/cenario-inexistente  Link quebrado.\n         Use /6.\n  aviso  b.feature  fluxo/sem-principal  Sem fluxo principal.',
    );
    expect(formatarTexto(achados, { incluirInfo: true })).toContain('c.feature:9  inferencia/sem-regra');
  });
  it('cores ANSI só quando pedidas', () => {
    expect(formatarTexto(achados, { cores: true })).toContain('\u001b[31merro \u001b[0m');
    expect(formatarTexto(achados)).not.toContain('\u001b[');
  });
  it('JSON com resumo (spec 9.4)', () => {
    const j = JSON.parse(formatarJson(achados));
    expect(j.resumo).toEqual({ erros: 1, avisos: 1, infos: 1 });
    expect(j.achados).toHaveLength(3);
    expect(resumo([])).toEqual({ erros: 0, avisos: 0, infos: 0 });
  });
});
