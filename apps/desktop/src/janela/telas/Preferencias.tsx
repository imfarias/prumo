import { useEffect, useState } from 'preact/hooks';
import type { InfoAtualizacao, Preferencias as Prefs, Sobre } from '../../comum/tipos.js';
import { atualizacao, avisar, invocar, textoDoErro } from '../estado.js';

export function Preferencias() {
  const [p, setP] = useState<Prefs>();
  const [sobre, setSobre] = useState<Sobre>();
  const [exe, setExe] = useState('');
  const [verificando, setVerificando] = useState(false);
  useEffect(() => {
    void invocar<Prefs>('prefs:ler').then((x) => {
      setP(x);
      if (typeof x.editor === 'object') setExe(x.editor.executavel);
    });
    void invocar<Sobre>('sobre:ler').then(setSobre);
  }, []);
  if (!p) return <p>Lendo as preferências…</p>;

  const salvar = async (mudanca: Record<string, unknown>) => {
    try {
      const novo = await invocar<Prefs>('prefs:salvar', mudanca);
      setP(novo);
      if (mudanca.tema) {
        const escuro = novo.tema === 'escuro' || (novo.tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
      }
      avisar('ok', 'Preferências salvas.');
    } catch (e) {
      avisar('erro', textoDoErro(e));
    }
  };
  const editor = typeof p.editor === 'object' ? 'outro' : p.editor;

  return (
    <section aria-labelledby="t-prefs">
      <h1 id="t-prefs">Preferências e Sobre</h1>
      <fieldset>
        <legend>Editor para abrir os achados</legend>
        <div role="radiogroup" aria-label="Editor" class="acoes">
          <label><input type="radio" name="editor" checked={editor === 'vscode'} onChange={() => salvar({ editor: 'vscode' })} /> VS Code</label>
          <label><input type="radio" name="editor" checked={editor === 'sistema'} onChange={() => salvar({ editor: 'sistema' })} /> Aplicativo padrão do sistema</label>
          <label><input type="radio" name="editor" checked={editor === 'outro'} onChange={() => exe && salvar({ editor: { executavel: exe, argumentos: ['{arquivo}'] } })} /> Outro</label>
        </div>
        <div class="campo">
          <label for="pref-exe">Executável (opção "Outro")</label>
          <input id="pref-exe" type="text" value={exe} aria-describedby="pref-exe-ajuda" onInput={(e) => setExe(e.currentTarget.value)} />
          <span class="ajuda" id="pref-exe-ajuda">O arquivo é passado como argumento. Use a opção "Outro" depois de preencher.</span>
        </div>
      </fieldset>
      <fieldset>
        <legend>Aparência</legend>
        <div role="radiogroup" aria-label="Tema" class="acoes">
          {(['sistema', 'claro', 'escuro'] as const).map((t) => (
            <label key={t}><input type="radio" name="tema" checked={p.tema === t} onChange={() => salvar({ tema: t })} /> {t === 'sistema' ? 'Seguir o sistema' : t === 'claro' ? 'Claro' : 'Escuro'}</label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Atualizações</legend>
        <label>
          <input type="checkbox" data-testid="prefs-atualizacao" checked={p.atualizacao.ligada} onChange={(e) => salvar({ atualizacaoLigada: e.currentTarget.checked })} /> Verificar se há versão nova (releases do GitHub, no máximo uma vez por dia; nada é baixado sem o seu clique)
        </label>
        <div class="acoes">
          <button
            type="button"
            class="botao"
            data-testid="prefs-verificar-atualizacao"
            disabled={verificando}
            onClick={async () => {
              setVerificando(true);
              try {
                const info = await invocar<InfoAtualizacao | null>('atualizacao:verificar');
                if (info) atualizacao.value = info;
                else avisar('ok', 'Você já está na versão mais recente.');
              } catch (e) {
                avisar('erro', `Não foi possível verificar atualizações: ${textoDoErro(e)}`);
              } finally {
                setVerificando(false);
              }
            }}
          >
            Verificar agora
          </button>
          {p.atualizacao.ultimaVerificacao && <span class="sec">Última verificação: {new Date(p.atualizacao.ultimaVerificacao).toLocaleString('pt-BR')}</span>}
        </div>
      </fieldset>
      {window.prumo.plataforma === 'win32' && (
        <fieldset>
          <legend>Integração com o Windows</legend>
          <label>
            <input type="checkbox" data-testid="prefs-menu-contexto" checked={!!p.menuContexto} onChange={(e) => salvar({ menuContexto: e.currentTarget.checked })} /> "Abrir com o Prumo" no botão direito de pastas
          </label>
          <p class="sec">Quem instalou pelo .exe já tem esta opção; ligue aqui se instalou pelo .msi.</p>
        </fieldset>
      )}
      {sobre && (
        <section aria-labelledby="t-sobre">
          <h2 id="t-sobre">Sobre</h2>
          <dl data-testid="prefs-sobre">
            <dt>Prumo</dt><dd>{sobre.versao} (motor {sobre.motor})</dd>
            <dt>Electron</dt><dd>{sobre.electron} · Chromium {sobre.chromium} · Node {sobre.node}</dd>
            <dt>Registro</dt><dd><code>{sobre.registro}</code> <button type="button" class="botao pequeno" onClick={() => void invocar('sistema:abrirPasta', { alvo: 'registro' })}>Abrir a pasta</button></dd>
          </dl>
          <p class="sec">Software livre (MIT). Licenças de terceiros acompanham o instalador (LICENSES.chromium.html e as licenças das bibliotecas).</p>
          <button type="button" class="botao pequeno" onClick={() => void invocar('sistema:abrirLink', { url: 'https://github.com/imfarias/prumo' })}>Página do projeto</button>
        </section>
      )}
    </section>
  );
}
