import { useEffect, useState } from 'preact/hooks';
import type { TelaVisao } from '../../comum/tipos.js';
import { avisar, invocar, ocupado, projeto, rodarTarefa, textoDoErro } from '../estado.js';

interface ResultadoDocs {
  saida: string;
  modo: string;
  tamanho: number;
  avisos: string[];
  url: string;
}

export function Documentacao() {
  const [modo, setModo] = useState<'pasta' | 'unico'>('pasta');
  const [saida, setSaida] = useState<string>();
  const [docs, setDocs] = useState<ResultadoDocs>();
  const [verAqui, setVerAqui] = useState(false);
  const [telas, setTelas] = useState<TelaVisao[]>([]);
  const [recorte, setRecorte] = useState<'tudo' | 'modulos' | 'telas'>('tudo');
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [orientacao, setOrientacao] = useState<'retrato' | 'paisagem'>('retrato');
  const [comparar, setComparar] = useState('');
  const [soMudancas, setSoMudancas] = useState(false);
  const [pdf, setPdf] = useState<{ arquivo: string; paginas: number }>();

  useEffect(() => void invocar<TelaVisao[]>('prototipos:listar').then(setTelas).catch(() => setTelas([])), []);
  const modulos = [...new Set(telas.map((t) => t.modulo))];

  const gerarDocs = async () => {
    try {
      const r = await rodarTarefa<ResultadoDocs>('docs', { arquivoUnico: modo === 'unico', saida, comparar: comparar || undefined });
      if (!r) return;
      setDocs(r);
      avisar('ok', `Documentação gerada em ${r.saida} (${Math.max(1, Math.round(r.tamanho / 1024))} KB).${r.avisos.length ? ` Aviso: ${r.avisos.join(' ')}` : ''}`);
    } catch (e) {
      avisar('erro', textoDoErro(e));
    }
  };
  const gerarPdf = async () => {
    try {
      const nome = `${projeto.value!.nome.replace(/[^\p{L}\p{N}]+/gu, '-')}-${projeto.value!.versao}.pdf`;
      const destino = await invocar<string | undefined>('sistema:salvarComo', { nome });
      if (!destino) return;
      const p = { saida: destino, orientacao, soMudancas: soMudancas || undefined, comparar: comparar || undefined, modulos: recorte === 'modulos' ? escolhidos : undefined, telas: recorte === 'telas' ? escolhidos : undefined };
      const r = await rodarTarefa<{ arquivo: string; paginas: number }>('pdf', p);
      if (!r) return;
      setPdf(r);
      avisar('ok', `PDF gerado: ${r.paginas} páginas · ${r.arquivo}`);
    } catch (e) {
      avisar('erro', textoDoErro(e));
    }
  };

  const opcoes = recorte === 'modulos' ? modulos.map((m) => [m, m]) : telas.map((t) => [t.id, `${t.titulo} (${t.modulo})`]);
  return (
    <section aria-labelledby="t-docs">
      <h1 id="t-docs">Documentação e PDF</h1>
      <fieldset>
        <legend>Documentação navegável</legend>
        <div role="radiogroup" aria-label="Modo" class="acoes">
          {(['pasta', 'unico'] as const).map((m) => (
            <label key={m}>
              <input type="radio" name="modo" data-testid={`docs-modo-${m}`} checked={modo === m} onChange={() => setModo(m)} /> {m === 'pasta' ? 'Site em pasta' : 'Arquivo único (um index.html)'}
            </label>
          ))}
        </div>
        <div class="campo">
          <span class="rotulo" id="docs-saida-r">Pasta de saída</span>
          <div class="acoes">
            <code>{saida ?? 'padrão: ../html, ao lado das especificações (o lugar do Pirilampo)'}</code>
            <button type="button" class="botao pequeno" aria-describedby="docs-saida-r" onClick={async () => setSaida((await invocar<string | undefined>('sistema:escolherPasta', { titulo: 'Pasta da documentação' })) ?? saida)}>Escolher outra…</button>
            {saida && <button type="button" class="botao pequeno" onClick={() => setSaida(undefined)}>Usar a padrão</button>}
          </div>
        </div>
        <div class="campo">
          <label for="docs-comparar">Comparar com a versão anterior (opcional)</label>
          <input id="docs-comparar" type="text" value={comparar} placeholder="pasta, branch, tag ou commit" onInput={(e) => setComparar(e.currentTarget.value)} />
        </div>
        <div class="acoes">
          <button type="button" class="botao primario" data-testid="docs-gerar" disabled={ocupado.value} onClick={gerarDocs}>Gerar documentação</button>
          {docs && (
            <>
              <button type="button" class="botao" onClick={() => void invocar('docs:abrirNoNavegador', { alvo: 'docs' })}>Abrir no navegador</button>
              <button type="button" class="botao" onClick={() => void invocar('sistema:abrirPasta', { alvo: 'docs' })}>Abrir a pasta</button>
              <button type="button" class="botao" aria-pressed={verAqui} data-testid="docs-ver-aqui" onClick={() => setVerAqui(!verAqui)}>Ver aqui</button>
            </>
          )}
        </div>
        {docs && verAqui && (
          <div class="moldura inteira" style="height:640px">
            <iframe src={docs.url} title="Documentação gerada" style="width:100%;height:100%;transform:none" sandbox="allow-same-origin allow-scripts" data-testid="docs-iframe" />
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>PDF</legend>
        <div role="radiogroup" aria-label="Recorte" class="acoes">
          {(['tudo', 'modulos', 'telas'] as const).map((r) => (
            <label key={r}>
              <input type="radio" name="recorte" data-testid={`pdf-recorte-${r}`} checked={recorte === r} onChange={() => { setRecorte(r); setEscolhidos([]); }} /> {r === 'tudo' ? 'Tudo' : r === 'modulos' ? 'Módulos' : 'Funcionalidades'}
            </label>
          ))}
        </div>
        {recorte !== 'tudo' && (
          <div class="campo">
            <label for="pdf-escolhidos">{recorte === 'modulos' ? 'Módulos' : 'Funcionalidades'} (Ctrl+clique para vários)</label>
            <select id="pdf-escolhidos" multiple size={8} data-testid="pdf-escolhidos" onChange={(e) => setEscolhidos([...e.currentTarget.selectedOptions].map((o) => o.value))}>
              {opcoes.map(([v, r]) => <option key={v} value={v} selected={escolhidos.includes(v!)}>{r}</option>)}
            </select>
          </div>
        )}
        <div role="radiogroup" aria-label="Orientação" class="acoes">
          {(['retrato', 'paisagem'] as const).map((o) => (
            <label key={o}><input type="radio" name="orientacao" data-testid={`pdf-orientacao-${o}`} checked={orientacao === o} onChange={() => setOrientacao(o)} /> {o === 'retrato' ? 'Retrato' : 'Paisagem'}</label>
          ))}
        </div>
        <label><input type="checkbox" checked={soMudancas} disabled={!comparar} onChange={(e) => setSoMudancas(e.currentTarget.checked)} /> Só o que mudou (exige a versão anterior acima)</label>
        <div class="acoes">
          <button type="button" class="botao primario" data-testid="pdf-gerar" disabled={ocupado.value || (recorte !== 'tudo' && !escolhidos.length)} onClick={gerarPdf}>Gerar PDF…</button>
          {pdf && (
            <>
              <button type="button" class="botao" onClick={() => void invocar('sistema:abrirArquivo', { alvo: 'pdf' })}>Abrir o PDF</button>
              <button type="button" class="botao" onClick={() => void invocar('sistema:abrirPasta', { alvo: 'pdf' })}>Abrir a pasta</button>
            </>
          )}
        </div>
      </fieldset>
    </section>
  );
}
