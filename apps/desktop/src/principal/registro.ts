import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

/** Registro técnico com rotação (RN-78): 5 arquivos × 5 MB, sem conteúdo das especificações. */
let arquivo: string | undefined;
const LIMITE = 5 * 1024 * 1024;
const ARQUIVOS = 5;

export function iniciarRegistro(pasta: string): string {
  mkdirSync(pasta, { recursive: true });
  arquivo = path.join(pasta, 'prumo.log');
  return arquivo;
}

function girar() {
  if (!arquivo || !existsSync(arquivo) || statSync(arquivo).size < LIMITE) return;
  const ultimo = `${arquivo}.${ARQUIVOS - 1}`;
  if (existsSync(ultimo)) unlinkSync(ultimo);
  for (let i = ARQUIVOS - 2; i >= 1; i--) if (existsSync(`${arquivo}.${i}`)) renameSync(`${arquivo}.${i}`, `${arquivo}.${i + 1}`);
  renameSync(arquivo, `${arquivo}.1`);
}

export function registrar(nivel: 'info' | 'aviso' | 'erro', mensagem: string, detalhe?: unknown) {
  const linha = `${new Date().toISOString()} ${nivel.toUpperCase()} ${mensagem}${detalhe ? ` ${detalhe instanceof Error ? (detalhe.stack ?? detalhe.message) : JSON.stringify(detalhe)}` : ''}\n`;
  if (process.env.PRUMO_REGISTRO_CONSOLE) process.stderr.write(linha);
  if (!arquivo) return;
  try {
    girar();
    appendFileSync(arquivo, linha);
  } catch {
    /* registro nunca derruba o programa */
  }
}

export const caminhoRegistro = () => arquivo ?? '';
