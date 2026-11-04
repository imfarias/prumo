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

## Adaptadores
| Nome | Caminho | Propósito |
|---|---|---|
| `Navegador` (porta) | `navegador/navegador.ts` | Capturar, axe, PDF, bloqueio de rede |
| `NavegadorPlaywright` | `navegador/playwright.ts` | `PRUMO_CHROMIUM` → Edge → Chrome |

## Testes
| Nome | Caminho | Propósito |
|---|---|---|
| `criarProjeto` | `packages/motor/test/fabricas/projeto.ts` | Cópia do exemplo em pasta temporária com acento e espaço |
| `fabricaFeature` | `packages/motor/test/fabricas/feature.ts` | Feature no padrão Pirilampo para casos plantados |
