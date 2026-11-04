import { useState } from 'preact/hooks';
import type { AchadoVisao, ProjetoAberto } from '../../comum/tipos.js';
import { avisar, invocar, projeto, rodarTarefa, textoDoErro } from '../estado.js';

const ROTULO = { erro: 'erro', aviso: 'aviso', info: 'info' } as const;

export function Verificacao() {
  const p = projeto.value!;
  const [agrupar, setAgrupar] = useState<'tipo' | 'arquivo'>('tipo');
  const [mostrar, setMostrar] = useState({ erro: true, aviso: true, info: false });
  const [filtro, setFiltro] = useState('');

  const lista = p.achados.filter((a) => mostrar[a.severidade] && (!filtro || `${a.arquivo} ${a.codigo} ${a.mensagem}`.toLowerCase().includes(filtro.toLowerCase())));
  const grupos = new Map<string, AchadoVisao[]>();
  for (const a of lista) {
    const k = agrupar === 'tipo' ? a.codigo : a.arquivo;
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  let indice = 0;

  const abrir = async (a: AchadoVisao) => {
    try {
      const r = await invocar<{ abriu: string; linha?: number }>('verificacao:abrirNoEditor', { arquivo: a.arquivo, linha: a.linha });
      if (r.abriu === 'sistema' && a.linha) avisar('atencao', `Aberto no aplicativo padrão. Vá até a linha ${a.linha}.`);
    } catch (e) {
      avisar('erro', textoDoErro(e));
    }
  };

  return (
    <section aria-labelledby="t-verif">
      <h1 id="t-verif">Verificação</h1>
      <p data-testid="verificacao-resumo">
        <b>{p.erros} {p.erros === 1 ? 'erro' : 'erros'}, {p.avisos} {p.avisos === 1 ? 'aviso' : 'avisos'}</b> · verificado em {new Date(p.verificadoEm).toLocaleString('pt-BR')}
      </p>
      <div class="acoes">
        <button
          type="button"
          class="botao primario"
          data-testid="verificacao-verificar"
          onClick={async () => {
            try {
              const r = await rodarTarefa<ProjetoAberto>('verificar');
              if (r) projeto.value = r;
            } catch (e) {
              avisar('erro', textoDoErro(e));
            }
          }}
        >
          Verificar de novo (F5)
        </button>
        <button
          type="button"
          class="botao"
          onClick={async () => {
            const arq = await invocar<string | undefined>('verificacao:exportar');
            if (arq) avisar('ok', `Exportado: ${arq}`);
          }}
        >
          Exportar JSON
        </button>
      </div>
      <div class="linha-campos">
        <fieldset data-testid="verificacao-agrupar">
          <legend>Agrupar por</legend>
          {(['tipo', 'arquivo'] as const).map((g) => (
            <label key={g} style="margin-right:12px">
              <input type="radio" name="agrupar" checked={agrupar === g} onChange={() => setAgrupar(g)} /> {g === 'tipo' ? 'tipo do problema' : 'arquivo'}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Mostrar</legend>
          {(['erro', 'aviso', 'info'] as const).map((s) => (
            <label key={s} style="margin-right:12px">
              <input type="checkbox" data-testid={`verificacao-filtro-${s}`} checked={mostrar[s]} onChange={(e) => setMostrar({ ...mostrar, [s]: e.currentTarget.checked })} /> {s === 'erro' ? 'erros' : s === 'aviso' ? 'avisos' : 'informações'}
            </label>
          ))}
        </fieldset>
        <div class="campo">
          <label for="verif-filtro">Filtrar</label>
          <input id="verif-filtro" type="text" value={filtro} onInput={(e) => setFiltro(e.currentTarget.value)} />
        </div>
      </div>
      {!lista.length && <p class="aviso ok">Nenhum problema com os filtros atuais.</p>}
      {[...grupos].map(([g, itens]) => (
        <section key={g} aria-label={g}>
          <h2>
            <code>{g}</code> <small>({itens.length})</small>
          </h2>
          <ul class="lista">
            {itens.map((a) => {
              const i = indice++;
              return (
                <li key={i}>
                  <button type="button" class="item" data-testid={`verificacao-achado-${i}`} onClick={() => abrir(a)} aria-label={`${ROTULO[a.severidade]}: ${a.arquivo}${a.linha ? ` linha ${a.linha}` : ''}. ${a.mensagem}. Abrir no editor`}>
                    <span class={`sev ${a.severidade}`}>{ROTULO[a.severidade]}</span>
                    <span>
                      <code>{a.arquivo}{a.linha ? `:${a.linha}` : ''}</code> {a.mensagem}
                      {a.sugestao && <span class="sec"> · {a.sugestao}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
