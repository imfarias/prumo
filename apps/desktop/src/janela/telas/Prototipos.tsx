import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { TelaVisao } from '../../comum/tipos.js';
import { avisar, invocar, ocupado, rodarTarefa, textoDoErro, versaoPrevia } from '../estado.js';

const LAYOUTS = ['', 'listagem', 'formulario', 'formulario-etapas', 'leitura', 'api'];
const COMPONENTES = ['', 'texto', 'mascara', 'email', 'tel', 'data', 'valor', 'numero', 'selecao', 'confirmacao', 'caixa', 'captcha', 'arquivos', 'texto-longo', 'senha', 'leitura'];
const LARGURAS = ['', '1/4', '1/3', '1/2', '2/3', '3/4', '1/1'];
type Override = { layout?: string; campos?: Record<string, { componente?: string; largura?: string }> };

export function Prototipos() {
  const [telas, setTelas] = useState<TelaVisao[]>();
  const [modulo, setModulo] = useState('');
  const [filtro, setFiltro] = useState('');
  const [aberta, setAberta] = useState<TelaVisao>();
  const [estado, setEstado] = useState(0);
  const [escala, setEscala] = useState(0.5);
  // 0004: largura de celular e "Simular erro" na prévia (o protótipo dentro do iframe guarda o modo).
  const [largura, setLargura] = useState<1440 | 390>(1440);
  const [simular, setSimular] = useState(false);
  const quadro = useRef<HTMLIFrameElement>(null);
  const avisarSimular = (v: boolean) => quadro.current?.contentWindow?.postMessage({ prumo: 'simular', valor: v }, '*');
  const [ov, setOv] = useState<Override>({});
  const [ovOrig, setOvOrig] = useState<Override>({});
  const [base, setBase] = useState('');
  const [diff, setDiff] = useState<{ tipo: string; texto: string }[]>([]);

  const carregar = async () => {
    try {
      const t = await invocar<TelaVisao[]>('prototipos:listar');
      setTelas(t);
      if (aberta) setAberta(t.find((x) => x.id === aberta.id));
    } catch (e) {
      avisar('erro', textoDoErro(e));
    }
  };
  useEffect(() => void carregar(), [versaoPrevia.value]);

  const abrir = async (t: TelaVisao) => {
    setAberta(t);
    setEstado(0);
    const l = await invocar<{ texto: string; dados: unknown }>('config:ler', { arquivo: 'telas.overrides.yml' });
    setBase(l.texto);
    const atual = overrideDe(l.dados, t.id);
    setOv(structuredClone(atual));
    setOvOrig(atual);
  };

  const mudancas = useMemo(() => {
    if (!aberta) return [];
    const m: { caminho: string[]; valor?: unknown; remover?: boolean }[] = [];
    if ((ov.layout ?? '') !== (ovOrig.layout ?? '')) m.push(ov.layout ? { caminho: [aberta.id, 'layout'], valor: ov.layout } : { caminho: [aberta.id, 'layout'], remover: true });
    for (const c of aberta.campos) {
      for (const k of ['componente', 'largura'] as const) {
        const a = ov.campos?.[c.nome]?.[k] ?? '';
        const b = ovOrig.campos?.[c.nome]?.[k] ?? '';
        if (a !== b) m.push(a ? { caminho: [aberta.id, 'campos', c.nome, k], valor: a } : { caminho: [aberta.id, 'campos', c.nome, k], remover: true });
      }
    }
    return m;
  }, [ov, ovOrig, aberta]);

  useEffect(() => {
    if (!mudancas.length) return setDiff([]);
    void invocar<{ diff: { tipo: string; texto: string }[] }>('config:previa', { arquivo: 'telas.overrides.yml', mudancas }).then((r) => setDiff(r.diff)).catch((e) => avisar('erro', textoDoErro(e)));
  }, [mudancas]);

  const gerarPng = async (parametros: Record<string, unknown>, rotulo: string) => {
    try {
      const r = await rodarTarefa<{ gravados: number; semMudanca: number }>('capturar', parametros);
      if (r) avisar('ok', `${rotulo}: ${r.gravados} PNGs gravados, ${r.semMudanca} sem mudança.`);
      await carregar();
    } catch (e) {
      avisar('erro', textoDoErro(e));
    }
  };

  if (!telas) return <p>Preparando os protótipos…</p>;
  const modulos = [...new Set(telas.map((t) => t.modulo))];
  const visiveis = telas.filter((t) => (!modulo || t.modulo === modulo) && (!filtro || `${t.titulo} ${t.id}`.toLowerCase().includes(filtro.toLowerCase())));
  const est = aberta?.estados[estado];

  return (
    <section aria-labelledby="t-proto">
      <h1 id="t-proto">Protótipos</h1>
      <div class="linha-campos">
        <div class="campo">
          <label for="proto-modulo">Módulo</label>
          <select id="proto-modulo" value={modulo} onChange={(e) => setModulo(e.currentTarget.value)} data-testid="prototipos-modulo">
            <option value="">Todos</option>
            {modulos.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div class="campo">
          <label for="proto-filtro">Filtrar</label>
          <input id="proto-filtro" type="text" value={filtro} onInput={(e) => setFiltro(e.currentTarget.value)} />
        </div>
      </div>
      <div class="acoes">
        <button type="button" class="botao primario" data-testid="prototipos-gerar-modulo" disabled={!modulo || ocupado.value} onClick={() => gerarPng({ modulos: [modulo] }, `Módulo ${modulo}`)}>
          Gerar PNGs do módulo
        </button>
        <button type="button" class="botao" data-testid="prototipos-gerar-tudo" disabled={ocupado.value} onClick={() => gerarPng({}, 'Todas as telas')}>
          Gerar PNGs de todas
        </button>
        <button
          type="button"
          class="botao"
          data-testid="prototipos-comparar-png"
          disabled={ocupado.value}
          onClick={async () => {
            try {
              const r = await rodarTarefa<{ relatorio: string; itens: unknown[] }>('comparar-png', modulo ? { modulos: [modulo] } : {});
              if (r) {
                avisar('ok', `${r.itens.length} telas comparadas com os PNGs atuais.`);
                await invocar('docs:abrirNoNavegador', { alvo: 'comparacao' });
              }
            } catch (e) {
              avisar('erro', textoDoErro(e));
            }
          }}
        >
          Comparar com os PNGs atuais
        </button>
      </div>

      {aberta && est && (
        <section class="painel" aria-labelledby="t-tela" data-testid="prototipos-painel">
          <div>
            <h2 id="t-tela">{aberta.titulo} <small class="sec">{aberta.id} · {aberta.layout}</small></h2>
            <div class="acoes" role="group" aria-label="Estado da tela">
              {aberta.estados.map((e, i) => (
                <button key={e.id} type="button" class="botao pequeno" aria-pressed={i === estado} onClick={() => setEstado(i)} data-testid={`prototipos-estado-${e.id}`}>{e.id}</button>
              ))}
              <label class="sec">
                Zoom{' '}
                <select value={String(escala)} onChange={(e) => setEscala(Number(e.currentTarget.value))} aria-label="Zoom do protótipo">
                  <option value="0.4">40%</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option>
                </select>
              </label>
              <span role="group" aria-label="Largura" class="acoes">
                <button type="button" class="botao pequeno" aria-pressed={largura === 1440} data-testid="prototipos-computador" onClick={() => setLargura(1440)}>Computador</button>
                <button type="button" class="botao pequeno" aria-pressed={largura === 390} data-testid="prototipos-celular" onClick={() => setLargura(390)}>Celular</button>
              </span>
              <button
                type="button"
                class="botao pequeno"
                aria-pressed={simular}
                data-testid="prototipos-simular"
                onClick={() => {
                  setSimular(!simular);
                  avisarSimular(!simular);
                  avisar('ok', !simular ? 'Simular erro ligado: as ações da prévia mostram os erros dos cenários.' : 'Simular erro desligado.');
                }}
              >
                Simular erro
              </button>
              <button type="button" class="botao pequeno primario" data-testid="prototipos-gerar-tela" disabled={ocupado.value} onClick={() => gerarPng({ telas: [aberta.id] }, aberta.titulo)}>Gerar PNG desta tela</button>
              <button type="button" class="botao pequeno" onClick={() => setAberta(undefined)}>Fechar</button>
            </div>
            <div class="moldura">
              <iframe ref={quadro} key={`${est.url}-${versaoPrevia.value}`} src={est.url} title={`Protótipo: ${aberta.titulo} — ${est.id}`} style={`transform:scale(${largura === 390 ? 1 : escala});width:${largura}px;height:1400px`} data-testid="prototipos-iframe" sandbox="allow-same-origin allow-scripts" onLoad={() => simular && avisarSimular(true)} />
            </div>
          </div>
          <div>
            <h3 id="t-sinais">Sinais da inferência</h3>
            <table aria-labelledby="t-sinais" data-testid="prototipos-sinais">
              <thead><tr><th scope="col">Campo</th><th scope="col">Componente</th><th scope="col">Por quê</th></tr></thead>
              <tbody>
                {aberta.campos.map((c) => (
                  <tr key={`${c.grupo}-${c.nome}`}><td>{c.nome} <small class="sec">{c.grupo}</small></td><td><code>{c.componente}</code></td><td>{c.sinais.join('; ') || '—'}</td></tr>
                ))}
              </tbody>
            </table>
            {aberta.sinais.length > 0 && <p class="sec">Tela: {aberta.sinais.join('; ')}</p>}

            <h3>Ajustar (telas.overrides.yml)</h3>
            <div class="campo">
              <label for="ov-layout">Layout</label>
              <select id="ov-layout" value={ov.layout ?? ''} data-testid="prototipos-override-layout" onChange={(e) => setOv({ ...ov, layout: e.currentTarget.value || undefined })}>
                {LAYOUTS.map((l) => <option key={l} value={l}>{l || '(o inferido)'}</option>)}
              </select>
            </div>
            <table aria-label="Ajustes por campo">
              <thead><tr><th scope="col">Campo</th><th scope="col">Componente</th><th scope="col">Largura</th></tr></thead>
              <tbody>
                {aberta.campos.filter((c, i, l) => l.findIndex((x) => x.nome === c.nome) === i).map((c) => (
                  <tr key={c.nome}>
                    <th scope="row">{c.nome}</th>
                    {(['componente', 'largura'] as const).map((k) => (
                      <td key={k}>
                        <select aria-label={`${k === 'componente' ? 'Componente' : 'Largura'} de ${c.nome}`} data-testid={`prototipos-override-${k}-${c.nome}`} value={ov.campos?.[c.nome]?.[k] ?? ''}
                          onChange={(e) => setOv({ ...ov, campos: { ...ov.campos, [c.nome]: { ...ov.campos?.[c.nome], [k]: e.currentTarget.value || undefined } } })}>
                          {(k === 'componente' ? COMPONENTES : LARGURAS).map((x) => <option key={x} value={x}>{x || '(inferido)'}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {diff.length > 0 && (
              <>
                <h3 id="t-ov-diff">O que muda no telas.overrides.yml</h3>
                <pre class="diff" data-testid="prototipos-override-diff" aria-labelledby="t-ov-diff" tabIndex={0}>
                  {diff.map((d, i) => <span key={i} class={d.tipo === 'incluida' ? 'inc' : 'rem'}>{d.tipo === 'incluida' ? '+ ' : '- '}{d.texto}{'\n'}</span>)}
                </pre>
              </>
            )}
            <div class="acoes">
              <button
                type="button"
                class="botao primario"
                disabled={!mudancas.length}
                data-testid="prototipos-override-salvar"
                onClick={async () => {
                  try {
                    const r = await invocar<{ texto: string }>('config:salvar', { arquivo: 'telas.overrides.yml', mudancas, base });
                    setBase(r.texto);
                    setOvOrig(structuredClone(ov));
                    await rodarTarefa('gerar', { telas: [aberta.id] });
                    await carregar();
                    avisar('ok', 'Ajuste salvo no telas.overrides.yml e protótipo atualizado.');
                  } catch (e) {
                    avisar('erro', textoDoErro(e));
                  }
                }}
              >
                Salvar ajuste
              </button>
            </div>
          </div>
        </section>
      )}

      <h2 class="sr">Telas</h2>
      <ul class="grade" style="list-style:none;padding:0" aria-label="Telas">
        {visiveis.map((t) => (
          <li key={t.id}>
            <button type="button" class="cartao" data-testid={`prototipos-tela-${t.id}`} aria-current={aberta?.id === t.id ? 'true' : undefined} onClick={() => void abrir(t)}>
              {t.miniatura ? <img src={`${t.miniatura}?v=${versaoPrevia.value}`} alt="" /> : <span class="sem-imagem">sem PNG</span>}
              <span><b>{t.titulo}</b></span>
              <small>{t.modulo} · {t.layout}</small>
            </button>
          </li>
        ))}
      </ul>
      {!visiveis.length && <p>Nenhuma tela com esses filtros.</p>}
    </section>
  );
}

/** Override atual da tela, a partir do telas.overrides.yml interpretado pelo processo principal. */
function overrideDe(dados: unknown, id: string): Override {
  const t = (dados as Record<string, { layout?: string; campos?: Record<string, { componente?: string; largura?: string }> }> | undefined)?.[id];
  if (!t || typeof t !== 'object') return {};
  const campos: Override['campos'] = {};
  for (const [nome, c] of Object.entries(t.campos ?? {})) campos[nome] = { componente: c?.componente, largura: c?.largura };
  return { layout: typeof t.layout === 'string' ? t.layout : undefined, campos };
}
