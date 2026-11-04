import { useEffect, useState } from 'preact/hooks';
import type { ResultadoComparacaoVisao } from '../../comum/tipos.js';
import { avisar, invocar, ocupado, projeto, rodarTarefa, textoDoErro, tela } from '../estado.js';

export function Comparar() {
  const [tipo, setTipo] = useState<'pasta' | 'ref'>(projeto.value?.git ? 'ref' : 'pasta');
  const [refs, setRefs] = useState<string[]>([]);
  const [ref, setRef] = useState('');
  const [pasta, setPasta] = useState('');
  const [r, setR] = useState<ResultadoComparacaoVisao>();
  const [aberta, setAberta] = useState<string>();

  useEffect(() => void invocar<string[]>('comparar:refs').then((x) => {
    setRefs(x);
    if (x[0] && !ref) setRef(x.find((y) => /^(main|master)$/.test(y)) ?? x[0]);
  }), []);

  const valor = tipo === 'ref' ? ref.trim() : pasta;
  const comparar = async () => {
    try {
      const res = await rodarTarefa<ResultadoComparacaoVisao>('comparar', { comparar: valor });
      if (res) {
        setR(res);
        setAberta(undefined);
        avisar('ok', `Comparado com ${res.versao}: ${res.novas.length} novas, ${res.alteradas.length} alteradas, ${res.removidas.length} removidas.`);
      }
    } catch (e) {
      avisar('erro', textoDoErro(e));
    }
  };

  return (
    <section aria-labelledby="t-comp">
      <h1 id="t-comp">Comparar versões</h1>
      <div role="radiogroup" aria-label="Versão anterior" class="acoes">
        <label><input type="radio" name="tipo" data-testid="comparar-tipo-pasta" checked={tipo === 'pasta'} onChange={() => setTipo('pasta')} /> Pasta</label>
        <label>
          <input type="radio" name="tipo" data-testid="comparar-tipo-ref" checked={tipo === 'ref'} disabled={!projeto.value?.git} onChange={() => setTipo('ref')} /> Branch, tag ou commit
          {!projeto.value?.git && <span class="sec"> (as especificações não estão num repositório Git, ou o Git não está instalado)</span>}
        </label>
      </div>
      {tipo === 'pasta' ? (
        <div class="acoes">
          <button type="button" class="botao" data-testid="comparar-pasta" onClick={async () => setPasta((await invocar<string | undefined>('sistema:escolherPasta', { titulo: 'Pasta com a versão anterior' })) ?? pasta)}>Escolher pasta…</button>
          <code>{pasta || 'nenhuma escolhida'}</code>
        </div>
      ) : (
        <div class="campo">
          <label for="comparar-ref">Branch, tag ou commit</label>
          <input id="comparar-ref" type="text" list="lista-refs" data-testid="comparar-ref" value={ref} onInput={(e) => setRef(e.currentTarget.value)} />
          <datalist id="lista-refs">{refs.map((x) => <option key={x} value={x} />)}</datalist>
        </div>
      )}
      <div class="acoes">
        <button type="button" class="botao primario" data-testid="comparar-executar" disabled={!valor || ocupado.value} onClick={comparar}>Comparar</button>
        {r && (
          <>
            <button type="button" class="botao" onClick={() => (tela.value = 'documentacao')}>Gerar documentação ou PDF com a comparação</button>
          </>
        )}
      </div>
      {r && (
        <>
          <h2>Novas ({r.novas.length})</h2>
          <ul class="lista">
            {r.novas.map((x) => <li key={x.endereco}><button type="button" class="item" data-testid={`comparar-item-${x.endereco}`} onClick={() => setAberta(x.url)}>{x.titulo} <span class="sec">{x.endereco}</span></button></li>)}
          </ul>
          <h2>Alteradas ({r.alteradas.length})</h2>
          <ul class="lista">
            {r.alteradas.map((x) => <li key={x.endereco}><button type="button" class="item" data-testid={`comparar-item-${x.endereco}`} onClick={() => setAberta(x.url)}>{x.titulo} <span class="sec">{x.cenarios} {x.cenarios === 1 ? 'cenário mudado' : 'cenários mudados'}</span></button></li>)}
          </ul>
          <h2>Removidas ({r.removidas.length})</h2>
          <ul class="lista">{r.removidas.map((x) => <li key={x.endereco} class="item">{x.titulo} <code>{x.endereco}</code></li>)}</ul>
          {r.renomeadas.length > 0 && (
            <>
              <h2>Possíveis renomeações</h2>
              <ul>{r.renomeadas.map((x) => <li key={x.de}><code>{x.de}</code> → <code>{x.para}</code></li>)}</ul>
            </>
          )}
        </>
      )}
      {aberta && (
        <section aria-label="Funcionalidade com as mudanças">
          <div class="acoes"><button type="button" class="botao pequeno" onClick={() => setAberta(undefined)}>Fechar</button></div>
          <div class="moldura inteira" style="height:640px">
            <iframe src={aberta} title="Funcionalidade com as mudanças destacadas" style="width:100%;height:100%;transform:none" sandbox="allow-same-origin allow-scripts" data-testid="comparar-iframe" />
          </div>
        </section>
      )}
    </section>
  );
}
