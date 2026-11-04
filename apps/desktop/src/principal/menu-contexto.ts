import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/**
 * "Abrir com o Prumo" no botão direito de pastas (RN-76), para quem instalou pelo .msi: chave em HKCU,
 * ligada ou desligada nas Preferências. O .exe (NSIS) cria e remove a mesma chave no instalador.
 */
export const CHAVE = 'HKCU\\Software\\Classes\\Directory\\shell\\Prumo';

export function comandosMenu(exe: string, ligar: boolean, chave = CHAVE): string[][] {
  if (!ligar) return [['delete', chave, '/f']];
  return [
    ['add', chave, '/ve', '/d', 'Abrir com o Prumo', '/f'],
    ['add', chave, '/v', 'Icon', '/d', `"${exe}",0`, '/f'],
    ['add', `${chave}\\command`, '/ve', '/d', `"${exe}" "%1"`, '/f'],
  ];
}

export async function definirMenuContexto(exe: string, ligar: boolean, chave = CHAVE): Promise<void> {
  if (process.platform !== 'win32') return;
  for (const args of comandosMenu(exe, ligar, chave)) {
    try {
      await exec('reg', args, { windowsHide: true });
    } catch (e) {
      if (ligar) throw e; // remover chave que não existe não é erro
    }
  }
}

export async function menuContextoExiste(chave = CHAVE): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await exec('reg', ['query', chave], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}
