import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ConfigProjeto } from '@prumo/motor';
import type { ProjetoAberto } from '../../comum/tipos.js';
import { avisar, invocar, mudancasPendentes, projeto, textoDoErro } from '../estado.js';

interface Leitura {
  caminho: string;
  texto: string;
  existe: boolean;
  config: ConfigProjeto;
  pastas: string[];
}
type Mudanca = { caminho: (string | number)[]; valor?: unknown; remover?: boolean };

const CORES: [string, string][] = [
  ['fundo', 'Fundo'], ['texto', 'Texto'], ['primaria', 'Primária'], ['menu', 'Menu'], ['menu_texto', 'Texto do menu'], ['destaque', 'Destaque'], ['erro', 'Erro'],
];
const PARES: [string, string, string][] = [['texto', 'fundo', 'Texto sobre o fundo'], ['primaria', 'fundo', 'Primária sobre o fundo'], ['menu_texto', 'menu', 'Texto do menu sobre o menu'], ['erro', 'fundo', 'Erro sobre o fundo']];
const FONTES = ['Atkinson Hyperlegible', 'Jost'];

function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m) as [number, number];
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Valores editáveis do formulário, planos, com o caminho no projeto.yml. */
function valoresDe(c: ConfigProjeto) {
  const v: Record<string, unknown> = {
    'projeto.nome': c.projeto.nome, 'projeto.versao': c.projeto.versao, 'projeto.orgao': c.projeto.orgao, 'projeto.logo': c.projeto.logo ?? '', 'projeto.logo_claro': c.projeto.logo_claro ?? '', 'captura.celular': c.captura.celular, 'padroes.selo_situacao': c.padroes.selo_situacao,
    'identidade.design_system': c.identidade.design_system, 'identidade.fontes.titulo': c.identidade.fontes.titulo, 'identidade.fontes.texto': c.identidade.fontes.texto,
    'identidade.css_adicional': c.identidade.css_adicional ?? '', largura_captura: c.largura_captura,
    'padroes.listas_sempre_em_tela': c.padroes.listas_sempre_em_tela, 'padroes.paginacao': c.padroes.paginacao, 'padroes.container_max': c.padroes.container_max,
    'dados_ficticios.cnpj': c.dados_ficticios.cnpj, 'dados_ficticios.sufixo_nomes': c.dados_ficticios.sufixo_nomes,
    'documentacao.arquivo_unico': c.documentacao.arquivo_unico, 'documentacao.pdf': c.documentacao.pdf, 'documentacao.prototipo_aberto': c.documentacao.prototipo_aberto,
    'documentacao.comparar_com': (c.documentacao.comparar_com as string | undefined) ?? '',
    'cascas.autenticada.conta_no_pe': (c.cascas.autenticada?.conta_no_pe ?? []).join(', '),
    perfis: Object.entries(c.perfis).map(([k, itens]) => `${k}: ${itens.join(', ')}`).join('\n'),
    mascaras: Object.entries(c.mascaras).map(([k, m]) => `${k}: ${Array.isArray(m) ? m.join(' | ') : m}`).join('\n'),
  };
  for (const [k] of CORES) v[`identidade.cores.${k}`] = c.identidade.cores[k] ?? '';
  return v;
}

function mudancasDe(orig: Record<string, unknown>, atual: Record<string, unknown>, modulos: Record<string, { casca?: string; perfil?: string }>, modulosOrig: Record<string, { casca?: string; perfil?: string }>): Mudanca[] {
  const m: Mudanca[] = [];
  for (const [k, v] of Object.entries(atual)) {
    if (JSON.stringify(v) === JSON.stringify(orig[k])) continue;
    if (k === 'perfis') {
      const novos: Record<string, string[]> = {};
      for (const l of String(v).split('\n').map((x) => x.trim()).filter(Boolean)) {
        const [nome, itens = ''] = l.split(':');
        novos[nome!.trim()] = itens.split(',').map((x) => x.trim()).filter(Boolean);
      }
      m.push({ caminho: ['perfis'], valor: novos });
    } else if (k === 'mascaras') {
      const novas: Record<string, string | string[]> = {};
      for (const l of String(v).split('\n').map((x) => x.trim()).filter(Boolean)) {
        const i = l.indexOf(':');
        const lista = l.slice(i + 1).split('|').map((x) => x.trim()).filter(Boolean);
        novas[l.slice(0, i).trim()] = lista.length === 1 ? lista[0]! : lista;
      }
      m.push({ caminho: ['mascaras'], valor: novas });
    } else if (k === 'cascas.autenticada.conta_no_pe') {
      m.push({ caminho: ['cascas', 'autenticada', 'conta_no_pe'], valor: String(v).split(',').map((x) => x.trim()).filter(Boolean) });
    } else if ((v === '' || v === undefined) && ['projeto.logo', 'identidade.css_adicional', 'documentacao.comparar_com'].includes(k)) {
      m.push({ caminho: k.split('.'), remover: true });
    } else {
      m.push({ caminho: k.split('.'), valor: v });
    }
  }
  for (const [pasta, cfg] of Object.entries(modulos)) {
    if (JSON.stringify(cfg) === JSON.stringify(modulosOrig[pasta] ?? {})) continue;
    const limpo: Record<string, string> = {};
    if (cfg.casca) limpo.casca = cfg.casca;
    if (cfg.perfil) limpo.perfil = cfg.perfil;
    m.push(Object.keys(limpo).length ? { caminho: ['modulos', pasta], valor: limpo } : { caminho: ['modulos', pasta], remover: true });
  }
  return m;
}

function Campo(p: { id: string; rotulo: string; valor: unknown; tipo?: 'text' | 'number'; ajuda?: string; erro?: string; aoMudar: (v: string) => void }) {
  return (
    <div class="campo">
      <label for={p.id}>{p.rotulo}</label>
      <input id={p.id} type={(p.tipo ?? 'text') as 'text'} value={String(p.valor ?? '')} data-testid={`config-${p.id}`} aria-invalid={p.erro ? 'true' : undefined} aria-describedby={p.erro ? `${p.id}-erro` : p.ajuda ? `${p.id}-ajuda` : undefined} onInput={(e) => p.aoMudar(e.currentTarget.value)} />
      {p.ajuda && <span class="ajuda" id={`${p.id}-ajuda`}>{p.ajuda}</span>}
      {p.erro && <span class="erro" id={`${p.id}-erro`}>{p.erro}</span>}
    </div>
  );
}

function Escolha(p: { id: string; rotulo: string; valor: unknown; opcoes: [string, string][]; aoMudar: (v: string) => void; ajuda?: string }) {
  return (
    <div class="campo">
      <label for={p.id}>{p.rotulo}</label>
      <select id={p.id} value={String(p.valor)} data-testid={`config-${p.id}`} onChange={(e) => p.aoMudar(e.currentTarget.value)} aria-describedby={p.ajuda ? `${p.id}-ajuda` : undefined}>
        {p.opcoes.map(([v, r]) => (
          <option key={v} value={v}>{r}</option>
        ))}
      </select>
      {p.ajuda && <span class="ajuda" id={`${p.id}-ajuda`}>{p.ajuda}</span>}
    </div>
  );
}

/** Escolha de um logo dentro da pasta de especificações, com prévia (logo e logo para fundo claro, RN-88). */
function CampoLogo(p: { id: string; chave: string; rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  const logo = p.valor;
  return (
    <div class="campo">
      <span class="rotulo" id={`${p.id}-r`}>{p.rotulo}</span>
      <div class="acoes">
        {logo && <img src={`prumo-arquivo://specs/${logo.split('/').map(encodeURIComponent).join('/')}`} alt={`Prévia: ${p.rotulo}`} style="max-height:48px;background:var(--fundo-2);padding:4px" />}
        <code>{logo || 'sem logo'}</code>
        <button
          type="button"
          class="botao pequeno"
          aria-describedby={`${p.id}-r`}
          data-testid={`config-${p.id}-escolher`}
          onClick={async () => {
            const arq = await invocar<string | undefined>('sistema:escolherArquivo', { titulo: p.rotulo, extensoes: ['png', 'jpg', 'jpeg', 'svg'] });
            if (!arq) return;
            const specs = projeto.value!.specs.replace(/\\/g, '/');
            const a = arq.replace(/\\/g, '/');
            // Logo fora das especificações também vale (ex.: ../logo.png), relativo à pasta de especificações.
            const rel = relativo(specs, a);
            if (!rel) return avisar('atencao', 'Escolha um arquivo no mesmo disco das especificações.');
            p.aoMudar(rel);
          }}
        >
          Escolher…
        </button>
        {logo && <button type="button" class="botao pequeno" data-testid={`config-${p.id}-tirar`} onClick={() => p.aoMudar('')}>Tirar</button>}
      </div>
    </div>
  );
}

/** Caminho relativo com barras normais (a janela não tem o módulo path do Node). */
function relativo(de: string, para: string): string | undefined {
  const a = de.split('/').filter(Boolean);
  const b = para.split('/').filter(Boolean);
  if (!a.length || !b.length || a[0]!.toLowerCase() !== b[0]!.toLowerCase()) return undefined;
  let i = 0;
  while (i < a.length && i < b.length && a[i]!.toLowerCase() === b[i]!.toLowerCase()) i++;
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/');
}

function Marca(p: { id: string; rotulo: string; valor: unknown; aoMudar: (v: boolean) => void }) {
  return (
    <div class="campo">
      <label>
        <input type="checkbox" id={p.id} data-testid={`config-${p.id}`} checked={!!p.valor} onChange={(e) => p.aoMudar(e.currentTarget.checked)} /> {p.rotulo}
      </label>
    </div>
  );
}

export function Configuracao() {
  const [leitura, setLeitura] = useState<Leitura>();
  const [orig, setOrig] = useState<Record<string, unknown>>({});
  const [v, setV] = useState<Record<string, unknown>>({});
  const [modulos, setModulos] = useState<Record<string, { casca?: string; perfil?: string }>>({});
  const [diff, setDiff] = useState<{ tipo: string; texto: string }[]>([]);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const l = await invocar<Leitura>('config:ler', { arquivo: 'projeto.yml' });
    setLeitura(l);
    const vals = valoresDe(l.config);
    setOrig(vals);
    setV(vals);
    setModulos(structuredClone(l.config.modulos));
    mudancasPendentes.value = false;
  };
  useEffect(() => void carregar(), []);

  const mudancas = useMemo(() => (leitura ? mudancasDe(orig, v, modulos, leitura.config.modulos) : []), [orig, v, modulos, leitura]);
  const erros = useMemo(() => {
    const e: Record<string, string> = {};
    if (!String(v['projeto.nome'] ?? '').trim()) e['projeto.nome'] = 'O nome é obrigatório.';
    if (!String(v['projeto.versao'] ?? '').trim()) e['projeto.versao'] = 'A versão é obrigatória.';
    for (const [k] of CORES) if (!HEX.test(String(v[`identidade.cores.${k}`]))) e[`identidade.cores.${k}`] = 'Use o formato #RRGGBB.';
    const larg = Number(v.largura_captura);
    if (!Number.isInteger(larg) || larg < 320 || larg > 3840) e.largura_captura = 'Entre 320 e 3840.';
    return e;
  }, [v]);

  useEffect(() => {
    mudancasPendentes.value = mudancas.length > 0;
    if (!leitura?.existe || !mudancas.length || Object.keys(erros).length) return setDiff([]);
    const t = setTimeout(() => void invocar<{ diff: { tipo: string; texto: string }[] }>('config:previa', { arquivo: 'projeto.yml', mudancas }).then((r) => setDiff(r.diff)).catch(() => setDiff([])), 200);
    return () => clearTimeout(t);
  }, [mudancas, erros, leitura]);

  if (!leitura) return <p>Lendo a configuração…</p>;
  if (!leitura.existe) {
    return (
      <section aria-labelledby="t-config">
        <h1 id="t-config">Configuração</h1>
        <p class="aviso atencao">Este projeto usa {projeto.value?.fonte === 'config.properties' ? 'o config.properties do Pirilampo' : 'a configuração padrão'}. Crie o projeto.yml para editar a configuração aqui.</p>
        <button
          type="button"
          class="botao primario"
          data-testid="config-criar-projeto-yml"
          onClick={async () => {
            try {
              const origem = projeto.value?.fonte;
              projeto.value = await invocar<ProjetoAberto>('config:criarProjetoYml');
              await carregar();
              avisar('ok', origem === 'config.properties' ? 'projeto.yml criado a partir do config.properties.' : 'projeto.yml criado com a configuração padrão. Ajuste nome, órgão, logo e cores.');
            } catch (e) {
              avisar('erro', textoDoErro(e));
            }
          }}
        >
          Criar projeto.yml
        </button>
      </section>
    );
  }

  const set = (k: string) => (x: unknown) => setV({ ...v, [k]: x });
  const perfis = Object.keys(leitura.config.perfis);

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await invocar<{ projeto: ProjetoAberto; alteradas: number; texto: string }>('config:salvar', { arquivo: 'projeto.yml', mudancas, base: leitura.texto });
      projeto.value = r.projeto;
      await carregar();
      avisar('ok', `Configuração salva. ${r.alteradas} ${r.alteradas === 1 ? 'linha alterada' : 'linhas alteradas'} no projeto.yml.`);
    } catch (e) {
      avisar('erro', textoDoErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section aria-labelledby="t-config" onKeyDown={(e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (mudancas.length && !Object.keys(erros).length) void salvar();
      }
    }}>
      <h1 id="t-config">Configuração</h1>
      <p class="sec"><code>{leitura.caminho}</code> · as mudanças preservam os comentários e a ordem do arquivo.</p>
      <div class="acoes">
        <button type="button" class="botao primario" data-testid="config-salvar" disabled={!mudancas.length || !!Object.keys(erros).length || salvando} onClick={salvar}>
          Salvar (Ctrl+S)
        </button>
        <button type="button" class="botao" data-testid="config-descartar" disabled={!mudancas.length} onClick={() => void carregar()}>
          Descartar mudanças
        </button>
        <button type="button" class="botao" onClick={() => void invocar('sistema:abrirArquivo', { alvo: 'projeto.yml' })}>
          Abrir no editor
        </button>
        <span aria-live="polite" class="sec">{mudancas.length ? `${mudancas.length} ${mudancas.length === 1 ? 'mudança' : 'mudanças'} não salvas` : 'Sem mudanças'}</span>
      </div>

      <fieldset>
        <legend>Projeto</legend>
        <div class="linha-campos">
          <Campo id="projeto-nome" rotulo="Nome" valor={v['projeto.nome']} erro={erros['projeto.nome']} aoMudar={set('projeto.nome')} />
          <Campo id="projeto-versao" rotulo="Versão" valor={v['projeto.versao']} erro={erros['projeto.versao']} aoMudar={set('projeto.versao')} />
          <Campo id="projeto-orgao" rotulo="Órgão ou cliente" valor={v['projeto.orgao']} aoMudar={set('projeto.orgao')} />
        </div>
        <CampoLogo id="logo" chave="projeto.logo" rotulo="Logo" valor={String(v['projeto.logo'] ?? '')} aoMudar={set('projeto.logo')} />
        <CampoLogo id="logo-claro" chave="projeto.logo_claro" rotulo="Logo para fundo claro (cabeçalho do gov.br)" valor={String(v['projeto.logo_claro'] ?? '')} aoMudar={set('projeto.logo_claro')} />
      </fieldset>

      <fieldset>
        <legend>Identidade</legend>
        <Escolha id="identidade-design-system" rotulo="Kit de design" valor={v['identidade.design_system']} opcoes={[['proprio', 'Próprio (tokens do projeto)'], ['govbr', 'gov.br DS (cores e fonte do padrão)']]} aoMudar={set('identidade.design_system')} />
        <div class="linha-campos">
          {CORES.map(([k, r]) => {
            const chave = `identidade.cores.${k}`;
            const valor = String(v[chave] ?? '');
            return (
              <div class="campo" key={k}>
                <label for={`cor-${k}-hex`}>{r}</label>
                <div class="cor">
                  <input type="color" aria-label={`${r}: seletor de cor`} data-testid={`config-cor-${k}`} value={HEX.test(valor) ? valor.toLowerCase() : '#000000'} onInput={(e) => set(chave)(e.currentTarget.value.toUpperCase())} />
                  <input id={`cor-${k}-hex`} type="text" data-testid={`config-cor-${k}-hex`} value={valor} maxLength={7} aria-invalid={erros[chave] ? 'true' : undefined} aria-describedby={erros[chave] ? `cor-${k}-erro` : undefined} onInput={(e) => set(chave)(e.currentTarget.value.toUpperCase())} />
                  {erros[chave] && <span class="erro" id={`cor-${k}-erro`}>{erros[chave]}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <h3>Contraste</h3>
        <ul aria-live="polite" data-testid="config-contraste">
          {PARES.map(([a, b, r]) => {
            const ca = String(v[`identidade.cores.${a}`]);
            const cb = String(v[`identidade.cores.${b}`]);
            if (!HEX.test(ca) || !HEX.test(cb)) return null;
            const c = contraste(ca, cb);
            return (
              <li key={r} class={`contraste ${c >= 4.5 ? 'ok' : 'baixo'}`}>
                {r}: {c.toFixed(2)}:1 — {c >= 4.5 ? 'AA' : 'abaixo de AA (mínimo 4,5:1)'}
              </li>
            );
          })}
        </ul>
        <div class="linha-campos">
          <Escolha id="identidade-fontes-titulo" rotulo="Fonte dos títulos" valor={v['identidade.fontes.titulo']} opcoes={FONTES.map((f) => [f, f])} aoMudar={set('identidade.fontes.titulo')} />
          <Escolha id="identidade-fontes-texto" rotulo="Fonte do texto" valor={v['identidade.fontes.texto']} opcoes={FONTES.map((f) => [f, f])} aoMudar={set('identidade.fontes.texto')} />
        </div>
        <Campo id="identidade-css-adicional" rotulo="CSS adicional (caminho relativo às especificações)" valor={v['identidade.css_adicional']} aoMudar={set('identidade.css_adicional')} />
      </fieldset>

      <fieldset>
        <legend>Telas</legend>
        <div class="linha-campos">
          <Campo id="largura-captura" rotulo="Largura de captura (px)" tipo="number" valor={v.largura_captura} erro={erros.largura_captura} aoMudar={(x) => set('largura_captura')(Number(x))} />
          <Campo id="padroes-paginacao" rotulo="Linhas por página" tipo="number" valor={v['padroes.paginacao']} aoMudar={(x) => set('padroes.paginacao')(Number(x))} />
          <Campo id="padroes-container-max" rotulo="Largura máxima (px)" tipo="number" valor={v['padroes.container_max']} aoMudar={(x) => set('padroes.container_max')(Number(x))} />
        </div>
        <Marca id="padroes-listas" rotulo="Listas sempre em tela (nunca em janela)" valor={v['padroes.listas_sempre_em_tela']} aoMudar={set('padroes.listas_sempre_em_tela')} />
        <Marca id="captura-celular" rotulo="Também capturar em celular (390 px, <tela>-celular.png)" valor={v['captura.celular']} aoMudar={set('captura.celular')} />
        <Marca id="padroes-selo" rotulo="Selo de situação nas colunas Situação/Status (no kit gov.br é sempre ligado)" valor={v['padroes.selo_situacao']} aoMudar={set('padroes.selo_situacao')} />
        <Campo id="cascas-conta" rotulo="Itens da conta no menu autenticado" ajuda="Separados por vírgula." valor={v['cascas.autenticada.conta_no_pe']} aoMudar={set('cascas.autenticada.conta_no_pe')} />
        <div class="campo">
          <label for="perfis">Perfis e itens de menu</label>
          <textarea id="perfis" rows={4} data-testid="config-perfis" aria-describedby="perfis-ajuda" value={String(v.perfis)} onInput={(e) => set('perfis')(e.currentTarget.value)} />
          <span class="ajuda" id="perfis-ajuda">Um perfil por linha: Nome: item 1, item 2</span>
        </div>
        <h3 id="t-modulos">Módulos</h3>
        <table aria-labelledby="t-modulos" data-testid="config-modulos">
          <thead><tr><th scope="col">Pasta</th><th scope="col">Casca</th><th scope="col">Perfil</th></tr></thead>
          <tbody>
            {leitura.pastas.filter((x) => !/regras|mensagem/i.test(x)).map((pasta) => (
              <tr key={pasta}>
                <th scope="row"><code>{pasta}</code></th>
                <td>
                  <select aria-label={`Casca de ${pasta}`} value={modulos[pasta]?.casca ?? ''} onChange={(e) => setModulos({ ...modulos, [pasta]: { ...modulos[pasta], casca: e.currentTarget.value || undefined } })}>
                    <option value="">(padrão)</option><option value="publica">pública</option><option value="autenticada">autenticada</option>
                  </select>
                </td>
                <td>
                  <select aria-label={`Perfil de ${pasta}`} value={modulos[pasta]?.perfil ?? ''} onChange={(e) => setModulos({ ...modulos, [pasta]: { ...modulos[pasta], perfil: e.currentTarget.value || undefined } })}>
                    <option value="">(nenhum)</option>
                    {perfis.map((pf) => <option key={pf} value={pf}>{pf}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div class="campo">
          <label for="mascaras">Máscaras</label>
          <textarea id="mascaras" rows={4} value={String(v.mascaras)} aria-describedby="mascaras-ajuda" onInput={(e) => set('mascaras')(e.currentTarget.value)} />
          <span class="ajuda" id="mascaras-ajuda">Uma por linha: Nome: máscara (várias separadas por |). # dígito, A letra, X letra ou dígito.</span>
        </div>
        <div class="linha-campos">
          <Escolha id="dados-cnpj" rotulo="CNPJ fictício" valor={v['dados_ficticios.cnpj']} opcoes={[['numerico', 'Numérico'], ['alfanumerico', 'Alfanumérico (IN RFB 2.229/2024)']]} aoMudar={set('dados_ficticios.cnpj')} />
          <Campo id="dados-sufixo" rotulo="Sufixo dos nomes fictícios" valor={v['dados_ficticios.sufixo_nomes']} aoMudar={set('dados_ficticios.sufixo_nomes')} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Documentação e PDF</legend>
        <Marca id="doc-unico" rotulo="Arquivo único (um index.html só)" valor={v['documentacao.arquivo_unico']} aoMudar={set('documentacao.arquivo_unico')} />
        <Marca id="doc-prototipo-aberto" rotulo="Protótipo aberto nas páginas" valor={v['documentacao.prototipo_aberto']} aoMudar={set('documentacao.prototipo_aberto')} />
        <div class="linha-campos">
          <Escolha id="doc-pdf" rotulo="Orientação do PDF" valor={v['documentacao.pdf']} opcoes={[['retrato', 'Retrato'], ['paisagem', 'Paisagem']]} aoMudar={set('documentacao.pdf')} />
          <Campo id="doc-comparar" rotulo="Versão anterior padrão" ajuda="Pasta, branch, tag ou commit. Vazio = sem comparação." valor={v['documentacao.comparar_com']} aoMudar={set('documentacao.comparar_com')} />
        </div>
      </fieldset>

      {diff.length > 0 && (
        <section aria-labelledby="t-diff">
          <h2 id="t-diff">O que muda no projeto.yml</h2>
          <pre class="diff" data-testid="config-diff" tabIndex={0}>
            {diff.map((d, i) => (
              <span key={i} class={d.tipo === 'incluida' ? 'inc' : 'rem'}>{d.tipo === 'incluida' ? '+ ' : '- '}{d.texto}{'\n'}</span>
            ))}
          </pre>
        </section>
      )}
    </section>
  );
}
