import { watch, type FSWatcher } from 'chokidar';
import { gerar } from '@prumo/motor';
import type { Servicos } from './servicos.js';
import { registrar } from './registro.js';

/**
 * Prévia ao vivo (spec 6.5): vigia o projeto, regenera verificação e protótipos e avisa a janela.
 * Mesmo padrão do `prumo servir`: debounce de 300 ms e uma regeneração por vez.
 */
export class PreviaAoVivo {
  private vigia?: FSWatcher;
  private espera?: NodeJS.Timeout;
  private rodando = false;
  private pendente = false;
  private mudouConfig = false;

  constructor(private readonly s: Servicos, private readonly enviar: (e: string, d: unknown) => void) {}

  async ligar(specs: string) {
    await this.desligar();
    this.vigia = watch(specs, {
      ignoreInitial: true,
      ignored: (p: string) => /[\\/](node_modules|\.git|saida|html)([\\/]|$)|\.tmp$/.test(p),
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
    });
    this.vigia.on('all', (_ev, arquivo) => {
      if (!/\.(feature|ya?ml|properties|png|jpe?g|svg|css)$/i.test(arquivo)) return;
      if (/projeto\.yml$|telas\.overrides\.yml$/i.test(arquivo)) this.mudouConfig = true;
      clearTimeout(this.espera);
      this.espera = setTimeout(() => void this.regenerar(), 300);
    });
    await new Promise<void>((ok) => this.vigia!.once('ready', () => ok()));
  }

  async desligar() {
    clearTimeout(this.espera);
    await this.vigia?.close();
    this.vigia = undefined;
  }

  get ligada() {
    return !!this.vigia;
  }

  private async regenerar() {
    if (this.rodando) {
      this.pendente = true;
      return;
    }
    this.rodando = true;
    try {
      do {
        this.pendente = false;
        const config = this.mudouConfig;
        this.mudouConfig = false;
        const projeto = await this.s.recarregar();
        await gerar(this.s.specs, { saida: this.s.cache('prototipos') });
        if (config) this.enviar('projeto:mudouNoDisco', { arquivo: 'projeto.yml' });
        this.enviar('previa:atualizada', projeto);
      } while (this.pendente);
    } catch (e) {
      registrar('aviso', 'prévia ao vivo falhou', e);
    } finally {
      this.rodando = false;
    }
  }
}
