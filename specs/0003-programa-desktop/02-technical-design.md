# 0003 — Desenho Técnico

**Autor:** arc-lider (Momento A) · **Data:** 2026-11-04 · **Spec:** [01-specification.md](01-specification.md)

## 1. Resumo da Abordagem

`apps/desktop` é um app Electron 45 com três partes. Cada uma é empacotada por esbuild num arquivo só.

| Parte | Formato | O que faz |
|---|---|---|
| **Processo principal** (`main.mjs`, ESM) | Inclui o `@prumo/motor` no pacote | Roda todas as regras pelo motor, a fila de tarefas com andamento e cancelamento, a porta `NavegadorElectron`, as preferências, a atualização, o registro e o protocolo `prumo-arquivo:` |
| **`preload.cjs`** | Isolado (`contextIsolation`, `sandbox`) | Expõe à janela uma API mínima, `window.prumo`, com uma lista fechada de canais |
| **Janela** (`janela.js`) | Preact + TSX, sem acesso a Node | Só mostra e envia comandos |

O motor ganha três coisas pequenas e reaproveitáveis pela CLI:
1. **Andamento e cancelamento** (`aoAndamento`, `sinal: AbortSignal`) nas funções longas.
2. **Raiz de recursos configurável** (`PRUMO_RECURSOS`): kits, fontes e axe. Assim o motor funciona empacotado,
   sem `node_modules`.
3. **Edição de YAML preservando comentários** (`editarYaml`) e **criação de projeto novo** (`criarProjetoNovo`).

O `playwright-core` passa a ser importado sob demanda. O programa não o inclui: usa o Chromium do
próprio Electron pela porta `Navegador` (RN-71).

Os instaladores são gerados pelo electron-builder no CI, a partir das releases:

| Formato | Escopo | "Abrir com o Prumo" |
|---|---|---|
| NSIS `.exe` | Por usuário | Sim, criado e removido pelo próprio instalador |
| `.msi` | Por máquina | Ligado pelo programa (Preferências) |
| `.deb` e `.AppImage` | — | Pelo `.desktop` |

A atualização consulta a API de releases do GitHub uma vez por dia (RN-73).

### Validado antes do desenho, nesta máquina (Electron 45.2.2, Windows)

| Ponto | Resultado |
|---|---|
| Motor (`dist/index.js`, ESM) importado no processo principal | `preparar()` do exemplo em 0,8 s |
| Janela oculta comum | `document.fonts.ready` e a captura **travam**, mesmo com `backgroundThrottling: false`: o Chromium não gera quadros para janela escondida |
| **Renderização fora da tela** (`offscreen: true`) com `setContentSize(1440, alturaDoConteúdo)` + `capturePage()` | Funciona. PNG de 1440 × 902 com **0,00008%** de diferença do PNG do Playwright; página de 28.170 px capturada inteira |
| `printToPDF` | Funciona com `displayHeaderFooter`, `footerTemplate` (pageNumber/totalPages) e margens |
| `session.webRequest.onBeforeRequest` | Bloqueia tudo que não é `file:`/`data:`/`blob:`; nenhuma requisição externa nas páginas do Prumo |

## 2. Alternativas Consideradas

| Tema | Escolhida | Alternativa | Por que não |
|---|---|---|---|
| Onde roda o motor | Processo principal, com fila e `AbortSignal` | `utilityProcess` por tarefa | O processo utilitário não tem `BrowserWindow`: captura e PDF teriam de voltar ao principal por IPC. O trabalho de CPU do motor é curto (< 3 s no piloto), e a janela continua responsiva por ser outro processo |
| Captura | Janela fora da tela + `capturePage` | CDP `Page.captureScreenshot` numa janela oculta; mostrar a janela fora da área visível | A primeira trava (sem quadros); a segunda pisca e depende do monitor |
| Interface | Preact 11 + TSX (esbuild) | HTML e TS puros; React; Svelte | Oito telas com formulários e listas pedem componentes; Preact tem 4 KB, licença MIT e não precisa de compilador próprio |
| Motor no pacote | Incluído pelo esbuild no `main.mjs`, recursos em `resources/` | Copiar `node_modules` do workspace | O electron-builder lida mal com links de workspace; o pacote deixa o instalador menor e previsível |
| Mostrar protótipos e documentação | Protocolo próprio `prumo-arquivo:`, só para as pastas do projeto | `file://` direto na janela | `file://` abriria o disco todo para a janela; o protocolo limita às pastas abertas |
| Atualização | Cliente próprio: API do GitHub + `SHA256SUMS.txt` + abrir o instalador | `electron-updater` | Não cobre `.msi`; instala sozinho por padrão e exige `latest.yml`; o cliente próprio tem ~150 linhas e é fácil de testar com um servidor local |
| "Abrir com o Prumo" | Script NSIS (`HKCU`) no `.exe`; opção em Preferências (`reg.exe`) para o `.msi`; `.desktop` no Linux | Chave em `HKLM` no `.msi` com WiX customizado | A personalização de WiX do electron-builder é limitada; a opção no programa atende quem instalou pelo `.msi` |

## 3. Reutilização

| Da 0001/0002 | Uso no programa |
|---|---|
| `preparar`, `verificarPreparado`, `gerar`, `gerarECapturar`, `compararComAtuais`, `migrarConfig` | Telas de Projetos, Verificação e Protótipos |
| `gerarDocumentacao`, `gerarPdf`, `prepararVersaoAnterior`, `compararVersoes` | Telas de Documentação/PDF e Comparar |
| `servir` (vigia + regeneração) | Base da prévia ao vivo: o mesmo vigia `chokidar` e a mesma fila sem regeneração duplicada, mas sem HTTP (a janela recebe um evento) |
| Porta `Navegador` | Novo adaptador `NavegadorElectron` |
| `formatarJson` | Exportar JSON da verificação |
| Kit `docs` (a documentação) | "Ver aqui": a documentação gerada aberta na janela pelo protocolo |

## 4. Modelo de Dados

```ts
// apps/desktop/src/comum/tipos.ts (compartilhado entre principal e janela)
interface Preferencias {
  recentes: { caminho: string; nome: string; versao: string; abertoEm: string }[];
  editor: 'vscode' | 'sistema' | { executavel: string; argumentos: string[] }; // {arquivo} {linha}
  previaAoVivo: boolean;
  tema: 'sistema' | 'claro' | 'escuro';
  atualizacao: { ligada: boolean; url?: string; ultimaVerificacao?: string; lembrarDepoisAte?: string };
  menuContexto?: boolean; // Windows .msi: "Abrir com o Prumo" pelo programa
}
interface ProjetoAberto { specs: string; nome: string; versao: string; telas: number; erros: number; avisos: number; fonte: 'projeto.yml' | 'config.properties' | 'padrao'; git: boolean }
interface Tarefa { id: string; tipo: TipoTarefa; etapa: string; feito: number; total: number; estado: 'rodando' | 'concluida' | 'cancelada' | 'erro'; resultado?: unknown; erro?: { codigo?: string; mensagem: string } }
type TipoTarefa = 'verificar' | 'gerar' | 'capturar' | 'comparar-png' | 'docs' | 'pdf' | 'comparar';
interface Andamento { etapa: string; feito: number; total: number } // emitido pelo motor
```

O motor ganha `OpcoesExecucao { sinal?: AbortSignal; aoAndamento?: (a: Andamento) => void }`. Ele verifica
`sinal.aborted` entre telas e páginas e lança `ErroPrumo('CANCELADO')`.

**Gravação atômica.** `gravarSeMudou` passa a gravar num `.tmp` e renomear. Com isso, cancelar no meio não
deixa arquivo pela metade (FA-06).

## 5. Contratos (IPC)

`window.prumo` (preload):

```ts
invocar(canal: Canal, dados?: unknown): Promise<unknown>
ouvir(evento: Evento, fn: (dados: unknown) => void): () => void
type Canal =
  | 'projeto:abrirDialogo' | 'projeto:abrir' | 'projeto:criar' | 'projeto:recentes' | 'projeto:esquecer'
  | 'config:ler' | 'config:salvar' | 'config:criarProjetoYml'
  | 'tarefa:iniciar' | 'tarefa:cancelar'
  | 'verificacao:abrirNoEditor' | 'verificacao:exportar'
  | 'prototipos:listar' | 'prototipos:override:ler' | 'prototipos:override:salvar'
  | 'docs:abrirNoNavegador' | 'sistema:abrirPasta' | 'sistema:abrirArquivo' | 'sistema:salvarComo' | 'sistema:escolherPasta' | 'sistema:escolherArquivo'
  | 'comparar:refs'
  | 'prefs:ler' | 'prefs:salvar'
  | 'atualizacao:verificar' | 'atualizacao:baixar' | 'atualizacao:instalar'
  | 'sobre:ler'
type Evento = 'tarefa:andamento' | 'tarefa:fim' | 'previa:atualizada' | 'projeto:mudouNoDisco' | 'atualizacao:disponivel' | 'projeto:abrirPedido'
```

Regras do canal:
- todo `invocar` passa por um validador do lado do principal (tipo e forma dos dados), antes de chegar ao serviço;
- canal fora da lista → erro;
- caminhos recebidos da janela só são aceitos se estiverem dentro do projeto aberto ou tiverem sido escolhidos por
  um diálogo nativo nesta sessão. Os diálogos registram uma "lista de liberados".

Protocolo `prumo-arquivo://{raiz}/{caminho}`. `{raiz}` é um apelido registrado pelo principal: `saida-docs`,
`saida-prototipos`, `specs`. Ele serve só arquivos dentro da raiz (`dentroDe`), com a CSP de cada tipo, e
devolve 404 para o resto.

## 6. Arquitetura da Solução

```
apps/desktop/
  package.json                    # "main": "dist/main.mjs"; dependências: electron (dev), preact
  electron-builder.yml            # alvos, ícones, extraResources (kits, fontes, axe), NSIS include
  build/
    icone.png icone.ico           # 512 px e multi-tamanho
    instalador.nsh                # customInstall/customUnInstall: "Abrir com o Prumo" em HKCU
    prumo.desktop.tpl             # MimeType=inode/directory (Linux)
  scripts/
    empacotar.mjs                 # esbuild de main, preload e janela + cópia de recursos para dist/recursos
  src/
    comum/tipos.ts  canais.ts     # tipos e validadores de canal (compartilhados)
    principal/
      main.ts                     # ciclo de vida, instância única, janela, menu, CSP, bloqueios de navegação
      seguranca.ts                # webPreferences, will-navigate, setWindowOpenHandler, permissões negadas
      ipc.ts                      # registro dos canais com validação
      protocolo.ts                # prumo-arquivo:
      projeto.ts                  # abrir, criar, recentes, mudou no disco
      tarefas.ts                  # fila (1 por vez), AbortController, andamento → janela
      previa.ts                   # chokidar sobre o projeto; agenda verificar + regenerar o que está aberto
      navegador-electron.ts       # porta Navegador: janela fora da tela, capturar, pdf, axe, rede bloqueada
      editor.ts                   # code --goto / aplicativo padrão
      preferencias.ts             # userData/preferencias.json (gravação atômica)
      atualizacao.ts              # API do GitHub, SemVer, download, SHA-256, instalar
      menu-contexto.ts            # Windows (.msi): reg add/delete HKCU
      registro.ts                 # log com rotação
    preload/preload.ts
    janela/
      index.html  estilo.css
      app.tsx  rotas.ts  estado.ts      # estado global com @preact/signals
      telas/ Projetos.tsx Configuracao.tsx Verificacao.tsx Prototipos.tsx Documentacao.tsx Comparar.tsx Sobre.tsx Preferencias.tsx
      componentes/ Andamento.tsx Campo.tsx SeletorCor.tsx Contraste.tsx Lista.tsx Dialogo.tsx Aviso.tsx DiffYaml.tsx Moldura.tsx
packages/motor/src/
  util/execucao.ts                # OpcoesExecucao, verificarCancelamento()
  util/recursos.ts                # raiz de recursos (PRUMO_RECURSOS) para kits, fontes e axe
  config/editar.ts                # editarYaml(arquivo, mudanças) preservando comentários; diff para mostrar
  config/novo.ts                  # criarProjetoNovo(pasta, {nome, versao, orgao})
```

Alterações no motor:
- `render/gerar.ts`, `docs/gerar.ts`, `docs/pdf.ts`, `navegador/capturar.ts`, `executar.ts` aceitam `OpcoesExecucao`;
- `KITS`, `caminhoFonte` e o caminho do axe passam por `util/recursos.ts`;
- `navegador/playwright.ts` importa `playwright-core` com `await import()`;
- `render/recursos.ts`: `gravarSeMudou` atômico.

**Fila de tarefas.**
- Uma tarefa por vez: as mudanças de arquivo durante uma tarefa entram na fila da prévia.
- Cada tarefa tem um `AbortController`; cancelar aborta o sinal e o motor para na próxima verificação.
- Andamento enviado à janela a cada etapa, no máximo 10 por segundo.
- Erro do motor: `ErroPrumo` chega à janela com o código e a mensagem; os demais, com a mensagem curta e o
  registro completo no log.

**Prévia ao vivo.**
- O mesmo padrão do `servir`: chokidar sobre o projeto, debounce de 300 ms, uma regeneração por vez.
- Regenera só o que está aberto na janela: a verificação, o protótipo aberto (`gerar` com recorte de uma tela) e a
  documentação, se "Ver aqui" estiver aberto.
- Avisa a janela pelo evento `previa:atualizada`, e a janela recarrega o iframe.

**Edição de YAML (RN-74).**
- `editarYaml` abre o documento com `parseDocument` (mantendo comentários e estilo) e aplica `setIn`/`deleteIn`
  por caminho. Mapas na mesma linha (`{ a: 1 }`) continuam na mesma linha quando possível.
- Devolve o texto novo e o diff por linha. A janela mostra o diff, e o `config:salvar` grava de forma atômica.
- O arquivo é lido de novo na hora de salvar. Se mudou desde a abertura, vale o FA-13.

## 7. Integrações Externas

| Fronteira | Adaptador | Teste |
|---|---|---|
| Chromium do Electron | `NavegadorElectron` | Teste no próprio Electron (E2E) + comparação de PNG com a referência do exemplo |
| GitHub (releases) | `atualizacao.ts` com `net.fetch`, `User-Agent: Prumo/{versao}`, sem token | Servidor HTTP local nos testes (`PRUMO_ATUALIZACAO_URL`), com release falsa e SHA certo/errado |
| VS Code / aplicativo padrão | `editor.ts` (`spawn` sem shell; no Windows `code.cmd`) | `PRUMO_EDITOR` apontando para um script que grava os argumentos |
| Git | O da 0002 (`execFile`) | O da 0002 |
| Registro do Windows | `reg.exe` com `execFile` | Teste só no Windows, com chave de teste em `HKCU\Software\Classes\Directory\shell\PrumoTeste` |

## 8. Eventos / Jobs

Fila de tarefas e prévia ao vivo (seção 6). A verificação de atualização roda na abertura, no máximo uma vez por
dia, sem bloquear a janela.

## 9. Cache e Performance

- **Abrir projeto:** só `preparar` + `verificarPreparado` (piloto ~1 s).
- **Miniaturas:** usam o PNG existente. Sem PNG, a captura acontece numa tarefa em segundo plano, guardada em
  `userData/miniaturas/{hash do projeto}/`.
- **`NavegadorElectron`:**
  - duas janelas fora da tela reaproveitadas, capturando em paralelo;
  - sessão própria (`partition: 'prumo-render'`), sem cache em disco.
- **Pacote:** esbuild com `minify` na janela; motor sem `minify` (para o registro de erros legível).

## 10. Segurança e LGPD

- **Janela do programa:**
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`;
  - CSP `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: prumo-arquivo:; frame-src prumo-arquivo:; connect-src 'self'`;
  - `will-navigate` e `setWindowOpenHandler` negam tudo; links `https:` vão para `shell.openExternal`, só com confirmação;
  - todas as permissões negadas (`setPermissionRequestHandler`).
- **Janelas de captura:**
  - sessão separada, sem preload;
  - `javascript` ligado (os protótipos e a documentação precisam);
  - rede bloqueada, exceto `file:`, `data:` e `blob:`.
- **IPC:** lista fechada, validação de forma e "lista de liberados" para caminhos (seção 5).
- **Atualização:** só `https:` (ou `http://127.0.0.1` nos testes); SHA-256 conferido antes de abrir o instalador; nada roda sozinho.
- **Registro:** sem conteúdo das especificações.
- **Integridade:** `asar` com `asarUnpack` só onde for preciso, e os *fuses* do Electron ligados:
  - `RunAsNode=false`, `EnableNodeOptionsEnvironmentVariable=false`, `EnableNodeCliInspectArguments=false`;
  - `EnableEmbeddedAsarIntegrityValidation=true`, `OnlyLoadAppFromAsar=true`.

## 11. Frontend (janela do programa)

Layout:
- menu lateral fixo (Projetos, Configuração, Verificação, Protótipos, Documentação e PDF, Comparar versões);
- topo com o projeto aberto, o interruptor "Prévia ao vivo" e o indicador de tarefa;
- conteúdo principal;
- tema claro e escuro por `prefers-color-scheme`, com sobreposição nas Preferências.

| Elemento | `data-testid` | ARIA / teclado |
|---|---|---|
| Menu lateral | `app-menu`, `app-menu-{tela}` | `nav aria-label="Telas"`, `aria-current="page"` |
| Abrir pasta / Criar projeto | `projetos-abrir`, `projetos-criar` | botões |
| Recentes | `projetos-recentes`, `projetos-recente-{i}` | `role="list"`; Enter abre; Delete esquece (com confirmação anunciada) |
| Campo da configuração | `config-{chave}` (ex.: `config-projeto-versao`) | `label[for]`, `aria-invalid`, `aria-describedby` |
| Seletor de cor | `config-cor-{nome}` + `config-cor-{nome}-hex` | `input type=color` + campo hex com rótulo; prévia de contraste em `aria-live` |
| Salvar / Descartar | `config-salvar`, `config-descartar` | Salvar desabilitado sem mudanças (`aria-disabled`) |
| Achado da verificação | `verificacao-achado-{i}` | linha de lista como botão; Enter abre no editor |
| Agrupar / filtros | `verificacao-agrupar`, `verificacao-filtro-{sev}` | grupo de rádio |
| Grade de telas | `prototipos-tela-{id}` | lista de botões com imagem (`alt` = título) |
| Sinais da inferência | `prototipos-sinais` | tabela com `th scope` |
| Editar override | `prototipos-override-*`, `prototipos-override-diff`, `prototipos-override-salvar` | formulário; diff em `pre` com rótulo |
| Gerar PNG | `prototipos-gerar-{tela\|modulo\|tudo}` | botões |
| Andamento | `tarefa-andamento`, `tarefa-cancelar` | `role="progressbar"` com `aria-valuenow`; etapa em `aria-live="polite"` |
| Documentação/PDF | `docs-gerar`, `docs-modo-{pasta\|unico}`, `pdf-gerar`, `pdf-recorte-*`, `pdf-orientacao-*` | |
| Comparar | `comparar-tipo-{pasta\|ref}`, `comparar-ref`, `comparar-executar`, `comparar-item-{endereco}` | |
| Aviso de atualização | `atualizacao-aviso`, `atualizacao-baixar`, `atualizacao-depois` | `role="status"` |
| Prévia ao vivo | `app-previa` | `role="switch"`, `aria-checked` |

Foco visível de 3 px; ordem de Tab = ordem visual; atalhos:
- `Ctrl+O`: abrir pasta;
- `Ctrl+S`: salvar a configuração;
- `F5`: verificar de novo;
- `Esc`: cancelar a tarefa (com confirmação).

## 12. Estratégia de Testes desta Feature

- **Motor (vitest, como até aqui):**
  - `editarYaml` (comentários, ordem, mapas na mesma linha, chave nova, remoção);
  - `criarProjetoNovo` (estrutura válida que passa na verificação);
  - cancelamento (`sinal` abortado no meio de `gerar` e de `gerarDocumentacao` → `CANCELADO`, sem arquivo pela metade);
  - andamento (etapas em ordem);
  - recursos por `PRUMO_RECURSOS`;
  - gravação atômica.
- **Principal (vitest em Node, sem Electron):**
  - validadores de canal;
  - preferências (arquivo corrompido → padrões);
  - atualização (SemVer, escolha do arquivo por formato, SHA-256 certo/errado, sem rede) contra servidor HTTP local;
  - montagem dos argumentos do editor;
  - fila de tarefas (uma por vez, cancelar).
- **`NavegadorElectron` (dentro do Electron, script de teste rodado pelo `electron` em modo sem janela visível):**
  - capturar o exemplo e comparar com a referência (tolerância como na 0001);
  - PDF com `/Dests`;
  - axe;
  - bloqueio de rede.
- **E2E (Playwright `_electron`)** sobre o app empacotado (`dist/`), nos dois sistemas. No Linux, com `xvfb-run`.
  Cobre o roteiro do §8.8:
  - abrir o exemplo, mudar versão e cores, salvar e conferir o YAML;
  - verificar e abrir o achado no editor falso;
  - gerar protótipos de um módulo, gerar documentação e PDF;
  - comparar com uma versão anterior;
  - cancelar uma tarefa;
  - axe em cada tela;
  - teclado.
  - Os diálogos nativos são trocados por respostas fixas só quando `PRUMO_TESTE_DIALOGOS=<json>` está definido;
    o empacotamento de produção não lê essa variável (removida no esbuild por `define`).
- **Instaladores (CI, máquinas limpas do GitHub Actions):**
  - Windows: `.exe /S` e `.msi /qn`;
  - Linux: `dpkg -i` e `.AppImage --appimage-extract-and-run`;
  - em cada caso: instalar → conferir atalhos e "Abrir com o Prumo" → executar
    `Prumo --verificar-instalacao` (abre, carrega o motor, captura uma página, imprime "ok", sai) → desinstalar →
    conferir que atalhos, chave de registro e pasta do programa sumiram.
- **Manual (registrado no 05):** Windows Sandbox e VM Ubuntu limpa, com o leitor de tela NVDA/Orca nas telas principais.

## 13. Arquivos a Criar / Alterar

- **Criar:** tudo da seção 6 em `apps/desktop/`; `packages/motor/src/{util/execucao.ts, util/recursos.ts, config/editar.ts, config/novo.ts}`;
  testes em `apps/desktop/test/{unit,electron,e2e}` e `packages/motor/test/unit/{editar,execucao}.test.ts`;
  `.github/workflows/release.yml` (instaladores + `SHA256SUMS.txt` na release).
- **Alterar:** motor (seção 6); `package.json` raiz (workspace `apps/desktop`); `ci.yml` (E2E do programa e teste dos instaladores);
  `README.md` (instalação, aviso do SmartScreen); `DEPLOYMENT.md` (release); `COMPONENTS.md`.
- **Dependências novas (exatas):**
  - `electron@45.2.2` (dev), `electron-builder@26.18.0` (dev);
  - `preact@11.1.1`, `@preact/signals@2.11.4` (empacotados na janela);
  - `@playwright/test` não é necessário: o `playwright-core` já existe e tem `_electron`.

## 14. Ordem de Execução Recomendada

1. Motor: `execucao`, `recursos`, `editarYaml`, `criarProjetoNovo`, gravação atômica, `playwright` sob demanda + testes.
2. Esqueleto do app: `empacotar.mjs`, janela com CSP, preload, IPC validado, protocolo, segurança, instância única.
3. `NavegadorElectron` + teste dentro do Electron.
4. Fila de tarefas e telas Projetos e Verificação (editor).
5. Configuração (YAML, cores e contraste, logo).
6. Protótipos (grade, painel, sinais, override, gerar PNG).
7. Documentação/PDF, Comparar, prévia ao vivo.
8. Preferências, atualização, Sobre, menu de contexto, registro.
9. E2E + axe; electron-builder; CI dos instaladores; teste em máquina limpa.

## 15. Riscos Identificados

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Renderização fora da tela difere entre Windows e Linux (fontes, escala) | Média | Baixo | Mesma tolerância da 0001; `deviceScaleFactor` fixo em 1 (`forceDeviceScaleFactor`) |
| CI Linux sem tela | Alta | Médio | `xvfb-run` para o E2E; renderização fora da tela não depende de tela |
| Electron e NSIS sem assinatura → SmartScreen | Certa | Baixo | Documentado; CI pronto para assinar |
| Limite de API do GitHub sem token (60/h por IP) | Baixa | Baixo | No máximo 1 consulta por dia; falha silenciosa na automática |
| Instalador acima de 150 MB | Baixa | Baixo | Sem `playwright-core`; `asar` compactado; medido no CI |
| `.msi` sem "Abrir com o Prumo" automático | Certa | Baixo | Opção nas Preferências; documentado |
| Motor no processo principal segura a fila de eventos durante trechos de CPU | Média | Baixo | Trechos < 3 s; janela é outro processo; andamento limitado a 10/s |

## 16. Pesquisa Realizada

- Sondagem Electron 45.2.2 nesta máquina (seção 1): motor ESM no principal; janela oculta trava fontes e captura;
  `offscreen: true` + `setContentSize` + `capturePage` funciona (1440 × 902, diferença 0,00008% do Playwright;
  28.170 px de altura); `printToPDF` com rodapé; bloqueio de rede por `webRequest`.
- npm (2026-11-04): `electron` 45.2.2 (MIT), `electron-builder` 26.18.0 (MIT), `preact` 11.1.1 (MIT),
  `@preact/signals` 2.11.4 (MIT); `electron-updater` 6.8.11 avaliado e descartado (seção 2).
- API de releases do GitHub: `GET /repos/{dono}/{repo}/releases/latest` (sem token, 60 req/h por IP).
