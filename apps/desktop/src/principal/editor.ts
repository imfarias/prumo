import { spawn } from 'node:child_process';
import type { Preferencias } from '../comum/tipos.js';

export interface Comando {
  executavel: string;
  argumentos: string[];
  shell: boolean;
}

/** Comando para abrir `arquivo` na `linha` (FA-05). `undefined` = usar o aplicativo padrão do sistema. */
export function comandoDoEditor(editor: Preferencias['editor'], arquivo: string, linha?: number, plataforma = process.platform): Comando | undefined {
  // Só nos testes (programa não empacotado): um script que grava os argumentos, rodado pelo Node do próprio Electron.
  const teste = process.env.PRUMO_EDITOR_TESTE;
  if (teste) return { executavel: process.execPath, argumentos: [teste, arquivo, String(linha ?? 1)], shell: false };
  if (editor === 'sistema') return undefined;
  if (editor === 'vscode') {
    // No Windows o VS Code é um .cmd, que só roda pelo shell; o caminho vai entre aspas.
    return plataforma === 'win32'
      ? { executavel: 'code.cmd', argumentos: ['--goto', `"${arquivo}:${linha ?? 1}"`], shell: true }
      : { executavel: 'code', argumentos: ['--goto', `${arquivo}:${linha ?? 1}`], shell: false };
  }
  return {
    executavel: editor.executavel,
    argumentos: editor.argumentos.map((a) => a.replace('{arquivo}', arquivo).replace('{linha}', String(linha ?? 1))),
    shell: false,
  };
}

/** Roda o comando; devolve false se o executável não existe (para cair no aplicativo padrão). */
export function rodar(c: Comando): Promise<boolean> {
  return new Promise((ok) => {
    try {
      const filho = spawn(c.executavel, c.argumentos, { shell: c.shell, detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: c.executavel === process.execPath ? '1' : undefined } });
      filho.once('error', () => ok(false));
      filho.once('spawn', () => {
        filho.unref();
        ok(true);
      });
      filho.once('exit', (codigo) => ok(codigo === 0 || codigo === null));
    } catch {
      ok(false);
    }
  });
}
