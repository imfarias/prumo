import { useEffect, useState } from 'preact/hooks';
import type { ProjetoAberto, Recente } from '../../comum/tipos.js';
import { avisar, invocar, projeto, tela, textoDoErro } from '../estado.js';

type RecenteVisao = Recente & { existe: boolean };

export function Projetos() {
  const [recentes, setRecentes] = useState<RecenteVisao[]>([]);
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState({ nome: '', versao: '1.0', orgao: '', pasta: '' });
  const [soltando, setSoltando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const carregar = () => invocar<RecenteVisao[]>('projeto:recentes').then(setRecentes);
  useEffect(() => void carregar(), []);

  const aberto = (p: ProjetoAberto | undefined) => {
    if (!p) return;
    projeto.value = p;
    avisar('ok', `Projeto aberto: ${p.nome} ${p.versao} · ${p.telas} telas · ${p.erros} erros, ${p.avisos} avisos.`);
    void carregar();
  };
  const tentar = async (f: () => Promise<ProjetoAberto | undefined>) => {
    setOcupado(true);
    try {
      aberto(await f());
    } catch (e) {
      avisar('erro', textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section aria-labelledby="t-projetos">
      <h1 id="t-projetos">Projetos</h1>
      <p>Abra a pasta de especificações (a que contém as pastas dos módulos) ou uma pasta acima dela.</p>
      <div class="acoes">
        <button type="button" class="botao primario" data-testid="projetos-abrir" disabled={ocupado} onClick={() => tentar(() => invocar<ProjetoAberto | undefined>('projeto:abrirDialogo'))}>
          Abrir pasta…
        </button>
        <button type="button" class="botao" data-testid="projetos-criar" aria-expanded={criando} onClick={() => setCriando(!criando)}>
          Criar projeto novo
        </button>
        {projeto.value && (
          <button type="button" class="botao" onClick={() => (tela.value = 'verificacao')}>
            Ir para a verificação
          </button>
        )}
      </div>

      {criando && (
        <form
          class="aviso"
          aria-label="Criar projeto novo"
          data-testid="projetos-form-novo"
          onSubmit={(e) => {
            e.preventDefault();
            void tentar(() => invocar<ProjetoAberto>('projeto:criar', novo)).then(() => setCriando(false));
          }}
        >
          <div class="campo">
            <label for="novo-nome">Nome do projeto</label>
            <input id="novo-nome" type="text" required maxLength={80} value={novo.nome} onInput={(e) => setNovo({ ...novo, nome: e.currentTarget.value })} data-testid="projetos-novo-nome" />
          </div>
          <div class="linha-campos">
            <div class="campo">
              <label for="novo-versao">Versão</label>
              <input id="novo-versao" type="text" required value={novo.versao} onInput={(e) => setNovo({ ...novo, versao: e.currentTarget.value })} />
            </div>
            <div class="campo">
              <label for="novo-orgao">Órgão ou cliente (opcional)</label>
              <input id="novo-orgao" type="text" value={novo.orgao} onInput={(e) => setNovo({ ...novo, orgao: e.currentTarget.value })} />
            </div>
          </div>
          <div class="campo">
            <span class="rotulo" id="novo-pasta-r">Pasta onde criar</span>
            <div class="acoes">
              <button
                type="button"
                class="botao pequeno"
                aria-describedby="novo-pasta-r"
                data-testid="projetos-novo-pasta"
                onClick={async () => {
                  const pasta = await invocar<string | undefined>('sistema:escolherPasta', { titulo: 'Pasta onde criar o projeto' });
                  if (pasta) setNovo({ ...novo, pasta });
                }}
              >
                Escolher pasta…
              </button>
              <code>{novo.pasta || 'nenhuma escolhida'}</code>
            </div>
            <span class="ajuda">O Prumo cria "Especificações" com o projeto.yml, um módulo de exemplo, regras e mensagens.</span>
          </div>
          <div class="acoes">
            <button type="submit" class="botao primario" disabled={!novo.nome.trim() || !novo.pasta || ocupado} data-testid="projetos-novo-criar">
              Criar e abrir
            </button>
          </div>
        </form>
      )}

      <h2 id="t-recentes">Recentes</h2>
      {recentes.length ? (
        <ul class="lista" aria-labelledby="t-recentes" data-testid="projetos-recentes">
          {recentes.map((r, i) => (
            <li key={r.caminho}>
              <button
                type="button"
                class="item"
                data-testid={`projetos-recente-${i}`}
                disabled={!r.existe || ocupado}
                onClick={() => tentar(() => invocar<ProjetoAberto>('projeto:abrir', { caminho: r.caminho }))}
                onKeyDown={async (e) => {
                  if (e.key === 'Delete') {
                    e.preventDefault();
                    setRecentes((await invocar<RecenteVisao[]>('projeto:esquecer', { caminho: r.caminho })).map((x) => ({ ...x, existe: true })));
                    avisar('ok', `${r.nome} saiu da lista de recentes (nenhum arquivo foi apagado).`);
                  }
                }}
                aria-describedby={`recente-${i}-c`}
              >
                <b>{r.nome} {r.versao}</b>
                <span class="sec" id={`recente-${i}-c`}>
                  {r.caminho} {r.existe ? `· aberto em ${new Date(r.abertoEm).toLocaleString('pt-BR')}` : '· pasta não encontrada'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum projeto aberto ainda.</p>
      )}
      <p class="sec">Dica: selecione um recente e pressione Delete para tirá-lo da lista.</p>

      <div
        class={`soltar${soltando ? ' ativo' : ''}`}
        data-testid="projetos-soltar"
        onDragOver={(e) => {
          e.preventDefault();
          setSoltando(true);
        }}
        onDragLeave={() => setSoltando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSoltando(false);
          const f = e.dataTransfer?.files[0];
          if (f) void tentar(() => invocar<ProjetoAberto>('projeto:abrir', { caminho: window.prumo.caminhoDoArquivo(f) }));
        }}
      >
        Ou solte uma pasta aqui
      </div>
    </section>
  );
}
