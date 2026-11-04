import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Preferencias, Recente } from '../comum/tipos.js';

export const PREFERENCIAS_PADRAO: Preferencias = {
  recentes: [],
  editor: 'vscode',
  previaAoVivo: true,
  tema: 'sistema',
  atualizacao: { ligada: true },
};

/** Preferências em userData/preferencias.json (RN-75); arquivo ausente ou corrompido → padrões. */
export class ArmazemPreferencias {
  private dados: Preferencias;
  constructor(private readonly arquivo: string) {
    this.dados = this.ler();
  }

  private ler(): Preferencias {
    try {
      if (!existsSync(this.arquivo)) return structuredClone(PREFERENCIAS_PADRAO);
      const bruto = JSON.parse(readFileSync(this.arquivo, 'utf8')) as Partial<Preferencias>;
      return {
        ...structuredClone(PREFERENCIAS_PADRAO),
        ...bruto,
        recentes: Array.isArray(bruto.recentes) ? bruto.recentes.filter((r) => r && typeof r.caminho === 'string').slice(0, 10) : [],
        atualizacao: { ...PREFERENCIAS_PADRAO.atualizacao, ...(bruto.atualizacao ?? {}) },
      };
    } catch {
      return structuredClone(PREFERENCIAS_PADRAO);
    }
  }

  get(): Preferencias {
    return structuredClone(this.dados);
  }

  async mudar(f: (p: Preferencias) => void): Promise<Preferencias> {
    f(this.dados);
    await mkdir(path.dirname(this.arquivo), { recursive: true });
    const temp = `${this.arquivo}.tmp`;
    await writeFile(temp, JSON.stringify(this.dados, null, 2), 'utf8');
    await rename(temp, this.arquivo);
    return this.get();
  }

  /** Recentes: no máximo 10, sem duplicata, o mais novo primeiro. */
  async lembrar(r: Omit<Recente, 'abertoEm'>, agora = new Date()): Promise<Preferencias> {
    return this.mudar((p) => {
      const chave = (c: string) => path.resolve(c).toLowerCase();
      p.recentes = [{ ...r, abertoEm: agora.toISOString() }, ...p.recentes.filter((x) => chave(x.caminho) !== chave(r.caminho))].slice(0, 10);
    });
  }

  async esquecer(caminho: string): Promise<Preferencias> {
    return this.mudar((p) => {
      p.recentes = p.recentes.filter((x) => path.resolve(x.caminho).toLowerCase() !== path.resolve(caminho).toLowerCase());
    });
  }
}
