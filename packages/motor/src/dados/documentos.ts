/** CPF e CNPJ (numérico e alfanumérico, IN RFB 2.229/2024) com dígitos verificadores válidos. */

const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function dv(valores: number[], pesos: number[]): number {
  const s = valores.reduce((acc, v, i) => acc + v * pesos[i]!, 0) % 11;
  return s < 2 ? 0 : 11 - s;
}

/** Valor de um caractere do CNPJ: código ASCII − 48 (0–9 → 0–9, A–Z → 17–42). */
function valorCnpj(c: string): number {
  return c.charCodeAt(0) - 48;
}

export function soCaracteres(texto: string): string {
  return texto.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function formatarCpf(d: string): string {
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

export function formatarCnpj(d: string): string {
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/** CPF a partir de uma base de 9 dígitos. */
export function cpf(base: number): string {
  const n = String(Math.abs(Math.trunc(base)) % 1_000_000_000).padStart(9, '0').split('').map(Number);
  n.push(dv(n, [10, 9, 8, 7, 6, 5, 4, 3, 2]));
  n.push(dv(n, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]));
  return formatarCpf(n.join(''));
}

export function validarCpf(texto: string): boolean {
  const d = texto.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const n = d.split('').map(Number);
  return dv(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[9] && dv(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[10];
}

/** Completa 12 caracteres (raiz + ordem) com os 2 DVs. Aceita letras (CNPJ alfanumérico). */
export function cnpjDe12(doze: string): string {
  const c = soCaracteres(doze);
  if (c.length !== 12) throw new Error(`CNPJ precisa de 12 caracteres antes dos DVs: ${doze}`);
  const v = c.split('').map(valorCnpj);
  const d1 = dv(v, PESOS_CNPJ_1);
  const d2 = dv([...v, d1], PESOS_CNPJ_2);
  return formatarCnpj(c + d1 + d2);
}

/** CNPJ numérico (matriz 0001) a partir de uma base de 8 dígitos. */
export function cnpj(base: number): string {
  return cnpjDe12(String(Math.abs(Math.trunc(base)) % 100_000_000).padStart(8, '0') + '0001');
}

export function validarCnpj(texto: string): boolean {
  const c = soCaracteres(texto);
  if (c.length !== 14 || !/^[0-9A-Z]{12}\d{2}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
  return cnpjDe12(c.slice(0, 12)) === formatarCnpj(c);
}
