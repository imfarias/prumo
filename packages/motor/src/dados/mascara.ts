/**
 * Máscaras do projeto.yml: `#` dígito, `A` letra, `X` letra ou dígito; o resto é literal.
 * Um campo pode ter várias máscaras (ex.: Fone com 8 ou 9 dígitos).
 */
export type Mascara = string | string[];

const CLASSES: Record<string, RegExp> = { '#': /\d/, A: /[A-Za-z]/, X: /[0-9A-Za-z]/ };

export function listaDeMascaras(m: Mascara): string[] {
  return Array.isArray(m) ? m : [m];
}

export function confereUma(mascara: string, valor: string): boolean {
  if (mascara.length !== valor.length) return false;
  for (let i = 0; i < mascara.length; i++) {
    const m = mascara[i]!;
    const re = CLASSES[m];
    if (re ? !re.test(valor[i]!) : m !== valor[i]) return false;
  }
  return true;
}

export function confereMascara(m: Mascara, valor: string): boolean {
  return listaDeMascaras(m).some((x) => confereUma(x, valor.trim()));
}

/** Aplica a máscara a caracteres crus; devolve null se a quantidade não bate com nenhuma. */
export function aplicarMascara(m: Mascara, cru: string): string | null {
  const c = cru.replace(/[^0-9A-Za-z]/g, '');
  for (const mascara of listaDeMascaras(m)) {
    const posicoes = mascara.split('').filter((x) => x in CLASSES).length;
    if (posicoes !== c.length) continue;
    let j = 0;
    let saida = '';
    for (const ch of mascara) saida += ch in CLASSES ? c[j++]! : ch;
    if (confereUma(mascara, saida)) return saida;
  }
  return null;
}
