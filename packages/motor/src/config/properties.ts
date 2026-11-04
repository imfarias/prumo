/** Leitor de .properties (formato Java): comentários # e !, separador = ou :, escapes e continuação. */
export function lerProperties(texto: string): Record<string, string> {
  const saida: Record<string, string> = {};
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    let linha = linhas[i]!.replace(/^\s+/, '');
    if (!linha || linha.startsWith('#') || linha.startsWith('!')) continue;
    while (terminaEmContinuacao(linha) && i + 1 < linhas.length) {
      linha = linha.slice(0, -1) + linhas[++i]!.replace(/^\s+/, '');
    }
    let chave = '';
    let j = 0;
    for (; j < linha.length; j++) {
      const ch = linha[j]!;
      if (ch === '\\') {
        chave += linha[++j] ?? '';
        continue;
      }
      if (ch === '=' || ch === ':' || /\s/.test(ch)) break;
      chave += ch;
    }
    const resto = linha.slice(j).replace(/^\s*[=:]?\s*/, '');
    saida[chave] = desescapar(resto);
  }
  return saida;
}

function terminaEmContinuacao(linha: string): boolean {
  let barras = 0;
  for (let i = linha.length - 1; i >= 0 && linha[i] === '\\'; i--) barras++;
  return barras % 2 === 1;
}

function desescapar(v: string): string {
  return v.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, c: string) => {
    if (c.length === 5) return String.fromCharCode(parseInt(c.slice(1), 16));
    return ({ t: '\t', n: '\n', r: '\r', f: '\f' } as Record<string, string>)[c] ?? c;
  });
}

/** Converte as chaves do Pirilampo para a forma do projeto.yml (RN-08). */
export function propertiesParaProjeto(p: Record<string, string>): Record<string, unknown> {
  const cores: Record<string, string> = {};
  if (p.menuColor) cores.menu = p.menuColor;
  if (p.menuTextColor) cores.menu_texto = p.menuTextColor;
  const doc: Record<string, unknown> = {};
  if (p.layoutPdf) doc.pdf = /LANDSCAPE/i.test(p.layoutPdf) ? 'paisagem' : 'retrato';
  if (p.compilationType) doc.arquivo_unico = !/FOLDER/i.test(p.compilationType);
  if (p.htmlPanelToggle) doc.prototipo_aberto = /OPEN/i.test(p.htmlPanelToggle);
  if (p.embedImages) doc.embutir_imagens = /true/i.test(p.embedImages);
  if (p.compilationArtifact) doc.artefato = p.compilationArtifact;
  return {
    projeto: {
      nome: p.projectName ?? 'Projeto',
      versao: p.projectVersion ?? '1.0',
      ...(p.projectLogo ? { logo: p.projectLogo } : {}),
    },
    identidade: { cores },
    documentacao: doc,
  };
}
