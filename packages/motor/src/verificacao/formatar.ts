import type { Achado } from '../config/esquema.js';

export function resumo(achados: Achado[]) {
  return {
    erros: achados.filter((a) => a.severidade === 'erro').length,
    avisos: achados.filter((a) => a.severidade === 'aviso').length,
    infos: achados.filter((a) => a.severidade === 'info').length,
  };
}

/** `severidade  arquivo:linha  código  mensagem` (spec 6.1). */
export function formatarTexto(achados: Achado[], opcoes: { cores?: boolean; incluirInfo?: boolean } = {}): string {
  const cor = (c: string, t: string) => (opcoes.cores ? `\u001b[${c}m${t}\u001b[0m` : t);
  const cores = { erro: '31', aviso: '33', info: '36' } as const;
  return achados
    .filter((a) => opcoes.incluirInfo || a.severidade !== 'info')
    .map((a) => {
      const onde = `${a.arquivo}${a.linha ? `:${a.linha}` : ''}`;
      const sug = a.sugestao ? `\n         ${a.sugestao}` : '';
      return `  ${cor(cores[a.severidade], a.severidade.padEnd(5))}  ${onde}  ${a.codigo}  ${a.mensagem}${sug}`;
    })
    .join('\n');
}

export function formatarJson(achados: Achado[]): string {
  return JSON.stringify({ resumo: resumo(achados), achados }, null, 2) + '\n';
}
