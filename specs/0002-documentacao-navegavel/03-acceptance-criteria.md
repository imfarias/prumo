# 0002 — Critérios de Aceite e Cenários de Teste

**Autor:** arc-lider (Momento A) · **Data:** 2026-11-04

Mesma adaptação da 0001:
- "backend integração" é o pipeline real do motor sobre arquivos em disco;
- "frontend" são as páginas geradas, abertas por `file://` no Chromium real.

## 1. Critérios de Aceite Funcionais

| # | Critério | Origem |
|---|---|---|
| CA-01 | `prumo docs` gera em `<specs>/../html/` um site que abre por `file://`, com `index.html` de entrada, uma página por funcionalidade (inclusive regras e mensagens), Matriz e "O que mudou" quando há comparação | Spec §4, RN-50 |
| CA-02 | Todo link `#/scenario/…`, `#!/scenario/…`, `#/feature/…`, `#!/feature/…` e `#!/feature/…/{termo}` das features abre o destino certo (funcionalidade e cenário pela posição Pirilampo), no exemplo e no piloto | Pedido §8.4, RN-51 |
| CA-03 | Toda funcionalidade, todo filho (Contexto/Cenário/Esquema), toda tabela e todo protótipo do `html/index.html` atual do piloto aparecem na documentação gerada | Pedido §8.4, RN-53 |
| CA-04 | Cada funcionalidade de tela mostra o protótipo clicável embutido, com troca de estado e zoom, nos dois modos | Spec 6.3 |
| CA-05 | Cada cenário tem link copiável `#!/f/{end}/c/{n}` que abre o cenário | RN-52 |
| CA-06 | Clicar num link de RNG/LOV/MSG/E-mail abre a prévia; Esc fecha e o foco volta ao link; "Abrir" leva à página | FA-05 |
| CA-07 | Busca acha qualquer texto de cenário, sem acento e sem caixa, por prefixo e com um erro de digitação; código ("RNG-06") vai direto; < 200 ms por consulta | Pedido §8.6, spec 6.7 |
| CA-08 | Rastreabilidade: cada RNG/LOV/MSG/E-mail lista "Usada em"; a Matriz cruza telas × códigos | Spec 6.4 |
| CA-09 | Comparação com pasta ou referência do Git marca nova/alterada/removida no menu e na página; "Ver mudanças" destaca o trecho por palavra; "Ver versão anterior" mostra lado a lado | Spec 6.6 |
| CA-10 | PDF de um módulo sai com capa, sumário com números de página corretos, rodapé "página X de Y" e sem linha de tabela cortada; cabeçalho da tabela repetido na página seguinte | Pedido §8.7, spec 6.5 |
| CA-11 | Arquivo único (`--arquivo-unico`) com o mesmo conteúdo e as mesmas rotas, sem nenhum arquivo externo | RN-55, RN-56 |
| CA-12 | Nenhum recurso de rede (CDN, fontes, scripts) em nenhuma página; abre offline | RN-57, pedido §8.11 |
| CA-13 | axe sem violações sérias ou críticas em todas as páginas da documentação, a 1440 px e a 390 px; teclado em todas as ações | Pedido §8.9 |
| CA-14 | Determinismo: duas gerações → mesmos bytes | RN-58 |
| CA-15 | `prumo servir` serve em `127.0.0.1:4300` e recarrega a página aberta ao salvar um `.feature` | FA-08 |
| CA-16 | Mudar a identidade no `projeto.yml` muda a documentação (cores, logo, nome, versão) | Pedido §8.3 |
| CA-17 | O Prumo não apaga arquivos que não gerou na pasta de saída | RN-50 |

## 2. Cenários de Integração do Motor

| ID | Cenário | Esperado (no disco) |
|---|---|---|
| CT-I01 | Docs do exemplo, modo pasta | `index.html`, `f/*.html` (10 funcionalidades), `matriz.html`, `recursos/`, `prototipos/`; resumo DOC-01 |
| CT-I02 | Árvore | Módulos em ordem de pasta; regras e mensagens num grupo próprio; funcionalidade com erro de sintaxe marcada |
| CT-I03 | Página de tela | Narrativa, metadados, contexto, cenários numerados com tags, tabelas, bloco do protótipo com os estados do modelo |
| CT-I04 | Página de regras | Cada RNG/LOV com "Usada em" igual a `referencias[].usadaEm` do modelo |
| CT-I05 | Matriz | Marcas = pares (tela, código) citados |
| CT-I06 | Links reescritos | Todo `href="#/scenario/…"` vira link para `f/{arquivo}.html#c-{n}` com `data-rota` original; nenhum link quebrado no exemplo |
| CT-I07 | Imagens e logo | Copiados para `recursos/img/`; `src` relativo |
| CT-I08 | Arquivo único | Só `index.html`; nenhuma referência `src=`/`href=` a arquivo local; templates de todas as páginas e protótipos |
| CT-I09 | Limpeza segura | Arquivo alheio em `html/` continua; arquivo gerado antes e não mais gerado é removido; `index.html` do Pirilampo é substituído com aviso |
| CT-I10 | Comparação com pasta | Exemplo × cópia com 1 funcionalidade nova, 1 alterada (cenário mudado), 1 removida → situações corretas e DOC-06 |
| CT-I11 | Comparação com ref do Git | Repositório criado no teste com 2 commits; `--comparar HEAD~1` dá o mesmo resultado do CT-I10; diretório de trabalho intacto (`git status` limpo) |
| CT-I12 | Ref inexistente / fora do Git | Erros de uso DOC-07 / DOC-08 |
| CT-I13 | Renomeação de arquivo | Removida + nova com aviso "possível renomeação" |
| CT-I14 | Diff por palavra | Só a palavra trocada fica em `<ins>`/`<del>`; realinhar colunas de tabela não gera diferença |
| CT-I15 | PDF do módulo | Páginas ≥ 3; sumário com o número da página igual ao destino `/Dests` de cada funcionalidade; texto "página 1 de N" |
| CT-I16 | PDF `--so-mudancas` | Só funcionalidades novas/alteradas |
| CT-I17 | Determinismo | Duas gerações em pastas diferentes → bytes iguais (pasta e único) |
| CT-I18 | Identidade | Trocar `cores.menu` muda o CSS da documentação |
| CT-I19 | Verificação na página inicial | Achados com link; `--estrito` com erro sai 1 |

## 3. Cenários Unitários

| ID | Função | Casos |
|---|---|---|
| CT-U01 | `renderizarMarkdown` | `**negrito**`, `<br>`, `---`, listas; remove `<script>`, `onclick`, `javascript:`, `data:text/html`, `<iframe>`, `style`; mantém `href="#…"` e `https:` |
| CT-U02 | Reescrita de links | `#/scenario/A/6` → `f/{arq}.html#c-6`; `#!/feature/A` → `f/{arq}.html`; destino inexistente fica com `data-quebrado` |
| CT-U03 | Rotas do cliente (tabela 5.3) | Cada formato antigo e novo; NFC × NFD; `%C3%A1`; termo de busca |
| CT-U04 | Pareamento | Por endereço; filhos por título normalizado; títulos repetidos pela ordem |
| CT-U05 | Diff | Inclusão, exclusão, troca; espaços no fim e BOM ignorados |
| CT-U06 | `paginasDosDestinos` | PDF de 3 seções gerado no teste → páginas esperadas |
| CT-U07 | Atalho de código da busca | "RNG-06", "rng 6", "E-mail-1", "LOV-6" → item; "RNG" sozinho → busca normal |
| CT-U08 | Nome de arquivo seguro | `01_Portal_Público_02_Portal_Lista` → ASCII estável; colisões resolvidas |

## 4. Cenários do Navegador (Chromium real, `file://`)

| ID | Cenário | Esperado |
|---|---|---|
| CT-P01 | Links antigos | Para cada link das features do exemplo, abrir `index.html#{link}` mostra a funcionalidade certa e o cenário `c-{n}` visível e destacado |
| CT-P02 | Endereço inexistente | Página "Não encontrado" com sugestão |
| CT-P03 | Prévia | Clique em `[RNG-01]` abre `<dialog>` com o título; Esc fecha; `document.activeElement` = o link |
| CT-P04 | Copiar link | Copia `…#!/f/{end}/c/{n}`; abrir o copiado vai ao cenário; confirmação anunciada |
| CT-P05 | Busca | "beneficiaria" acha "Beneficiária"; "parcei" acha por prefixo; "parcerias" (erro) acha "Parceiras"; "rng 3" vai à RNG-03; ↑↓ Enter; destaque do termo na página aberta |
| CT-P06 | Desempenho da busca | Com a fábrica 5× o piloto: 50 consultas, 95º percentil < 200 ms |
| CT-P07 | Protótipo (pasta) | Iframe carrega; trocar estado muda o `src`; zoom muda a escala; link entre telas dentro do protótipo funciona |
| CT-P08 | Protótipo (único) | Iframe `blob:` com fontes carregadas; troca de estado; nenhuma requisição a arquivo externo |
| CT-P09 | Comparação | Menu com "nova"/"alterada"; "Ver mudanças" mostra `<ins>`/`<del>`; "Ver versão anterior" lado a lado |
| CT-P10 | Matriz | Filtro por texto e tipo; cabeçalho fixo; versão em lista |
| CT-P11 | axe | Todas as páginas, a 1440 e a 390 px, sem violações sérias/críticas |
| CT-P12 | Teclado | "Pular para o conteúdo" é o 1º foco; menu, busca, prévia, protótipo e copiar operáveis só com teclado; foco visível |
| CT-P13 | Sem JS (modo pasta) | `f/*.html` com JS desligado mostra o conteúdo completo |
| CT-P14 | Sem rede | Nenhuma requisição fora de `file:`/`data:`/`blob:` |
| CT-P15 | Alto contraste | Botão troca o tema; preferência mantida ao trocar de página; contraste AA |

## 5. Cenários da CLI

| ID | Comando | Esperado |
|---|---|---|
| CT-C01 | `prumo docs --specs <exemplo>` | Saída 0, DOC-01, arquivos gerados |
| CT-C02 | `prumo docs --arquivo-unico` | Um `index.html` |
| CT-C03 | `prumo docs --comparar <ref>` | DOC-06 |
| CT-C04 | `prumo docs --comparar nao-existe` | Saída 2, DOC-07 |
| CT-C05 | `prumo pdf --saida x.pdf --modulo 01_Portal` | Saída 0, DOC-03, PDF válido |
| CT-C06 | `prumo servir --porta 0` | Imprime a URL; `/saude` responde 200; Ctrl+C (SIGINT) encerra |
| CT-C07 | `prumo docs --estrito` com erro | Saída 1 |

## 6. Cenários E2E

| ID | Fluxo | Esperado |
|---|---|---|
| CT-E01 | Analista: `docs` → abrir → buscar "contato" → abrir cenário → clicar RNG → prévia → Abrir → copiar link → abrir em nova aba | Todos os passos com o resultado esperado |
| CT-E02 | `servir`: abrir a página, alterar um passo do `.feature`, a página recarrega com o texto novo | < 3 s após salvar |
| CT-E03 | Piloto (manual + teste opcional `PRUMO_PILOTO`) | CA-02, CA-03 e CA-07 no Vale-Cultura; tempo de `docs` e do PDF |

## 7. Massa de Dados

| Entregável | Caminho | Conteúdo |
|---|---|---|
| Fábrica de especificação grande | `packages/motor/test/fabricas/especificacao-grande.ts` | 5× o piloto: ~200 funcionalidades, ~1.000 cenários, 250 regras/mensagens, textos variados, gerados de forma determinística |
| Fábrica de repositório Git | `packages/motor/test/fabricas/repositorio-git.ts` | `git init` em pasta temporária com o exemplo em 2 commits (nova, alterada, removida, renomeada) |
| Exemplo fictício | `exemplos/exemplo-ficticio/` (da 0001) | Base de todos os testes |

## 8. Cobertura Mínima

Motor como na 0001 (85% de linhas, 80% de ramos). `docs/markdown.ts` e `docs/comparar.ts`: 95% de linhas.
Cliente `web/`: coberto pelos testes de navegador (sem meta numérica; todas as rotas e interações da seção 4).

## 9. Definition of Done

- [ ] CA-01 a CA-17 atendidos (CA-02, CA-03 e CA-07 também no piloto, registrados no 05-test-report)
- [ ] CT-I, CT-U, CT-P, CT-C e CT-E01/E02 automatizados e verdes no CI (Ubuntu e Windows)
- [ ] axe sem violações sérias/críticas
- [ ] `COMPONENTS.md`, `README.md` e `MEMORY.md` atualizados
- [ ] Nada do Vale-Cultura no repositório; commits sem referência a IA
- [ ] Documentação do piloto gerada localmente no WSL e conferida contra a do Pirilampo
