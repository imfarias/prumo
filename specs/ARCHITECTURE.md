# Arquitetura — Prumo

## 1. Visão Geral

O Prumo lê especificações em Gherkin (`.feature`, no padrão usado hoje com o Pirilampo) e gera,
de forma determinística: protótipos HTML das telas e seus PNGs, uma documentação navegável que
substitui o `html/index.html` do Pirilampo, PDFs e um relatório de verificação dos requisitos.

Quem usa: analistas de requisitos e fiscais (pelo programa de computador), e o CI (pela linha
de comando e pela imagem Docker). É uma ferramenta local: não tem servidor central, banco de
dados nem contas de usuário. A escala é a de um projeto de requisitos: dezenas a poucas
centenas de `.feature` (o piloto Vale-Cultura tem 44 arquivos, 41 telas e ~150 regras,
listas e mensagens).

Projeto piloto: Vale-Cultura (`aplicacao/valecultura/novo-vale-cultura-documentacao`, pasta
`3 - Requisitos`). O material do piloto **não** é versionado neste repositório (ele é público);
os testes usam um projeto de exemplo fictício em `exemplos/`.

## 2. Stack Tecnológica

Versões exatas conferidas no npm em 2026-11-03. Nenhuma dependência com licença comercial.

| Camada | Tecnologia | Versão | Licença | Justificativa |
|---|---|---|---|---|
| Linguagem | TypeScript | 7.0.2 | Apache-2.0 | Tipos no modelo de telas (contrato entre parser, renderizador e documentação); compilador nativo rápido |
| Runtime | Node.js | ≥ 22.12 | MIT | Mesmo motor na CLI, no Docker e no Electron |
| Parser | @cucumber/gherkin + @cucumber/messages | 42.0.1 / 34.2.1 | MIT | Parser oficial; aceita `# language: pt`, BOM, Esquema do Cenário, Exemplos, tabelas e descrições livres |
| Configuração | yaml | 2.9.1 | ISC | API de `Document` preserva comentários e ordem ao regravar o `projeto.yml` |
| Templates | nunjucks | 3.2.4 | BSD-2 | Herança e macros para cascas e componentes; um kit por design system |
| Markdown nas descrições | markdown-it | 15.0.3 | MIT | `**negrito**`, `<br>`, `---` e HTML simples, com `html: true` e sanitização própria |
| Busca da documentação | minisearch | 7.2.0 | MIT | Índice local gerado no build, sem servidor |
| Comparação de versões | diff | 9.0.0 | BSD-3 | Diferença por palavra no trecho alterado |
| Navegador (CLI/Docker) | playwright-core | 1.64.1 | Apache-2.0 | Só a API; usa o Chrome/Edge instalado ou o Chromium da imagem, sem baixar navegador |
| Navegador (desktop) | Electron | 45.2.1 | MIT | `capturePage` e `printToPDF` do Chromium embutido |
| Instaladores | electron-builder | 26.18.0 | MIT | NSIS (`.exe`), MSI, `.deb` e `.AppImage` |
| CLI | commander | 15.0.0 | MIT | Subcomandos e ajuda em português |
| Observação de arquivos | chokidar | 6.0.0 | MIT | Prévia ao vivo (`prumo servir` e programa) |
| Empacotamento do JS do site | esbuild | 0.28.2 | MIT | Gera o script único da documentação (busca, zoom, estados) |
| Fontes do kit `proprio` (piloto) | @fontsource/jost, @fontsource/atkinson-hyperlegible | 5.3.0 | OFL-1.1 | Fontes embutidas: funciona offline e sem CDN |
| Kit gov.br | @govbr-ds/core | 3.7.0 | MIT | Estrutura e CSS do gov.br DS (fase 4) |
| Acessibilidade | axe-core | 4.14.0 | MPL-2.0 | Roda em cada tela gerada e na documentação (uso sem modificação, compatível) |
| Comparação de PNG | pngjs + pixelmatch | 7.0.0 / 8.0.0 | MIT / ISC | Relatório lado a lado com os PNGs atuais (critério da fase 1) |
| Testes | vitest | 5.1.0 | MIT | Unidade e integração do motor e da CLI |
| Execução de TS em dev | tsx | 4.23.15 | MIT | Rodar a CLI sem build durante o desenvolvimento |

Não há banco, cache, fila nem backend HTTP: as linhas correspondentes do modelo não se aplicam.

## 3. Estrutura de Pastas

```
prumo/
├── packages/
│   └── motor/                 # biblioteca única com toda a regra; sem dependência de UI
│       └── src/
│           ├── config/        # projeto.yml, config.properties, migrar-config, overrides
│           ├── parser/        # @cucumber/gherkin → AST → índice de cenários (numeração Pirilampo)
│           ├── modelo/        # tipos Tela, Campo, Acao, Estado, Referencia; serialização telas.json
│           ├── inferencia/    # regras determinísticas sinal → componente (tabela da seção 4.2 do pedido)
│           ├── verificacao/   # lint dos requisitos; saída texto e JSON
│           ├── dados/         # geradores fictícios determinísticos (CPF, CNPJ alfanumérico, nomes)
│           ├── render/        # nunjucks + kits; uma página por tela e estado
│           ├── kits/          # proprio/ e govbr/: templates, CSS gerado a partir de tokens
│           ├── navegador/     # interface Navegador (captura PNG, PDF, axe) + adaptadores
│           ├── docs/          # documentação navegável (fase 2)
│           ├── comparacao/    # diff entre versões (fase 4)
│           └── index.ts       # API pública do motor
├── apps/
│   ├── cli/                   # `prumo` (commander) — só traduz argumentos em chamadas ao motor
│   └── desktop/               # Electron (fase 3): main, preload, renderer
├── exemplos/
│   └── exemplo-ficticio/      # projeto de requisitos fictício usado nos testes e na demonstração
├── docker/                    # Dockerfile da imagem única (Node + Chromium)
├── specs/                     # pipeline de especificação (este diretório)
└── .github/workflows/         # CI: testes, imagem e instaladores
```

## 4. Estilo Arquitetural

**Monorepo com núcleo único (motor) e adaptadores finos** (CLI, desktop, servidor de prévia),
num estilo hexagonal leve: o motor recebe uma porta `Navegador` (capturar PNG, imprimir PDF,
rodar axe) e uma porta `SistemaDeArquivos`; a CLI liga o adaptador Playwright, o desktop liga o
adaptador Electron. Assim nenhuma regra é duplicada entre CLI e programa.

Pipeline interno, em etapas puras e encadeadas:

```
.feature ─parser─▶ AST + índice ─modelo─▶ telas.json ─verificação─▶ relatório
                                     │
             projeto.yml + overrides ┴─render─▶ HTML por tela/estado ─Navegador─▶ PNG / PDF
                                               └─docs─▶ site (pasta ou arquivo único)
```

## 5. Comunicação

- CLI ↔ motor: chamada de função no mesmo processo.
- Desktop: renderer ↔ main só por `contextBridge` no `preload` (IPC com canais nomeados e
  validados); o main chama o motor. Sem `nodeIntegration`, com `contextIsolation` e `sandbox`.
- `prumo servir`: HTTP local em `127.0.0.1:4300` (só loopback) + SSE para recarga.
- Formato do contrato: `modelo/telas.json`, JSON em camelCase com `versaoModelo` (semver).
  Mudança incompatível no modelo incrementa a versão maior.

## 6. Serviços Embutidos

- Autenticação/autorização: não se aplica (ferramenta local, sem contas).
- Logging: módulo `log` do motor com níveis; a CLI imprime em stderr; `--verboso` habilita debug.
- Atualização (desktop): consulta opcional a um endereço interno configurável
  (`atualizacao.url`); nunca baixa sem aceite.
- Storage: sistema de arquivos local. Saídas sempre dentro de pastas indicadas pelo usuário.

## 7. Integrações Externas

| Sistema | Propósito | Protocolo | Autenticação | Observações |
|---|---|---|---|---|
| Chromium (local) | PNG, PDF e axe | CDP via playwright-core / API Electron | — | Chrome ou Edge instalado, `PRUMO_CHROMIUM` ou o da imagem Docker |
| Git (local) | Comparar com uma tag | CLI `git` (`git archive`/`git show`) | — | Fase 4; opcional |
| Editor (VS Code) | Abrir arquivo na linha | `code --goto arquivo:linha` | — | Desktop, fase 3 |
| Repositório de atualizações | Aviso de versão nova | HTTPS GET de um JSON | — | Endereço interno (GitLab/Nexus do MinC); desligado por padrão |
| Provedor de IA | Sugerir overrides | HTTPS | Chave do usuário | Fase 5; opcional, só com pedido explícito |

## 8. Banco de Dados

Não há banco. Persistência = arquivos versionados do projeto de requisitos (`projeto.yml`,
`telas.overrides.yml`) e saídas geradas (`modelo/telas.json`, HTML, PNG, PDF). O desktop guarda
"projetos recentes" num JSON em `app.getPath('userData')`.

## 9. Segurança

- Entradas não confiáveis: o texto das features vira HTML. Todo texto passa por escape do
  nunjucks (`autoescape: true`); o Markdown das descrições é renderizado com uma lista branca de
  tags (`strong`, `em`, `br`, `hr`, `code`, `a`, `p`, `ul`, `ol`, `li`, `img`) e atributos
  (`href` só `#…`, relativo ou `https:`; `src` só relativo).
- Saídas: o motor nunca escreve fora da pasta de saída escolhida (caminhos normalizados e
  conferidos); PNGs só em `Especificações/<módulo>/<tela>.png`.
- Rede: nenhuma chamada de rede no motor. Páginas geradas não referenciam CDN; CSP
  `default-src 'self' 'unsafe-inline' data:` nas páginas e no desktop.
- Desktop: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, nenhum conteúdo
  remoto, `will-navigate` bloqueado para fora de `file://` do projeto.
- LGPD: só dados fictícios nos protótipos (geradores determinísticos; nomes com sufixo
  "Exemplo"). Nenhuma especificação sai da máquina sem pedido explícito (IA, fase 5).

## 10. Padrões de Código

- Arquivos: `kebab-case.ts`; tipos e classes `PascalCase`; funções e variáveis `camelCase`.
  Termos de domínio em português (`Tela`, `Campo`, `Acao`, `verificar`), termos técnicos em
  inglês quando não houver equivalente comum.
- ESM puro (`"type": "module"`), `strict: true`.
- Erros: o motor retorna `Achado[]` (verificação) em vez de lançar para problemas do requisito;
  lança `ErroPrumo` (com código e mensagem em português "o que fazer") só para falhas de uso
  (pasta inexistente, YAML inválido). A CLI converte em código de saída.
- Determinismo: ordenação estável por caminho e posição; nenhum `Date.now()`/aleatório nas
  saídas; geradores fictícios semeados por hash de `tela.id + campo`.

## 11. Estratégia de Testes (referência mestre — vinculante)

Adaptada a uma ferramenta sem backend HTTP:

- **Integração do motor (equivale a "backend integração"):** roda o pipeline real sobre
  `exemplos/exemplo-ficticio/` e fixtures em disco, sem mock de módulos do próprio motor. Mock só
  de fronteira externa (o `Navegador` pode ser real em CI ou um duplo que grava chamadas).
  Verifica o estado final no disco (arquivos gerados, `telas.json`).
- **Unitário:** só funções puras — numeração de cenários, máscaras, CPF/CNPJ, regras de inferência
  isoladas, parsing de links.
- **CLI:** executa o binário com `execa`-equivalente (`node:child_process`) e confere código de
  saída, stdout e arquivos.
- **Páginas geradas (equivale a "frontend componente"):** cada tela e estado do exemplo renderizado
  no Chromium; axe-core zerado de violações sérias e críticas; seletores por `data-testid`.
- **Regressão visual:** comparação de PNG do exemplo contra referência aprovada (pixelmatch,
  tolerância configurada).
- **E2E (fases 2 e 3):** documentação gerada aberta por `file://`; programa Electron via Playwright.
- **Massa de dados:** o projeto `exemplo-ficticio` + fábricas de features
  (`criarFeature({tipo, campos, ...})`) para casos de verificação plantados.
- Frameworks: vitest; playwright-core para navegador.
- Pastas: `packages/motor/test/{unit,integracao}`, `apps/cli/test`.
- Cobertura mínima: 85% de linhas no motor.

## 12. Acessibilidade (a11y)

- Nível alvo: WCAG 2.1 AA e eMAG 3.1 — nas telas geradas, na documentação e no programa.
- Campos com `id` estável (`{tela}-{campo}`) ligado a `label[for]`; obrigatórios com `aria-required`
  e marca visual; erros com `aria-describedby` e resumo de erros no topo com links aos campos.
- Ícone-botão com `aria-label`; regiões `header`, `nav`, `main`, `footer`; migalha com
  `aria-label="Migalha"`; tabela com `th scope`; foco visível; ordem de tabulação = ordem visual.
- Contraste mínimo 4,5:1 conferido a partir dos tokens; a verificação avisa token sem contraste.
- `data-testid` = `{tela}-{elemento}` em campos, botões e contêineres de estado.

## 13. Deploy e Ambientes

- Não há ambiente de servidor. Artefatos de entrega: pacote npm interno (opcional), imagem Docker
  (`ghcr.io/imfarias/prumo`) e instaladores Windows/Linux anexados às releases.
- CI: GitHub Actions — testes em cada PR; em tag `v*`: imagem Docker e instaladores
  (`windows-latest`, `ubuntu-latest`). Uso no Jenkins do MinC pela imagem Docker.
- Branch de produção: `main`. Branches a partir de `main`; PR com título igual ao nome da branch;
  conflitos conferidos com `git merge-tree` antes de abrir. Commits sem referência a IA.

## 14. Decisões e Trade-offs

| # | Decisão | Alternativas consideradas | Trade-off aceito | Data |
|---|---|---|---|---|
| 1 | TypeScript/Node para tudo | Manter Python (gerador atual) | Reescrever os componentes do gerador Python; ganha um só motor para CLI, Electron e Docker | 2026-11-03 |
| 2 | playwright-core usando o Chrome/Edge instalado | Playwright com download do navegador; Puppeteer | Depende de haver Chrome/Edge (Edge vem no Windows); no Docker o Chromium vem na imagem | 2026-11-03 |
| 3 | Nunjucks para templates | JSX/Preact SSR; Handlebars | Sem checagem de tipos nos templates; ganha herança de cascas e edição por não-programadores | 2026-11-03 |
| 4 | Site de documentação sem framework (TS + esbuild) | Angular/React/Vue | Mais código manual de UI; ganha um JS leve e abertura por `file://` | 2026-11-03 |
| 5 | Documentação nos dois modos (pasta e arquivo único) | Só pasta | Dois caminhos de empacotamento; o mesmo HTML é gerado e o modo único só embute recursos | 2026-11-03 |
| 6 | Instaladores só Windows e Linux | Incluir macOS | Sem `.dmg` | 2026-11-03 |
| 7 | Numeração de links = posição 0-based entre Contexto e Cenários | 1-based só cenários | Reproduz exatamente o Pirilampo (conferido na saída atual) | 2026-11-03 |

## 15. Não-funcionais alvo

- `prumo verificar` no Vale-Cultura: < 2 s. `prumo gerar` (HTML das 41 telas): < 5 s.
  `prumo capturar` (41 PNGs a 1440 px): < 60 s.
- Busca na documentação: < 200 ms por consulta com toda a especificação.
- Determinismo: duas execuções sobre a mesma entrada produzem bytes idênticos (exceto PNG/PDF,
  que devem ser visualmente idênticos).
- Offline: nenhuma conexão de rede exceto a checagem de atualização opcional e a IA opcional.
