import { describe, expect, it } from 'vitest';
import { renderizarInline, renderizarMarkdown, sanitizarHtml, type OpcoesMarkdown } from '../../src/docs/markdown.js';

const o: OpcoesMarkdown = {
  linkDe: (h) => (h.startsWith('#/scenario/A/') ? { href: `a.html#c-${h.split('/').pop()}`, rota: h, previa: `A/${h.split('/').pop()}` } : h === '#/scenario/X/9' ? { href: h, quebrado: true } : undefined),
  imagemDe: (s) => (s === 'falta.png' ? undefined : `recursos/img/${s}`),
};

describe('Markdown das features (CT-U01, CT-U02)', () => {
  it('negrito, <br>, ---, parágrafos e indentação de 4 espaços', () => {
    const h = renderizarMarkdown('    ---\n\n    **COMO** visitante<br>\n\n    **QUERO** ver', o);
    expect(h).toBe('<hr>\n<p><strong>COMO</strong> visitante<br></p>\n<p><strong>QUERO</strong> ver</p>');
  });
  it('reescreve links do Pirilampo e marca a prévia', () => {
    expect(renderizarInline('[RNG-06](#/scenario/A/6)', o)).toBe('<a href="a.html#c-6" data-rota="#/scenario/A/6" data-previa="A/6">RNG-06</a>');
    expect(renderizarInline('[x](#/scenario/X/9)', o)).toContain('data-quebrado="true"');
  });
  it('imagens: src reescrito; inexistente some', () => {
    expect(renderizarInline('![Image](tela.png)', o)).toBe('<img src="recursos/img/tela.png" alt="Image" loading="lazy">');
    expect(renderizarInline('![Image](falta.png)', o)).toBe('');
  });
  it('parâmetros <Filtros> viram texto', () => {
    expect(renderizarInline('apresenta os <Filtros>', o)).toBe('apresenta os &lt;Filtros&gt;');
  });
  it('remove script, eventos, javascript:, data:text/html, iframe e style', () => {
    const perigoso = '<script>alert(1)</script><b onclick="x()">ok</b><a href="javascript:alert(1)">j</a><a href="JaVa\tScript:x">k</a><img src="data:text/html,x"><iframe src="x"></iframe><span style="color:red">s</span>';
    const h = sanitizarHtml(perigoso, o);
    expect(h).not.toMatch(/<script|onclick|javascript:|<iframe|style=|data:text/i);
    expect(h).toContain('&lt;script&gt;');
    expect(h).toContain('<b>ok</b>');
    expect(h).toContain('<span>s</span>');
    expect(renderizarInline('[j](javascript:alert(1))', o)).not.toMatch(/href="javascript/i);
  });
  it('mantém https com rel e mailto', () => {
    expect(renderizarInline('[s](https://gov.br)', o)).toBe('<a href="https://gov.br" rel="noopener noreferrer">s</a>');
    expect(sanitizarHtml('<a href="mailto:a@exemplo.com.br">m</a>', o)).toBe('<a href="mailto:a@exemplo.com.br">m</a>');
  });
});
