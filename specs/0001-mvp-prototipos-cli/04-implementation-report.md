# 0001 — Relatório de Implementação

**Autor:** arc-dev · **Data:** 2026-11-04 · **Status:** ✅ Completo

## 1. Resumo

O motor (`@prumo/motor`) e a CLI (`@prumo/cli`) da fase 1 estão implementados conforme o
desenho técnico: leitura do `projeto.yml`/`config.properties`, parser oficial do Gherkin com a
posição Pirilampo, índice de RNG/LOV/MSG/E-mail, modelo `telas.json` com os sinais de cada
decisão, inferência determinística (RN-10 a RN-21), verificação (RN-30 a RN-42), renderizador
com o kit `proprio`, captura pelo Chromium instalado, comparação de PNG e imagem Docker.

Rodado no piloto (Vale-Cultura, no WSL, sem copiar nada para o repositório):
- 44 arquivos lidos sem erro; 41 telas e 121 páginas (telas × estados) geradas.
- Verificação: 0 erros, 14 avisos (`fluxo/sem-principal`) em ~1 s.
- `comparar-png` das 41 telas em ~18 s; diferença média de pixels 21% (detalhe na seção 9).
- axe-core: 0 violações de qualquer impacto nas 121 páginas.

## 2. Arquivos Criados

| Caminho | Conteúdo |
|---|---|
| `packages/motor/src/versao.ts`, `index.ts`, `executar.ts` | Versões, API pública e orquestração (`preparar`, `gerar`, `gerarECapturar`, `compararComAtuais`) |
| `packages/motor/src/util/{texto,hash,caminhos,erros}.ts` | Normalização, slug, FNV-1a + mulberry32, `dentroDe`, `ErroPrumo` |
| `packages/motor/src/dados/{documentos,mascara,ficticios}.ts` | CPF, CNPJ numérico e alfanumérico (IN RFB 2.229/2024), máscaras `#`/`A`/`X`, dados fictícios semeados |
| `packages/motor/src/config/{esquema,properties,projeto,migrar,overrides}.ts` | Esquema com padrões e validação com linha, leitor de `.properties`, `migrar-config`, overrides |
| `packages/motor/src/parser/{tipos,ler,links,indice}.ts` | Parser, posição Pirilampo, metadados, links e imagens com linha, índice de referências |
| `packages/motor/src/modelo/{tipos,montar,serializar}.ts` | Contrato `telas.json` e montagem do modelo |
| `packages/motor/src/inferencia/{campos,acoes,estados}.ts` | Regras de componente, ações com destino, estados por MSG |
| `packages/motor/src/verificacao/{verificar,formatar}.ts` | Lint dos requisitos; saída texto e JSON |
| `packages/motor/src/render/{gerar,recursos,tokens-css,contraste}.ts` | Contexto das páginas, recursos (fontes, logo, CSS adicional), CSS dos tokens, contraste WCAG |
| `packages/motor/src/navegador/{navegador,playwright,capturar}.ts` | Porta `Navegador`, adaptador `playwright-core`, captura com "sem mudança" |
| `packages/motor/src/comparacao/png.ts` | Relatório lado a lado com % por tela e imagem de diferença |
| `packages/motor/kits/proprio/**` | `base`, cascas pública e autenticada, `topo-tela`, `macros`, layouts (listagem, formulário, formulário em etapas, leitura, API), `indice`, `estilo.css` |
| `apps/cli/src/main.ts` | `verificar`, `gerar`, `capturar`, `comparar-png`, `migrar-config` |
| `exemplos/exemplo-ficticio/**` | 7 telas em 5 módulos, regras, LOVs, mensagens, e-mail, `projeto.yml`, `config.properties`, overrides, logo SVG e PNGs de referência |

## 3. Arquivos Alterados

`package.json` (scripts `test`, `cobertura`, `prumo`), `tsconfig.base.json` (`types: ["node"]`, exigido pelo TS 7),
`packages/motor/package.json` e `apps/cli/package.json` (dependências exatas), `.gitignore`, `.dockerignore`,
`docker/Dockerfile`, `.github/workflows/ci.yml`, `specs/0001…/01-specification.md` (D-01, D-02 resolvidas;
`identidade.css_adicional`).

## 4. Migrations

Não se aplica (sem banco).

## 5. Reutilização Aplicada

Do gerador Python do piloto foram reaproveitadas as ideias, reescritas em TS (sem copiar arquivos):
algoritmo de DV de CPF/CNPJ, vocabulário de componentes (casca com trilho, migalha, selos, campos,
tabela com `data-rotulo`, paginação), grade de 12 colunas, captura a 1440 px após `document.fonts.ready`.
O `vc.css` do piloto pode ser usado localmente por `identidade.css_adicional` (copiado com suas
dependências para `_recursos/adicional/`).

## 6. IDs e Acessibilidade

| Elemento | `id` | `data-testid` |
|---|---|---|
| Campo editável / seleção / leitura | `{tela}-{campo}` | `{tela}-campo-{campo}` / `-selecao-` / `-valor-` |
| Ação | — | `{tela}-acao-{acao}`; ações de linha `{tela}-tabela-linha-{n}-{acao}` |
| Tabela, paginação, vazio, resumo de erros, mensagem | — | `{tela}-tabela`, `-paginacao`, `-vazio`, `-resumo-erros`, `-mensagem` |
| Casca | — | `casca-menu`, `casca-migalha`, `casca-conta`, `casca-atalhos` |

ARIA: `label[for]` em todos os campos (inclusive `output`), `aria-required`, `aria-invalid` +
`aria-describedby` no erro, resumo `role="alert"` com links, `role="status"` em sucesso/vazio,
`nav` com `aria-label` (Menu do perfil, Migalha, Paginação), `aria-current="page"`, `th scope="col"`,
`caption` oculta, ícones `aria-hidden`, botões de envio de arquivo com texto oculto do documento.

Teclado: ordem de Tab = ordem do documento; foco visível de 3 px (testado em CT-P05).

## 7. Variáveis de Ambiente Novas

| Variável | Uso |
|---|---|
| `PRUMO_CHROMIUM` | Caminho de um Chromium (Docker usa `/usr/bin/chromium`) |
| `PRUMO_EXIGIR_NAVEGADOR` | Testes: falha (em vez de pular) se não houver navegador — ligado no CI |
| `PRUMO_TOLERANCIA_VISUAL` | Testes: % de pixels tolerada na regressão visual (0,5 padrão; 1,5 no Linux) |
| `NO_COLOR` | Desliga cores na CLI |

## 8. Comandos para Rodar Localmente

```bash
npm install
npm run build
node apps/cli/dist/main.js verificar --specs exemplos/exemplo-ficticio
node apps/cli/dist/main.js capturar  --specs exemplos/exemplo-ficticio
node apps/cli/dist/main.js comparar-png --specs "<pasta do piloto>" --saida saida/comparacao
docker build -f docker/Dockerfile -t prumo .
docker run --rm -v "<specs>:/docs" prumo capturar --specs /docs --saida /tmp/saida
```

## 9. Decisões Durante Implementação

- **Posição Pirilampo confirmada no arquivo de mensagens:** sem Contexto, MSG-01 é `/1` porque o cenário "Mensagem de Interface" ocupa `/0`.
- **Regras de inferência acrescentadas após rodar no piloto** (todas gerais, nenhuma específica do Vale-Cultura):
  documentos com LOV viram lista de arquivos (RN-19 vence RN-14); `Editável = N` guarda as opções da LOV para colunas;
  coluna da LOV = a de mesmo nome da LOV ou a primeira que não é código; campo sem regra com o nome de uma LOV usa as opções dela;
  "Início/Término/Vencimento…" são datas; "Nome" numa tela de empresas recebe nome de empresa; MSG "nenhum registro" é aviso
  (estado vazio); o erro vai para o campo citado primeiro no cenário; o destino de uma ação pode estar no passo seguinte;
  ação de uma palavra casa com o título sem o prefixo do módulo; coluna "Ações" recebe as ações de registro como links;
  consulta sem filtros só vira tabela com 2+ colunas.
- **Verificação num único arquivo** (`verificar.ts`) em vez de `regras/*.ts`: as 13 regras somam ~150 linhas e compartilham o índice; separar não ajudava a leitura.
- **Markdown das descrições não é renderizado na fase 1:** os protótipos não exibem a narrativa; a sanitização com lista branca (CT-U13) fica para a 0002, onde a documentação mostra o texto. O HTML gerado hoje só contém texto escapado pelo Nunjucks.
- **5 linhas por tabela** (`min(paginacao, 5)`), como nas telas atuais.
- **Comparação ignora antialiasing** (`includeAA: false`) para decidir "sem mudança" no PNG; a regressão visual usa `threshold: 0.1`.

Diferenças restantes no piloto (lista para overrides ou regras novas, já que o PNG do piloto é a referência):

| Diferença | Telas | Tratamento sugerido |
|---|---|---|
| Original é janela sobre o portal; gerado é página | Recuperar/Redefinir Senha, Listas públicas (75–82%) | Novo layout/override `janela_sobre: <tela>` (proposta para a 0004, com o protótipo clicável) |
| Página inicial e login do original têm conteúdo editorial que não está na feature | Página Inicial, Login, Painel (24–27%) | Override com `html` próprio (FA-12) ou blocos de conteúdo no override |
| Selo de situação com ícone e cor | Listagens (~10%) | Regra de kit: coluna Situação/Status com valores da LOV vira selo (proposta) |
| Cabeçalho gov.br | Todas | Kit `govbr` (0004) |
| Logo do piloto é claro para fundo escuro | Casca pública | `projeto.logo_claro` ou logo alternativo no `projeto.yml` (proposta) |

## 10. Pendências e Débitos Técnicos

- `NavegadorPlaywright.pdf` existe mas só será exercitado na 0002.
- Kit `govbr` ainda cai no `proprio` com aviso (0004).
- Os PNGs de referência do exemplo foram gerados no Windows; no Linux a diferença é < 1% (antialiasing).

## 11. Observações para o arc-tester

- Testes de navegador usam o Chromium real; `PRUMO_EXIGIR_NAVEGADOR=1` no CI.
- Pastas temporárias com "3 - Requisitos/Especificações" para cobrir acento e espaço.
- Nada do Vale-Cultura pode entrar em fixture.

## 12. Bloqueios Encontrados

Nenhum.
