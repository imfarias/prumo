import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { EstadoTarefa, InfoAtualizacao, Preferencias, ProjetoAberto } from '../comum/tipos.js';
import { atualizacao, avisar, invocar, mensagem, mudancasPendentes, projeto, tarefa, tela, textoDoErro, versaoPrevia, type Tela } from './estado.js';
import { Comparar } from './telas/Comparar.js';
import { Configuracao } from './telas/Configuracao.js';
import { Documentacao } from './telas/Documentacao.js';
import { Preferencias as TelaPreferencias } from './telas/Preferencias.js';
import { Projetos } from './telas/Projetos.js';
import { Prototipos } from './telas/Prototipos.js';
import { Verificacao } from './telas/Verificacao.js';

const TELAS: { id: Tela; rotulo: string; precisaProjeto: boolean }[] = [
  { id: 'projetos', rotulo: 'Projetos', precisaProjeto: false },
  { id: 'configuracao', rotulo: 'Configuração', precisaProjeto: true },
  { id: 'verificacao', rotulo: 'Verificação', precisaProjeto: true },
  { id: 'prototipos', rotulo: 'Protótipos', precisaProjeto: true },
  { id: 'documentacao', rotulo: 'Documentação e PDF', precisaProjeto: true },
  { id: 'comparar', rotulo: 'Comparar versões', precisaProjeto: true },
  { id: 'preferencias', rotulo: 'Preferências e Sobre', precisaProjeto: false },
];

function irPara(t: Tela) {
  if (t === tela.value) return;
  if (mudancasPendentes.value && !window.confirm('Há mudanças não salvas na configuração. Sair sem salvar?')) return;
  mudancasPendentes.value = false;
  tela.value = t;
  mensagem.value = undefined;
}

function Andamento({ t }: { t: EstadoTarefa }) {
  const pct = t.total ? Math.round((t.feito / t.total) * 100) : undefined;
  const rodando = t.estado === 'rodando';
  return (
    <div class="andamento" data-testid="tarefa-andamento">
      <progress max={100} value={pct ?? undefined} aria-label="Andamento da tarefa" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} />
      <small aria-live="polite">{rodando ? t.etapa : t.estado === 'concluida' ? 'Concluído' : t.estado === 'cancelada' ? 'Cancelado' : 'Erro'}</small>
      {rodando && t.tipo !== ('atualizacao' as never) && (
        <button type="button" class="botao pequeno perigo" data-testid="tarefa-cancelar" onClick={() => void invocar('tarefa:cancelar', { id: t.id })}>
          Cancelar
        </button>
      )}
    </div>
  );
}

function Previa() {
  const ligada = useRef<boolean>(true);
  useEffect(() => {
    void invocar<Preferencias>('prefs:ler').then((p) => {
      ligada.current = p.previaAoVivo;
      versaoPrevia.value++;
    });
  }, []);
  const on = ligada.current;
  void versaoPrevia.value;
  return (
    <button
      type="button"
      class="interruptor"
      role="switch"
      aria-checked={on ? 'true' : 'false'}
      data-testid="app-previa"
      onClick={async () => {
        ligada.current = !on;
        versaoPrevia.value++;
        await invocar('prefs:salvar', { previaAoVivo: !on });
      }}
    >
      <span class="trilho" aria-hidden="true" />
      Prévia ao vivo
    </button>
  );
}

function AvisoAtualizacao({ info }: { info: InfoAtualizacao }) {
  return (
    <div class="aviso" role="status" data-testid="atualizacao-aviso">
      <b>Versão {info.versao} do Prumo disponível.</b>{' '}
      <button type="button" class="botao pequeno" onClick={() => void invocar('sistema:abrirLink', { url: info.url })}>
        Ver novidades
      </button>{' '}
      {info.arquivo ? (
        <button
          type="button"
          class="botao pequeno primario"
          data-testid="atualizacao-baixar"
          onClick={async () => {
            try {
              await invocar('atualizacao:baixar');
              if (window.confirm('Atualização baixada e conferida. Instalar agora? O Prumo será fechado.')) await invocar('atualizacao:instalar');
            } catch (e) {
              avisar('erro', textoDoErro(e));
            }
          }}
        >
          Baixar ({Math.round(info.arquivo.tamanho / 1048576)} MB)
        </button>
      ) : (
        <span> Baixe pela página da versão.</span>
      )}{' '}
      <button
        type="button"
        class="botao pequeno"
        data-testid="atualizacao-depois"
        onClick={async () => {
          await invocar('atualizacao:lembrarDepois');
          atualizacao.value = undefined;
        }}
      >
        Lembrar depois
      </button>
    </div>
  );
}

function App() {
  const conteudo = useRef<HTMLElement>(null);
  useEffect(() => {
    const parar = [
      window.prumo.ouvir('tarefa:andamento', (d) => (tarefa.value = d as EstadoTarefa)),
      window.prumo.ouvir('projeto:aberto', (d) => (projeto.value = d as ProjetoAberto)),
      window.prumo.ouvir('previa:atualizada', (d) => {
        projeto.value = d as ProjetoAberto;
        versaoPrevia.value++;
      }),
      window.prumo.ouvir('atualizacao:disponivel', (d) => (atualizacao.value = d as InfoAtualizacao)),
      window.prumo.ouvir('projeto:mudouNoDisco', () => {
        if (mudancasPendentes.value) avisar('atencao', 'O projeto.yml mudou no disco. Recarregue a configuração ou mantenha as suas mudanças.');
      }),
      window.prumo.ouvir('projeto:abrirPedido', async (d) => {
        try {
          projeto.value = await invocar<ProjetoAberto>('projeto:abrir', d);
          tela.value = 'verificacao';
        } catch (e) {
          avisar('erro', textoDoErro(e));
        }
      }),
    ];
    void invocar<Preferencias>('prefs:ler').then((p) => {
      const escuro = p.tema === 'escuro' || (p.tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
    });
    void invocar<ProjetoAberto | undefined>('projeto:atual').then((p) => p && (projeto.value = p));
    const teclas = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        irPara('projetos');
        document.querySelector<HTMLButtonElement>('[data-testid="projetos-abrir"]')?.click();
      } else if (e.key === 'F5' && projeto.value) {
        e.preventDefault();
        irPara('verificacao');
        document.querySelector<HTMLButtonElement>('[data-testid="verificacao-verificar"]')?.click();
      }
    };
    window.addEventListener('keydown', teclas);
    return () => {
      parar.forEach((f) => f());
      window.removeEventListener('keydown', teclas);
    };
  }, []);
  useEffect(() => {
    document.title = `Prumo${projeto.value ? ` · ${projeto.value.nome} ${projeto.value.versao}` : ''}`;
  }, [projeto.value]);
  useEffect(() => {
    conteudo.current?.focus();
  }, [tela.value]);

  const p = projeto.value;
  const atual = TELAS.find((t) => t.id === tela.value)!;
  return (
    <div class="app">
      <nav class="menu" aria-label="Telas" data-testid="app-menu">
        <div class="marca">Prumo</div>
        <ul>
          {TELAS.map((t) => (
            <li key={t.id}>
              <button type="button" data-testid={`app-menu-${t.id}`} aria-current={tela.value === t.id ? 'page' : undefined} disabled={t.precisaProjeto && !p} onClick={() => irPara(t.id)}>
                {t.rotulo}
              </button>
            </li>
          ))}
        </ul>
        <div class="rodape-menu">Atalhos: Ctrl+O abrir · F5 verificar</div>
      </nav>
      <header class="topo">
        <div class="projeto" data-testid="app-projeto">
          {p ? (
            <>
              <b>{p.nome} {p.versao}</b>
              <small>{p.telas} telas · {p.erros} erros · {p.avisos} avisos · {p.specs}</small>
            </>
          ) : (
            <small>Nenhum projeto aberto</small>
          )}
        </div>
        {tarefa.value && <Andamento t={tarefa.value} />}
        <Previa />
      </header>
      <main class="conteudo" ref={conteudo} tabIndex={-1} aria-label={atual.rotulo} data-testid="app-conteudo">
        {atualizacao.value && <AvisoAtualizacao info={atualizacao.value} />}
        {mensagem.value && (
          <div class={`aviso ${mensagem.value.tipo}`} role={mensagem.value.tipo === 'erro' ? 'alert' : 'status'} data-testid="app-mensagem">
            {mensagem.value.texto}
          </div>
        )}
        {tela.value === 'projetos' && <Projetos />}
        {tela.value === 'configuracao' && p && <Configuracao />}
        {tela.value === 'verificacao' && p && <Verificacao />}
        {tela.value === 'prototipos' && p && <Prototipos />}
        {tela.value === 'documentacao' && p && <Documentacao />}
        {tela.value === 'comparar' && p && <Comparar />}
        {tela.value === 'preferencias' && <TelaPreferencias />}
      </main>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
