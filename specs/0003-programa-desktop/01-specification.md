# 0003 — Programa de computador com instaladores Windows e Linux

**Status:** Especificado · **Data:** 2026-11-04 · **Fase do pedido:** 3 de 5

## 1. Contexto e Objetivo

As fases 1 e 2 entregaram tudo pela linha de comando e pela imagem Docker. Analistas e fiscais
não usam terminal. Esta feature entrega o **Prumo como programa de computador**, com instalador,
que faz pelo menu o mesmo que a CLI faz. Ele usa **o mesmo motor**, sem duplicar regra, e o
Chromium embutido do Electron gera os PNGs e os PDFs.

**Critério do pedido (§8.8).** Os instaladores de Windows e Linux:
- instalam e desinstalam numa máquina limpa, sem Node, Python nem Java;
- criam o atalho, e o Prumo abre pelo menu.

Pelo programa, sem terminal, dá para:
- abrir a pasta do Vale-Cultura;
- mudar a versão e as cores;
- verificar e ir ao problema;
- gerar os protótipos de um módulo, a documentação e o PDF;
- comparar com a versão anterior.

## 2. Atores

| Ator | Uso |
|---|---|
| Analista de requisitos | Abre o projeto, edita a configuração, verifica, gera protótipos, documentação e PDF, acompanha a prévia ao vivo |
| Fiscal / cliente | Abre a documentação gerada, compara versões, gera PDF para anexar à OS |
| Equipe de TI de quem usa o Prumo | Instala em massa pelo `.msi` (Windows) ou `.deb` (Linux) |

## 3. Pré-condições

- Windows 10/11 (x64) ou Linux x64 (Ubuntu 22.04+ ou Debian 12+ para o `.deb`; qualquer distribuição com glibc 2.31+ para o `.AppImage`).
- Nenhum outro software: Node, Chromium e Git **não** precisam estar instalados.
  - A comparação com uma referência do Git exige o `git`. Sem ele, o programa só oferece a comparação por pasta (FA-09).

## 4. Fluxo Principal

1. O analista instala o Prumo (assistente `.exe`, `.msi`, `.deb` ou `.AppImage`) e o abre pelo menu Iniciar,
   pelo atalho na área de trabalho ou pelo menu de aplicativos do Linux.
2. Na tela **Projetos**, aciona **Abrir pasta** e escolhe a pasta de especificações (ou uma pasta acima dela; o
   Prumo procura a `Especificações` com `.feature`).
3. O Prumo lê o projeto e mostra o resumo: nome, versão, número de telas e achados da verificação. A pasta
   entra nos **recentes**.
4. Pelo menu lateral, o analista passa pelas telas **Configuração**, **Verificação**, **Protótipos**,
   **Documentação e PDF** e **Comparar versões** (seção 6).
5. Toda ação longa mostra o andamento (passo atual e percentual) e o botão **Cancelar**. Ao terminar, oferece
   **Abrir no navegador** e **Abrir a pasta**.
6. Com a **prévia ao vivo** ligada, salvar um `.feature`, o `projeto.yml` ou o `telas.overrides.yml` em qualquer
   editor atualiza a prévia aberta no programa.

## 5. Fluxos Alternativos

| # | Situação | Comportamento |
|---|---|---|
| FA-01 | Pasta sem `.feature` | Mensagem DSK-01; nada entra nos recentes |
| FA-02 | Pasta sem `projeto.yml` | Abre com o `config.properties` (ou padrão) e oferece **Criar projeto.yml** (o mesmo `migrar-config`) |
| FA-03 | `projeto.yml` inválido | Abre a tela Configuração com o erro e a linha; as demais telas ficam disponíveis com os padrões |
| FA-04 | **Criar projeto novo** | Pergunta nome, versão, órgão e pasta; cria `Especificações/` com `projeto.yml`, um módulo de exemplo (um `.feature` fictício), `Regras_de_negócio/` e `Mensagem_de_Interface/` mínimos; abre o projeto |
| FA-05 | Clique num achado da verificação | Abre o arquivo na linha no editor configurado (VS Code por padrão: `code --goto arquivo:linha`); sem editor encontrado, abre o arquivo no aplicativo padrão do sistema e mostra a linha |
| FA-06 | Cancelar uma ação longa | Interrompe entre etapas (sem arquivo pela metade: o que já foi gravado fica íntegro, o que não terminou não é gravado) e mostra "Cancelado" |
| FA-07 | Erro durante uma ação | Mensagem que diz o que fazer (os mesmos textos da CLI) e botão **Ver detalhes** com o registro técnico |
| FA-08 | Há versão nova nas releases do GitHub | Aviso discreto "Versão X disponível" com **Ver novidades** e **Baixar**; nada é baixado sem o clique; **Lembrar depois** adia por 7 dias |
| FA-09 | Comparar com uma ref do Git sem `git` instalado | Opção "Branch, tag ou commit" desabilitada com a explicação; a opção "Pasta" continua |
| FA-10 | "Abrir com o Prumo" no botão direito de uma pasta (Windows; no Linux, pelo arquivo `.desktop`) | Abre o programa já com aquela pasta |
| FA-11 | Segunda instância (abrir de novo pelo atalho ou pelo botão direito) | A janela que já está aberta vem para a frente e recebe a pasta |
| FA-12 | IA configurada (fase 5) | A tela **Sugerir (IA)** só aparece quando houver IA configurada; nesta fase não aparece |
| FA-13 | Arquivo de projeto alterado fora do programa enquanto a Configuração está aberta com mudanças não salvas | Aviso "O projeto.yml mudou no disco" com **Recarregar** e **Manter as minhas** |

## 6. Telas

Todas em português, operáveis só com o teclado, com foco visível, contraste AA e textos ampliáveis
(zoom de 200% sem perder conteúdo). Cores e fontes do próprio Prumo (não do projeto aberto), com
modo escuro seguindo o sistema.

### 6.1 Projetos (tela inicial)

| # | Elemento | Comportamento |
|---|---|---|
| 1 | Botão **Abrir pasta** | Diálogo nativo de pasta; FA-01/FA-02 |
| 2 | Botão **Criar projeto novo** | FA-04 |
| 3 | Lista **Recentes** | Até 10 itens: nome do projeto, versão, caminho, data em que foi aberto; Enter abre; Delete tira da lista (não apaga arquivos); item cuja pasta sumiu aparece marcado "pasta não encontrada" |
| 4 | Área "Solte uma pasta aqui" | Arrastar uma pasta abre o projeto |

### 6.2 Configuração

Formulário do `projeto.yml`. Ao gravar, **preserva a ordem e os comentários** do arquivo e muda só as chaves alteradas.

| # | Campo | Tipo | Validação | Observações |
|---|---|---|---|---|
| 1 | Nome | texto | obrigatório, até 80 | |
| 2 | Versão | texto | obrigatório | |
| 3 | Órgão | texto | — | |
| 4 | Logo | arquivo (png, jpg, svg) | existe | Prévia da imagem; o arquivo é copiado para a pasta do projeto quando está fora dela |
| 5 | Kit de design | seleção: `proprio`, `govbr` | — | `govbr` com a nota "chega na fase 4" |
| 6 | Cores (fundo, texto, primária, menu, texto do menu, destaque, erro) | seletor de cor + campo hex | `#RRGGBB` | Prévia de contraste por par (texto/fundo, primária/fundo, texto do menu/menu, erro/fundo) com a razão e "AA"/"abaixo de AA" |
| 7 | Fontes (títulos, texto) | seleção | — | Embutidas: Jost, Atkinson Hyperlegible; outras com aviso |
| 8 | CSS adicional | arquivo `.css` | existe | |
| 9 | Largura de captura | número | 320–3840 | |
| 10 | Cascas | lista editável | — | Topo, rodapé, menu, itens da conta |
| 11 | Perfis | lista de perfis, cada um com os itens de menu | — | |
| 12 | Módulos | tabela pasta → casca, perfil | pasta existe | Pastas do projeto pré-carregadas |
| 13 | Padrões | listas em tela, paginação, largura máxima | — | |
| 14 | Dados fictícios | CNPJ numérico/alfanumérico, sufixo | — | |
| 15 | Máscaras | tabela nome → máscara(s) | — | |
| 16 | Documentação | arquivo único, PDF retrato/paisagem, protótipo aberto, versão anterior padrão | — | |


Botões: **Salvar** (desabilitado sem mudanças), **Descartar mudanças**, **Abrir no editor**. Mudanças não salvas
ao trocar de tela → pergunta "Salvar, descartar ou voltar".

### 6.3 Verificação

| # | Elemento | Comportamento |
|---|---|---|
| 1 | Resumo | "N erros, M avisos" e data/hora da última verificação |
| 2 | Agrupamento | Por **tipo** (código do achado) ou por **arquivo**, alternável |
| 3 | Filtros | Severidade (erro, aviso, informação); texto |
| 4 | Item | Severidade (ícone + texto), `arquivo:linha`, mensagem, sugestão; Enter ou clique → FA-05 |
| 5 | **Verificar de novo** | Também automático ao salvar arquivos com a prévia ao vivo ligada |
| 6 | **Exportar JSON** | O mesmo `--formato json` da CLI |

### 6.4 Protótipos

| # | Elemento | Comportamento |
|---|---|---|
| 1 | Grade de telas | Miniatura (PNG atual ou capturada na hora), título, módulo, layout; filtro por módulo e texto |
| 2 | Abrir tela | Painel com o protótipo clicável (o mesmo HTML da 0001), seletor de estados e zoom |
| 3 | **Sinais da inferência** | Lista de cada campo com o componente escolhido e o motivo ("virou seleção por causa da LOV-06") |
| 4 | **Editar override** | Formulário do `telas.overrides.yml` da tela (layout, perfil, casca, seções, ordem, por campo: componente, largura, rótulo, ajuda, opções); mostra o diff do YAML antes de gravar; preserva comentários |
| 5 | **Gerar PNG** | Desta tela, do módulo ou de todas; grava em `Especificações/<módulo>/<tela>.png` (mesma regra da 0001: não regrava sem mudança); pergunta antes de sobrescrever PNGs que **não** foram gerados pelo Prumo |
| 6 | **Comparar com os PNGs atuais** | O mesmo `comparar-png`, com o relatório aberto no programa |

### 6.5 Prévia ao vivo

Interruptor no topo do programa ("Prévia ao vivo"). Ligado, vigia a pasta do projeto e regenera:
- os protótipos abertos;
- a documentação aberta;
- a verificação.

A atualização acontece em até 3 s depois de salvar.

### 6.6 Documentação e PDF

| # | Elemento | Comportamento |
|---|---|---|
| 1 | Pasta de saída | Padrão `<specs>/../html` (da 0002); escolher outra |
| 2 | Modo | Site em pasta ou arquivo único |
| 3 | **Gerar documentação** | Andamento e cancelar; ao fim: **Abrir no navegador**, **Abrir a pasta**, **Ver aqui** (a documentação dentro do programa) |
| 4 | PDF: recorte | Tudo, módulos (múltipla escolha) ou funcionalidades (múltipla escolha); só mudanças (exige comparação) |
| 5 | PDF: orientação | Retrato / paisagem |
| 6 | **Gerar PDF** | Diálogo nativo "Salvar como"; ao fim: **Abrir o PDF**, **Abrir a pasta** |

### 6.7 Comparar versões

| # | Elemento | Comportamento |
|---|---|---|
| 1 | Versão anterior | **Pasta** (diálogo) ou **Branch, tag ou commit** (lista das branches e tags do repositório, com campo livre); FA-09 |
| 2 | **Comparar** | Lista: novas, alteradas, removidas e possíveis renomeações, com contagem de cenários mudados |
| 3 | Item | Abre a funcionalidade com o trecho alterado destacado (a mesma página da 0002) |
| 4 | **Gerar documentação com a comparação** / **PDF só das mudanças** | Atalhos para 6.6 |

### 6.8 Atualização e Sobre

- **Sobre:** versão do Prumo, do motor e do Chromium; licenças de terceiros; caminho do registro (log).
- **Verificar atualizações:** consulta as releases do GitHub (seção 7, RN-73) na abertura (no máximo uma vez por dia)
  e sob demanda; mostra FA-08. Em Preferências, dá para desligar a verificação.

### 6.9 Mensagens

| Código | Texto |
|---|---|
| DSK-01 | "Não há arquivos .feature em {pasta}. Escolha a pasta de especificações (a que contém as pastas dos módulos)." |
| DSK-02 | "Projeto aberto: {nome} {versão} · {n} telas · {e} erros, {a} avisos." |
| DSK-03 | "Configuração salva. {n} campos alterados no projeto.yml." |
| DSK-04 | "Há mudanças não salvas na configuração. Salvar, descartar ou voltar?" |
| DSK-05 | "Versão {x} do Prumo disponível. Ver novidades · Baixar · Lembrar depois" |
| DSK-06 | "Não foi possível verificar atualizações em {endereço}: {motivo}." (só na verificação sob demanda) |
| DSK-07 | "Nenhum editor encontrado para abrir {arquivo}. Configure o editor em Preferências." |
| DSK-08 | "{n} PNGs não foram gerados pelo Prumo e serão substituídos. Continuar?" |

## 7. Regras de Negócio

- **RN-70** O programa usa o pacote `@prumo/motor`, o mesmo da CLI, para todas as regras: leitura, verificação,
  protótipos, documentação, comparação e PDF. A interface só chama o motor e mostra o resultado.
- **RN-71** Captura de PNG, PDF e axe usam o Chromium do próprio Electron, pela mesma porta `Navegador` da 0001.
  Não usa Playwright nem navegador instalado.
- **RN-72 Segurança da janela:**
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`;
  - comunicação só pelo `preload`, com uma lista fechada de canais validados;
  - nenhum conteúdo remoto carregado; navegação para fora do programa bloqueada (`will-navigate`, `setWindowOpenHandler`);
  - links externos abrem no navegador do sistema;
  - CSP restritiva nas telas do programa.
- **RN-73 Atualização:**
  - **ligada por padrão**: na abertura, no máximo uma vez por dia, o programa consulta a última release
    publicada do Prumo no GitHub (`https://api.github.com/repos/imfarias/prumo/releases/latest`);
  - compara a versão com a instalada (SemVer) e lê os arquivos da release (`.exe`, `.msi`, `.deb`, `.AppImage`)
    e o `SHA256SUMS.txt` publicado junto;
  - baixa só com o clique, o arquivo do sistema e do formato em uso, e confere o SHA-256 antes de oferecer instalar;
  - não instala sozinho;
  - é a **única** conexão de rede do programa (pedido §8.11); pode ser desligada em Preferências ou com `PRUMO_ATUALIZACAO=desligada`;
  - `PRUMO_ATUALIZACAO_URL` aponta para outro repositório ou para um `latest.json` próprio (uso em rede sem internet);
  - sem rede, falha em silêncio na verificação automática e mostra DSK-06 só na verificação sob demanda.
- **RN-74** O `projeto.yml` e o `telas.overrides.yml` são gravados preservando ordem, comentários e formatação das
  chaves não alteradas (API `Document` do `yaml`); só as chaves mudadas são reescritas.
- **RN-75** Recentes e preferências (editor, prévia ao vivo, tema, endereço de atualização) ficam em
  `userData/preferencias.json`; nada é gravado na pasta do projeto além do que o analista pediu.
- **RN-76** "Abrir com o Prumo":
  - **Windows:** o instalador registra a entrada no menu de contexto de pastas (`HKCU\Software\Classes\Directory\shell\Prumo`).
    Na versão `.msi` (por máquina), em `HKLM`. A desinstalação remove a entrada.
  - **Linux:** `.desktop` com `MimeType=inode/directory`.
- **RN-77** Instância única: um segundo lançamento entrega a pasta à janela aberta (FA-11).
- **RN-78** Registro técnico em `userData/logs/prumo.log` com rotação (5 arquivos × 5 MB); sem conteúdo das especificações, só caminhos e erros.
- **RN-79** Ações longas rodam fora da janela (processo utilitário ou fila no processo principal), com andamento por
  etapa e cancelamento por sinal; a interface nunca congela.

## 8. Permissões

Não há perfis. O programa:
- lê e escreve só nas pastas que o analista abriu ou escolheu como saída;
- escreve também em `userData`.

## 9. Dados

### 9.1 Preferências (`userData/preferencias.json`)

| Campo | Tipo | Default |
|---|---|---|
| `recentes` | lista de `{ caminho, nome, versao, abertoEm }` | `[]` |
| `editor` | `vscode` \| `sistema` \| caminho de executável | `vscode` |
| `previaAoVivo` | booleano | `true` |
| `tema` | `sistema` \| `claro` \| `escuro` | `sistema` |
| `atualizacao.ligada` | booleano | `true` |
| `atualizacao.url` | URL | releases do GitHub do Prumo |
| `atualizacao.lembrarDepoisAte` | data | — |

### 9.2 Instaladores

| Sistema | Formato | Escopo | Atalhos | Desinstalação |
|---|---|---|---|---|
| Windows | `.exe` (NSIS, assistente) | por usuário (padrão) ou por máquina | Menu Iniciar e área de trabalho; "Abrir com o Prumo" | Painel de controle; remove atalhos, entrada de contexto e, se o usuário marcar, `userData` |
| Windows | `.msi` | por máquina (TI) | Menu Iniciar; "Abrir com o Prumo" | `msiexec /x`; silenciosa com `/qn` |
| Linux | `.deb` | sistema | Menu de aplicativos (`.desktop` + ícone) | `apt remove prumo` |
| Linux | `.AppImage` | portátil | Sem atalho por padrão (opção "Integrar ao sistema" no primeiro uso) | Apagar o arquivo; remover a integração pelo próprio programa |

Ícone do Prumo em 16–512 px (`.ico` e `.png`). Os nomes dos arquivos seguem o padrão
`Prumo-{versao}-{sistema}.{ext}`.

## 10. Requisitos Não-Funcionais

- Abre em menos de 3 s em máquina comum. Abrir o projeto do piloto leva menos de 3 s até mostrar o resumo.
- A interface nunca congela: toda operação acima de 200 ms roda fora da janela, com andamento.
- Tamanho do instalador: menos de 150 MB (Electron + motor).
- Funciona offline (a única conexão é a atualização opcional).
- Acessibilidade:
  - eMAG 3.1 e WCAG 2.1 AA nas telas do programa;
  - axe sem violações sérias ou críticas;
  - leitor de tela (NVDA, Orca) consegue operar as telas principais;
  - os diálogos nativos do sistema são acessíveis por natureza.
- Assinatura:
  - sem certificado de assinatura de código por enquanto: o README documenta o aviso do SmartScreen e como prosseguir;
  - o CI fica pronto para assinar quando houver certificado (secrets `WIN_CSC_LINK` e `WIN_CSC_KEY_PASSWORD`);
  - todos os instaladores com SHA-256 publicado em `SHA256SUMS.txt` na release.

## 11. Dependências

- 0001 e 0002 (motor completo).
- Electron 45.2.2 (MIT), electron-builder 26.18.0 (MIT).
- CI: GitHub Actions com `windows-latest` (gera `.exe` e `.msi`) e `ubuntu-latest` (gera `.deb` e `.AppImage`).

## 12. Fora de Escopo

- macOS (decisão do usuário: só Windows e Linux).
- Editor visual de telas e editor de `.feature` dentro do programa (o ajuste é pelo override e pelo editor externo).
- Sugestões por IA (0005).
- Kit gov.br (0004).
- Atualização automática silenciosa.

## 13. Glossário Específico

- Processo principal / janela: as duas partes do Electron. As regras rodam no principal (ou num processo utilitário); a janela só mostra.
- `latest.json`: arquivo publicado junto com os instaladores que descreve a versão mais recente.

## 14. Dúvidas em Aberto

| # | Dúvida | Impacto | Proposta padrão |
|---|---|---|---|
| D-01 | ~~De onde verificar atualizações?~~ Resolvida: releases do GitHub, ligada (RN-73) | — | — |
| D-02 | ~~Há certificado de assinatura?~~ Resolvida: não por enquanto; gerar sem assinatura e deixar o CI pronto | — | — |
| D-03 | ~~Escopo do `.exe`?~~ Resolvida: por usuário no `.exe`; por máquina no `.msi` | — | — |
| D-04 | Teste em "máquina limpa" | Médio para o critério §8.8 | Automatizar no CI em runner limpo (instala, abre, fecha, desinstala) + roteiro manual em Windows Sandbox e numa VM Ubuntu, registrado no 05 |
