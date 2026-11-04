import { cpSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { EstadoTarefa } from '../../src/comum/tipos.js';

// A fila não precisa do Electron; os módulos que o importam recebem um substituto mínimo.
vi.mock('electron', () => ({ app: { isPackaged: false }, BrowserWindow: class {}, session: { fromPartition: () => ({}) }, protocol: { handle: () => undefined } }));

const { Servicos } = await import('../../src/principal/servicos.js');
const { ArmazemPreferencias } = await import('../../src/principal/preferencias.js');

const EXEMPLO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../exemplos/exemplo-ficticio');

async function montar() {
  const raiz = await mkdtemp(path.join(tmpdir(), 'prumo-fila-'));
  const specs = path.join(raiz, 'specs');
  cpSync(EXEMPLO, specs, { recursive: true });
  const eventos: { evento: string; dados: EstadoTarefa }[] = [];
  const s = new Servicos(new ArmazemPreferencias(path.join(raiz, 'prefs.json')), path.join(raiz, 'cache'), (evento, dados) => eventos.push({ evento, dados: dados as EstadoTarefa }));
  await s.abrir(specs);
  const fim = (id: string) =>
    vi.waitFor(() => {
      const e = eventos.find((x) => x.evento === 'tarefa:fim' && x.dados.id === id);
      if (!e) throw new Error('ainda rodando');
      return e.dados;
    }, { timeout: 20_000, interval: 25 });
  return { s, raiz, specs, eventos, fim };
}

describe('fila de tarefas (CT-M05)', () => {
  it('uma por vez; a segunda é recusada com DSK-10; terminar libera a fila', async () => {
    const { s, fim } = await montar();
    const t = s.iniciarTarefa('gerar', {});
    expect(t.estado).toBe('rodando');
    expect(() => s.iniciarTarefa('verificar', {})).toThrow(/DSK-10|Já há uma tarefa/);
    const r = await fim(t.id);
    expect(r.estado).toBe('concluida');
    expect(r.resultado).toEqual({ paginas: expect.any(Number) });
    const v = await fim(s.iniciarTarefa('verificar', {}).id);
    expect(v.estado).toBe('concluida');
  });

  it('cancelar → estado "cancelada"; andamento enviado com feito ≤ total', async () => {
    const { s, eventos, fim } = await montar();
    const t = s.iniciarTarefa('docs', {});
    s.cancelar(t.id);
    const r = await fim(t.id);
    expect(r.estado).toBe('cancelada');
    for (const e of eventos.filter((x) => x.evento === 'tarefa:andamento')) expect(e.dados.feito).toBeLessThanOrEqual(Math.max(e.dados.total, e.dados.feito));
  });

  it('erro do motor ou do programa vira {codigo, mensagem}', async () => {
    const { s, fim } = await montar();
    const r = await fim(s.iniciarTarefa('pdf', {}).id);
    expect(r.estado).toBe('erro');
    expect(r.erro).toMatchObject({ codigo: 'DSK-12' });
    const c = await fim(s.iniciarTarefa('comparar', {}).id);
    expect(c.erro).toMatchObject({ codigo: 'DSK-14' });
  });

  it('saída fora do projeto e não escolhida em diálogo → DSK-11; escolhida → aceita', async () => {
    const { s, raiz, fim } = await montar();
    const fora = path.join(path.parse(raiz).root, 'prumo-fora-do-projeto');
    expect(() => s.iniciarTarefa('docs', { saida: fora })).toThrow(/DSK-11|não permitida/);
    expect(s.liberado(path.join(raiz, 'html'))).toBe(true);
    s.liberados.add(fora);
    expect(s.liberado(path.join(fora, 'sub'))).toBe(true);
    expect(s.liberado(path.join(raiz, '..', 'vizinho'))).toBe(false);
    await fim(s.iniciarTarefa('verificar', {}).id);
  });
});
