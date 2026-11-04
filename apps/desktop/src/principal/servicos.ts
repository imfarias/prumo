import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { parse } from 'yaml';
import {
  ErroPrumo, compararComAtuais, criarProjetoNovo, editarYaml, formatarJson, gerar, gerarDocumentacao, gerarECapturar, gerarPdf,
  migrarConfig, pngDoPrumo, preparar, saidaPadrao, verificarPreparado, type Achado, type Andamento, type Mudanca, type Preparado,
} from '@prumo/motor';
import type { EstadoTarefa, ProjetoAberto, ResultadoComparacaoVisao, TelaVisao, TipoTarefa } from '../comum/tipos.js';
import type { DadosDe } from '../comum/canais.js';
import { NavegadorElectron } from './navegador-electron.js';
import type { ArmazemPreferencias } from './preferencias.js';
import { registrarRaiz, urlDe } from './protocolo.js';
import { registrar } from './registro.js';

const exec = promisify(execFile);
type Enviar = (evento: string, dados: unknown) => void;
type Parametros = DadosDe<'tarefa:iniciar'>['parametros'];

/** Acha a pasta de especificações a partir da escolhida: ela mesma, uma "Especificações" abaixo, ou a primeira com .feature. */
export function acharSpecs(pasta: string, profundidade = 3): string | undefined {
  const tem = (d: string) => readdirSync(d, { withFileTypes: true }).some((e) => e.isFile() && e.name.endsWith('.feature'));
  const filhos = (d: string) => readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.') && !['node_modules', 'html', 'saida'].includes(e.name));
  const temFeatureAbaixo = (d: string, n: number): boolean => {
    if (tem(d)) return true;
    return n > 0 && filhos(d).some((f) => temFeatureAbaixo(path.join(d, f.name), n - 1));
  };
  if (!existsSync(pasta) || !statSync(pasta).isDirectory()) return undefined;
  const especificacoes = filhos(pasta).find((f) => /^especifica[cç](o|õ)es$/i.test(f.name.normalize('NFC')));
  if (especificacoes && temFeatureAbaixo(path.join(pasta, especificacoes.name), 2)) return path.join(pasta, especificacoes.name);
  if (filhos(pasta).some((f) => tem(path.join(pasta, f.name))) || tem(pasta)) return pasta;
  if (profundidade <= 0) return undefined;
  for (const f of filhos(pasta)) {
    const r = acharSpecs(path.join(pasta, f.name), profundidade - 1);
    if (r) return r;
  }
  return undefined;
}

export class Servicos {
  preparado?: Preparado;
  private achados: Achado[] = [];
  private verificadoEm = '';
  private tarefa?: { estado: EstadoTarefa; ctl: AbortController };
  private textoBase = new Map<string, string>();
  pdfGerado?: string;
  ultimaDocs?: string;
  /** Caminhos escolhidos em diálogos nativos nesta sessão (lista de liberados, seção 5 do desenho). */
  readonly liberados = new Set<string>();

  constructor(private readonly prefs: ArmazemPreferencias, private readonly cacheRaiz: string, private readonly enviar: Enviar) {}

  get specs(): string {
    if (!this.preparado) throw new ErroPrumo('DSK-00', 'Abra um projeto primeiro.');
    return this.preparado.specs;
  }

  /** Pasta de trabalho do projeto no userData: protótipos para ver, miniaturas, comparações. */
  cache(sub: string): string {
    const h = createHash('sha256').update(path.resolve(this.specs).toLowerCase()).digest('hex').slice(0, 16);
    return path.join(this.cacheRaiz, h, sub);
  }

  liberado(caminho: string): boolean {
    const alvo = path.resolve(caminho);
    const dentro = (base: string) => {
      const r = path.relative(base, alvo);
      return !r.startsWith('..') && !path.isAbsolute(r);
    };
    if (this.preparado && dentro(path.resolve(this.specs, '..'))) return true;
    return [...this.liberados].some((l) => dentro(l) || alvo === l);
  }

  async abrir(caminho: string): Promise<ProjetoAberto> {
    const specs = acharSpecs(path.resolve(caminho));
    if (!specs) throw new ErroPrumo('DSK-01', `Não há arquivos .feature em ${caminho}. Escolha a pasta de especificações (a que contém as pastas dos módulos).`);
    this.preparado = await preparar(specs);
    registrarRaiz('specs', specs);
    registrarRaiz('cache', this.cache('.'));
    registrarRaiz('docs', saidaPadrao(this.preparado));
    this.ultimaDocs = existsSync(path.join(saidaPadrao(this.preparado), '.prumo-arquivos')) ? saidaPadrao(this.preparado) : undefined;
    this.verificar();
    const visao = this.visao();
    await this.prefs.lembrar({ caminho: specs, nome: visao.nome, versao: visao.versao });
    registrar('info', `projeto aberto: ${specs}`);
    this.enviar('projeto:aberto', visao);
    return visao;
  }

  async recarregar(): Promise<ProjetoAberto> {
    this.preparado = await preparar(this.specs);
    registrarRaiz('docs', saidaPadrao(this.preparado));
    this.verificar();
    return this.visao();
  }

  private verificar() {
    this.achados = verificarPreparado(this.preparado!);
    this.verificadoEm = new Date().toISOString();
  }

  visao(): ProjetoAberto {
    const p = this.preparado!;
    return {
      specs: p.specs,
      nome: p.config.projeto.nome,
      versao: p.config.projeto.versao,
      telas: p.modelo.telas.length,
      erros: this.achados.filter((a) => a.severidade === 'erro').length,
      avisos: this.achados.filter((a) => a.severidade === 'aviso').length,
      fonte: p.fonte,
      git: existsSync(path.join(p.specs, '.git')) || existsSync(path.join(p.specs, '..', '.git')) || existsSync(path.join(p.specs, '..', '..', '.git')),
      achados: this.achados,
      verificadoEm: this.verificadoEm,
    };
  }

  async criar(d: DadosDe<'projeto:criar'>): Promise<ProjetoAberto> {
    const { specs } = await criarProjetoNovo(d.pasta, { nome: d.nome, versao: d.versao, orgao: d.orgao });
    return this.abrir(specs);
  }

  async criarProjetoYml(): Promise<ProjetoAberto> {
    await migrarConfig(this.specs);
    return this.recarregar();
  }

  exportarVerificacao(): string {
    return formatarJson(this.achados);
  }

  /* ---------------- configuração ---------------- */

  private arquivoConfig(arquivo: 'projeto.yml' | 'telas.overrides.yml') {
    return path.join(this.specs, arquivo);
  }

  async lerConfig(arquivo: 'projeto.yml' | 'telas.overrides.yml') {
    const caminho = this.arquivoConfig(arquivo);
    const texto = existsSync(caminho) ? await readFile(caminho, 'utf8') : '';
    this.textoBase.set(arquivo, texto);
    let dados: unknown = {};
    try {
      dados = texto.trim() ? (parse(texto) ?? {}) : {};
    } catch {
      dados = {};
    }
    return { caminho, texto, existe: existsSync(caminho), config: this.preparado!.config, pastas: this.pastasDeModulo(), dados };
  }

  previaConfig(arquivo: 'projeto.yml' | 'telas.overrides.yml', mudancas: Mudanca[]) {
    const base = this.textoBase.get(arquivo) ?? (existsSync(this.arquivoConfig(arquivo)) ? readFileSync(this.arquivoConfig(arquivo), 'utf8') : '');
    return editarYaml(base, mudancas);
  }

  async salvarConfig(d: DadosDe<'config:salvar'>) {
    const caminho = this.arquivoConfig(d.arquivo);
    const atual = existsSync(caminho) ? await readFile(caminho, 'utf8') : '';
    if (atual !== d.base) throw new ErroPrumo('DSK-13', `O ${d.arquivo} mudou no disco desde que foi aberto. Recarregue para ver a versão atual.`);
    const r = editarYaml(atual, d.mudancas);
    if (r.mudou) {
      const temp = `${caminho}.tmp`;
      await writeFile(temp, r.texto, 'utf8');
      await rename(temp, caminho);
    }
    this.textoBase.set(d.arquivo, r.texto);
    const alteradas = r.diff.filter((x) => x.tipo === 'incluida').length;
    const projeto = await this.recarregar();
    return { projeto, alteradas, texto: r.texto };
  }

  private pastasDeModulo(): string[] {
    const s = new Set(this.preparado!.arquivos.map((a) => a.pasta));
    return [...s].sort();
  }

  /* ---------------- protótipos ---------------- */

  async listarPrototipos(): Promise<TelaVisao[]> {
    const saida = this.cache('prototipos');
    if (!existsSync(path.join(saida, 'index.html'))) await gerar(this.specs, { saida });
    registrarRaiz('prototipos', saida);
    return this.preparado!.modelo.telas.map((t) => {
      const png = path.join(this.specs, t.modulo, t.prototipo.imagem ?? `${t.id}.png`);
      return {
        id: t.id,
        titulo: t.titulo,
        modulo: t.modulo,
        layout: t.layout,
        miniatura: existsSync(png) ? urlDe('specs', png) : undefined,
        estados: t.estados.map((e) => ({ id: e.id, rotulo: e.id, url: urlDe('prototipos', path.join(saida, t.modulo, t.id, `${e.id}.html`)) })),
        campos: [...t.filtros, ...t.campos, ...t.colunas].map((c) => ({ nome: c.nome, grupo: c.grupo, componente: c.componente, editavel: c.editavel, obrigatorio: c.obrigatorio, sinais: c.sinais.map((s) => s.descricao) })),
        sinais: t.sinais.map((s) => s.descricao),
      };
    });
  }

  /** PNGs que vão ser sobrescritos e não foram gerados pelo Prumo (DSK-08). */
  pngsDeTerceiros(p: Parametros): string[] {
    const telas = this.preparado!.modelo.telas.filter((t) => (!p.modulos?.length || p.modulos.includes(t.modulo)) && (!p.telas?.length || p.telas.includes(t.id)));
    return telas
      .map((t) => path.join(this.specs, t.modulo, t.prototipo.imagem ?? `${t.id}.png`))
      .filter((png) => existsSync(png) && !pngDoPrumo(readFileSync(png)));
  }

  /* ---------------- comparar ---------------- */

  async refsGit(): Promise<string[]> {
    try {
      const { stdout } = await exec('git', ['for-each-ref', '--format=%(refname:short)', '--sort=-creatordate', 'refs/heads', 'refs/tags'], { cwd: this.specs, windowsHide: true });
      return stdout.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 200);
    } catch {
      return [];
    }
  }

  /* ---------------- tarefas ---------------- */

  iniciarTarefa(tipo: TipoTarefa, p: Parametros): EstadoTarefa {
    if (this.tarefa?.estado.estado === 'rodando') throw new ErroPrumo('DSK-10', 'Já há uma tarefa em andamento. Aguarde ou cancele.');
    if (p.saida && !this.liberado(p.saida)) throw new ErroPrumo('DSK-11', 'Pasta de saída não permitida. Escolha a pasta pelo botão.');
    const estado: EstadoTarefa = { id: randomUUID(), tipo, etapa: 'Começando', feito: 0, total: 0, estado: 'rodando' };
    const ctl = new AbortController();
    this.tarefa = { estado, ctl };
    let ultimo = 0;
    const aoAndamento = (a: Andamento) => {
      Object.assign(estado, a);
      const agora = Date.now();
      if (agora - ultimo >= 100 || a.feito === a.total) {
        ultimo = agora;
        this.enviar('tarefa:andamento', { ...estado });
      }
    };
    void this.executar(tipo, p, { sinal: ctl.signal, aoAndamento })
      .then((resultado) => {
        estado.estado = 'concluida';
        estado.resultado = resultado;
      })
      .catch((e: unknown) => {
        if (e instanceof ErroPrumo && e.codigo === 'CANCELADO') estado.estado = 'cancelada';
        else {
          estado.estado = 'erro';
          estado.erro = e instanceof ErroPrumo ? { codigo: e.codigo, mensagem: e.message } : { mensagem: (e as Error).message ?? String(e) };
          registrar('erro', `tarefa ${tipo} falhou`, e);
        }
      })
      .finally(() => this.enviar('tarefa:fim', { ...estado }));
    return { ...estado };
  }

  cancelar(id: string) {
    if (this.tarefa?.estado.id === id) this.tarefa.ctl.abort();
  }

  private async executar(tipo: TipoTarefa, p: Parametros, x: { sinal: AbortSignal; aoAndamento: (a: Andamento) => void }): Promise<unknown> {
    const specs = this.specs;
    const recorte = { modulos: p.modulos, telas: p.telas };
    const comNavegador = async <T>(f: (n: NavegadorElectron) => Promise<T>) => {
      const nav = new NavegadorElectron();
      return f(nav);
    };
    switch (tipo) {
      case 'verificar': {
        x.aoAndamento({ etapa: 'Verificando', feito: 0, total: 1 });
        const projeto = await this.recarregar();
        x.aoAndamento({ etapa: 'Verificado', feito: 1, total: 1 });
        return projeto;
      }
      case 'gerar': {
        const r = await gerar(specs, { saida: this.cache('prototipos'), recorte, ...x });
        registrarRaiz('prototipos', this.cache('prototipos'));
        return { paginas: r.paginas.length };
      }
      case 'capturar': {
        const r = await comNavegador((navegador) => gerarECapturar(specs, { saida: this.cache('prototipos'), recorte, forcar: p.forcar, navegador, ...x }));
        registrarRaiz('prototipos', this.cache('prototipos'));
        await this.recarregar();
        return { gravados: r.capturas.filter((c) => c.situacao === 'gravado').length, semMudanca: r.capturas.filter((c) => c.situacao === 'sem-mudanca').length };
      }
      case 'comparar-png': {
        const r = await comNavegador((navegador) => compararComAtuais(specs, { saida: this.cache('comparacao-png'), recorte, navegador, ...x }));
        registrarRaiz('comparacao', this.cache('comparacao-png'));
        return { itens: r.itens, relatorio: urlDe('comparacao', r.relatorio) };
      }
      case 'docs': {
        const saida = p.saida ?? saidaPadrao(this.preparado!);
        const r = await gerarDocumentacao(specs, { saida, arquivoUnico: p.arquivoUnico, comparar: p.comparar, ...x });
        registrarRaiz('docs', r.saida);
        this.ultimaDocs = r.saida;
        return { saida: r.saida, modo: r.modo, tamanho: r.tamanho, avisos: r.avisos, url: urlDe('docs', path.join(r.saida, 'index.html')) };
      }
      case 'pdf': {
        if (!p.saida) throw new ErroPrumo('DSK-12', 'Escolha onde salvar o PDF.');
        const r = await comNavegador((navegador) => gerarPdf(specs, { saida: p.saida!, recorte, orientacao: p.orientacao, soMudancas: p.soMudancas, comparar: p.comparar, navegador, ...x }));
        this.pdfGerado = r.arquivo;
        return { arquivo: r.arquivo, paginas: r.paginas };
      }
      case 'comparar': {
        if (!p.comparar) throw new ErroPrumo('DSK-14', 'Escolha a versão anterior.');
        const saida = this.cache('comparacao-docs');
        const r = await gerarDocumentacao(specs, { saida, comparar: p.comparar, arquivoUnico: false, ...x });
        registrarRaiz('comparacao-docs', saida);
        const c = r.documentacao.comparacao!;
        const pagina = (e: string) => r.documentacao.paginas.find((pg) => pg.endereco === e)!;
        const url = (e: string) => urlDe('comparacao-docs', path.join(saida, 'f', pagina(e).arquivo));
        const visao: ResultadoComparacaoVisao = {
          versao: c.versao,
          novas: c.novas.map((e) => ({ endereco: e, titulo: pagina(e).titulo, url: url(e) })),
          alteradas: c.alteradas.map((e) => ({ endereco: e, titulo: pagina(e).titulo, url: url(e), cenarios: pagina(e).filhos.filter((f) => f.situacao === 'nova' || f.situacao === 'alterada').length + pagina(e).removidos.length })),
          removidas: c.removidas,
          renomeadas: c.renomeadas,
        };
        return visao;
      }
    }
  }
}
