# Componentes Reutilizáveis

> Antes de criar componente novo, procure aqui. Se criou um novo reutilizável, registre.

## Componentes de tela (kit `proprio`, `packages/motor/kits/proprio/`)
| Nome | Caminho | Propósito | Parâmetros principais | Usado em |
|---|---|---|---|---|
| `campo(c)` | `macros.njk` | Campo por componente (texto, máscara, seleção, leitura, caixa, captcha, arquivos, área de texto) com rótulo, obrigatório, ajuda e erro | `id`, `testid`, `rotulo`, `componente`, `valor`, `obrigatorio`, `erro`, `opcoes`, `classe` | todos os layouts |
| `grade(lista)` | `macros.njk` | Grade de 12 colunas de campos | lista de campos | formulário, filtros |
| `acoes(lista, testid)` | `macros.njk` | Barra de botões/links de ação | `rotulo`, `primaria`, `href`, `icone` | todos os layouts |
| `tabela(t, testid)` | `macros.njk` | Tabela com `caption`, `th scope`, `data-rotulo` e ações de linha | `colunas`, `linhas`, `legenda` | listagem, leitura, API |
| `paginacao(p, testid)` | `macros.njk` | Paginação acessível | `total`, `paginas` | listagem |
| `mensagem(estado, tela)` | `macros.njk` | Resumo de erros (`role=alert`) ou mensagem de sucesso/aviso | `resumoErros`, `mensagemTopo` | todas as telas |
| `icone(nome)` | `macros.njk` | Ícones SVG de traço (alerta, visto, lupa, enviar, arquivo, info) | nome | macros |
| Casca pública / autenticada | `casca-publica.njk`, `casca-autenticada.njk` | Moldura com topo/rodapé ou trilho com menu do perfil | `casca`, `projeto` | layouts |

## Documentação (kit `docs`, `packages/motor/kits/docs/`)
| Nome | Caminho | Propósito | Parâmetros principais | Usado em |
|---|---|---|---|---|
| `arvore(nos, atual, hrefPagina)` | `macros.njk` | Menu em `<details>` (sem JS), com situação nova/alterada | árvore, endereço atual | todas as páginas |
| `filho(f, interativo)` | `macros.njk` | Cenário com tags, "Copiar link", mudanças e "Usada em" | `FilhoDoc` | funcionalidade |
| `tabela(t, legenda)` / `passos(lista)` | `macros.njk` | Tabelas em região rolável e passos com palavra-chave | `TabelaDoc`, `PassoDoc[]` | funcionalidade, prévia |
| `*-corpo.njk` | kit | Corpo de cada página, reaproveitado no modo pasta, no arquivo único e no PDF | contexto de `gerar.ts` | — |
| Cliente `web/` | `packages/motor/web/` | Rotas antigas, busca, prévia, protótipo, copiar, contraste, Matriz | `#prumo-config`, `window.PRUMO_DADOS` | todas as páginas |
| Ponte do protótipo | `kits/proprio/prumo-prototipo.js` | Altura e navegação do protótipo dentro do iframe | — | protótipos |

## Motor (`packages/motor/src/`)
| Nome | Caminho | Propósito | Assinatura |
|---|---|---|---|
| `preparar` | `executar.ts` | Lê config, features, overrides e monta o modelo | `(specs, {projeto?}) → Preparado` |
| `gerar` / `gerarECapturar` / `compararComAtuais` | `executar.ts` | Fluxos da CLI | ver `index.ts` |
| `lerFeatures` / `converter` | `parser/ler.ts` | Parser com posição Pirilampo | `(specs) → {arquivos, achados}` |
| `montarIndice`, `chaveCodigo` | `parser/indice.ts` | Índice de RNG/LOV/MSG/E-mail e normalização de códigos | — |
| `extrairLinks`, `extrairImagens` | `parser/links.ts` | Links `#/scenario`, `#!/feature` e imagens com linha/coluna | `(texto, origem)` |
| `verificar`, `formatarTexto`, `formatarJson` | `verificacao/` | Lint e saída | — |
| `cpf`, `cnpj`, `cnpjDe12`, `validarCpf`, `validarCnpj` | `dados/documentos.ts` | Documentos fictícios válidos (inclui CNPJ alfanumérico) | — |
| `confereMascara`, `aplicarMascara` | `dados/mascara.ts` | Máscaras `#`/`A`/`X` | — |
| `criarGerador`, `valorFicticio` | `dados/ficticios.ts` | Dados fictícios determinísticos | `(semente, opções)` |
| `contraste`, `misturar` | `render/contraste.ts` | WCAG e derivação de tokens | — |
| `gravarSeMudou` | `render/recursos.ts` | Escrita idempotente | `(destino, conteúdo) → boolean` |
| `dentroDe`, `relativoPosix` | `util/caminhos.ts` | Proteção de caminho de saída | — |
| `renderizarMarkdown`, `renderizarInline`, `sanitizarHtml` | `docs/markdown.ts` | Markdown/HTML das features com lista branca e reescrita de links | `(texto, {linkDe, imagemDe})` |
| `modeloDaDocumentacao`, `lerRotaAntiga`, `arquivoDaPagina` | `docs/modelo.ts` | Modelo da documentação e rotas do Pirilampo | `(Preparado, {modo, comparacao?})` |
| `compararVersoes`, `diffHtml`, `textoDoFilho` | `docs/comparar.ts` | Comparação por título e diff por palavra | `(atual, anterior, versao)` |
| `prepararVersaoAnterior` | `docs/anterior.ts` | Pasta ou ref do Git → `Preparado` | `(specs, valor)` |
| `gerarDocumentacao`, `prepararDocumentacao` | `docs/gerar.ts` | Site em pasta ou arquivo único | `(specs, OpcoesDocs)` |
| `gerarPdf`, `paginasDosDestinos` | `docs/pdf.ts` | PDF com sumário numerado; páginas dos destinos nomeados | `(specs, OpcoesPdf)` |
| `servir` | `docs/servir.ts` | Servidor local com recarga | `(specs, {porta})` |
| `andar`, `verificarCancelamento`, `OpcoesExecucao` | `util/execucao.ts` | Andamento e cancelamento das tarefas longas (`ErroPrumo('CANCELADO')`) | `{sinal?, aoAndamento?}` |
| `diretorioKits`, `arquivoFonte`, `arquivoAxe` | `util/recursos.ts` | Recursos do motor pelo pacote ou por `PRUMO_RECURSOS` | — |
| `editarYaml` | `config/editar.ts` | Muda chaves do YAML mantendo comentários, ordem e estilo das linhas não tocadas | `(texto, mudancas) → {texto, alteradas}` |
| `criarProjetoNovo` | `config/novo.ts` | Estrutura mínima que passa na verificação | `(pasta, {nome, versao, orgao?})` |
| `marcarPng`, `pngDoPrumo` | `navegador/marca-png.ts` | Marca `Software=Prumo` no PNG (tEXt) para saber o que pode ser sobrescrito sem perguntar | `(png) → png`, `(png) → boolean` |

## Adaptadores
| Nome | Caminho | Propósito |
|---|---|---|
| `Navegador` (porta) | `navegador/navegador.ts` | Capturar, axe, PDF, bloqueio de rede |
| `NavegadorPlaywright` | `navegador/playwright.ts` | `PRUMO_CHROMIUM` → Edge → Chrome (CLI e Docker) |
| `NavegadorElectron` | `apps/desktop/src/principal/navegador-electron.ts` | Chromium do Electron em janelas fora da tela; captura, PDF, axe, bloqueio de rede (programa) |

## Programa de computador (`apps/desktop/src/`)
| Nome | Caminho | Propósito |
|---|---|---|
| `CANAIS`, `validar`, `EVENTOS` | `comum/canais.ts` | Lista fechada de canais janela ↔ principal, com validação da forma dos dados |
| `Servicos` | `principal/servicos.ts` | Projeto aberto, configuração, protótipos e a fila de tarefas (uma por vez, cancelável) |
| `ArmazemPreferencias` | `principal/preferencias.ts` | Preferências e recentes em `userData`, gravação atômica |
| `Atualizador` | `principal/atualizacao.ts` | Releases do GitHub + `SHA256SUMS.txt`; nunca instala sozinho |
| `comandoDoEditor`, `rodar` | `principal/editor.ts` | Abrir arquivo:linha no VS Code, em outro editor ou no aplicativo padrão |
| `definirMenuContexto` | `principal/menu-contexto.ts` | "Abrir com o Prumo" em HKCU pelo `reg.exe` (instalação pelo `.msi`) |
| `registrarRaiz`, `urlDe` | `principal/protocolo.ts` | `prumo-arquivo://` servindo só as pastas registradas |
| `blindar`, `PREFERENCIAS_WEB` | `principal/seguranca.ts` | CSP, sandbox, navegação e permissões negadas |
| `PreviaAoVivo` | `principal/previa.ts` | Vigia o projeto e regenera verificação e protótipos |
| `rodarTarefa`, `ocupado`, `invocar` | `janela/estado.ts` | Tarefa longa com andamento, confirmação de sobrescrita e botões desativados enquanto roda |

## Testes
| Nome | Caminho | Propósito |
|---|---|---|
| `criarProjeto` | `packages/motor/test/fabricas/projeto.ts` | Cópia do exemplo em pasta temporária com acento e espaço |
| `fabricaFeature` | `packages/motor/test/fabricas/feature.ts` | Feature no padrão Pirilampo para casos plantados |
| `criarRepositorio`, `aplicarMudancas` | `packages/motor/test/fabricas/repositorio-git.ts` | Repositório Git com duas versões (nova, alterada, removida, renomeada) |
| `criarEspecificacaoGrande` | `packages/motor/test/fabricas/especificacao-grande.ts` | Especificação 5× o piloto para medir a busca |
| `abrirPrograma` | `apps/desktop/test/fabricas/programa.ts` | Programa (dist/) com o exemplo copiado, `userData` próprio, diálogos com respostas fixas e axe |
| `servirRelease` | `apps/desktop/test/fabricas/release.ts` | Release falsa do GitHub em 127.0.0.1 (SHA certo ou errado, sem somas, HTTP de erro) |
| `editor-falso.mjs` | `apps/desktop/test/fabricas/` | Editor que grava `arquivo:linha` para o teste do achado |
