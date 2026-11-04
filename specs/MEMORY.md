# Memória do Projeto

## Stack atual
- TypeScript 7.0.2 sobre Node.js ≥ 22.12, ESM, monorepo npm workspaces
- Motor: @cucumber/gherkin 42.0.1, yaml 2.9.1, nunjucks 3.2.4, markdown-it 15.0.3
- Navegador: playwright-core 1.64.1 (CLI/Docker) e Electron 45.2.1 (desktop)
- Testes: vitest 5.1.0, axe-core 4.14.0

## Decisões Arquiteturais
- [2026-11-03] [Arquiteto] Um só pacote `motor` com toda a regra; CLI, desktop e `prumo servir` são adaptadores finos — Motivo: o pedido exige o mesmo motor sem duplicar regra.
- [2026-11-03] [Arquiteto] Porta `Navegador` com adaptadores Playwright (Chrome/Edge instalado ou Chromium da imagem) e Electron — Motivo: o usuário final não precisa instalar Playwright nem baixar navegador.
- [2026-11-03] [Arquiteto] Documentação suporta os dois modos, site em pasta e arquivo único, escolhidos por `documentacao.arquivo_unico` ou `--arquivo-unico` — Motivo: resposta do usuário ("possibilidade de ter os 2").
- [2026-11-03] [Arquiteto] Instaladores só Windows e Linux — Motivo: resposta do usuário.
- [2026-11-03] [Arquiteto] Repositório público no GitHub (`imfarias/prumo`); material do Vale-Cultura fica fora do repositório — Motivo: resposta do usuário; especificações do MinC não são publicadas.

## Padrões Estabelecidos
- [2026-11-03] [Arquiteto] Link de cenário do Pirilampo: `#/scenario/{Pasta}_{Arquivo}/{n}`, com `n` = posição **0-based** entre todos os filhos da Funcionalidade (Contexto, Cenário, Esquema), na ordem do arquivo. Com Contexto, o 1º cenário é 1 (RNG-01 → /1, LOV-06 → /53); sem Contexto, o 1º cenário é 0 (em Mensagens de Interface, "Mensagem de Interface" → /0 e MSG-01 → /1). Conferido na saída do Pirilampo (`data-target="#scenario-N"`).
- [2026-11-03] [Arquiteto] Link de funcionalidade: `#!/feature/{Pasta}_{Arquivo sem .feature}`.

- [2026-11-03] [Líder] Inferência: cada decisão devolve um `Sinal` (regra + descrição + origem) gravado no `telas.json`; a ordem de precedência dos componentes está no 02 da 0001, seção 6.
- [2026-11-03] [Líder] Páginas geradas: `id` = `{tela}-{campo}`, `data-testid` = `{tela}-{tipo}-{nome}`; um HTML por estado em `saida/prototipos/<módulo>/<tela>/<estado>.html`.

## Problemas Recorrentes & Soluções
- [2026-11-04] [Dev] Docker: `*.tsbuildinfo` locais no contexto fazem o `tsc -b` pular a compilação → `.dockerignore` com `**/*.tsbuildinfo`.
- [2026-11-04] [Tester] IDs que começam com dígito são válidos em HTML mas não em `querySelector` → nos testes usar `getElementById`.
- [2026-11-04] [Dev] TypeScript 7 não inclui `@types/node` sozinho → `"types": ["node"]` no `tsconfig.base.json`.
- [2026-11-04] [Tester] PNG do Linux difere < 1% do Windows (antialiasing) → `PRUMO_TOLERANCIA_VISUAL=1.5` no CI Linux.

## Pontos de Atenção
- [2026-11-03] [Arquiteto] O repositório é público: nunca versionar features, PNGs, logos ou textos do Vale-Cultura. Testes usam `exemplos/exemplo-ficticio/`.
- [2026-11-03] [Arquiteto] Commits e PRs sem referência a IA (restrição do usuário). Branch de produção `main`; PR com título igual ao nome da branch; conferir conflitos com `git merge-tree`.
- [2026-11-03] [Arquiteto] A saída atual do Pirilampo tem texto com codificação quebrada (caracteres `�`); não usar o HTML dele como fonte de texto, só como referência de estrutura e numeração.
- [2026-11-03] [Líder] Material do piloto fica no WSL, em `/var/www/html/memora/valecultura/portal-vale-cultura/doc/` (não versionado no GitLab): `Especificações/`, `html/index.html` (Pirilampo) e `Prototipos/` (gerador Python: `comum.py`, `vc.css`, `telas_*.py`, 41 HTMLs em `telas/`, fontes). O `projeto.yml` do piloto também fica lá. Nada disso entra neste repositório.
- [2026-11-03] [Líder] As telas feitas à mão usam conhecimento que não está na feature (lista de beneficiárias como janela sobre o portal, larguras de coluna c3/c5/c4, dados de exemplo ricos). A equivalência na fase 1 depende de overrides e de `identidade.css_adicional` apontando para o `vc.css` local.

- [2026-11-03] [Líder] `@cucumber/gherkin` põe o texto livre do cenário `@prototipo` (`**título**` e `![Image](x.png)`) em `scenario.description`, e os comentários `# Módulo/Tipo/Fluxo` em `gherkinDocument.comments` (fora da árvore).
- [2026-11-03] [Líder] `playwright-core` com `channel: 'msedge'|'chrome'` funciona sem baixar navegador (Edge/Chrome 156 nesta máquina).

- [2026-11-04] [Líder] Nunca rodar `prumo capturar` na pasta do piloto: sobrescreve os PNGs feitos à mão. Para comparar, usar `comparar-png` (captura em pasta temporária).
- [2026-11-04] [Líder] Propostas para a 0004: layout `janela_sobre`, selo de situação, `logo_claro` (06-final-review, seção 6).

## Glossário do Domínio
- Feature / Funcionalidade: arquivo `.feature` que descreve uma tela (ou uma regra/mensagem de apoio).
- Tela: unidade de protótipo derivada de uma feature com cenário `@prototipo`.
- Casca: moldura comum a um grupo de telas (pública com topo e rodapé; autenticada com menu do perfil).
- Kit: conjunto de templates e CSS de um design system (`proprio` ou `govbr`).
- Estado: variação de uma tela derivada de um cenário (sucesso, erro com MSG, vazio, sem permissão).
- RNG / LOV / MSG / E-mail: regra de negócio, lista de valores, mensagem de interface e mensagem de e-mail; cada uma é um cenário dos arquivos de apoio.
- Override: ajuste por tela em `telas.overrides.yml`, versionado, aplicado sobre a inferência.
- Achado: item da verificação (erro, aviso ou informação) com `arquivo:linha` e motivo.

## Convenções de Código
- Nomenclatura: arquivos `kebab-case.ts`; tipos `PascalCase`; funções `camelCase`; domínio em português.
- Tratamento de erro: problemas do requisito viram `Achado`; falha de uso lança `ErroPrumo` com código e orientação.
- Logging: módulo `log` do motor; CLI em stderr; `--verboso` para debug.
- Atributos de teste em UI: data-testid="{tela}-{elemento}"
- Atributos de acessibilidade obrigatórios: `label[for]` em todo campo, `aria-required`, `aria-describedby` para erro, `aria-label` em ícone-botão, regiões semânticas.
