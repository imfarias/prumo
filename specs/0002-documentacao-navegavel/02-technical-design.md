# 0002 — Desenho Técnico

**Autor:** arc-lider (Momento A) · **Data:** 2026-11-04 · **Spec:** [01-specification.md](01-specification.md)

## 1. Resumo da Abordagem

A documentação é mais uma saída do mesmo motor. Sobre o `Preparado` da 0001 (configuração,
arquivos, índice, modelo), o novo módulo `docs/` monta um **modelo de documentação** (árvore,
páginas, blocos já convertidos em HTML seguro, referências e "usada em") e o grava com templates
Nunjucks de um kit próprio (`kits/docs/`). Um script de navegador pequeno, sem framework
(`packages/motor/web/`, empacotado com esbuild), cuida de:
- roteamento dos links antigos;
- busca com MiniSearch;
- prévia de regra em `<dialog>`;
- visualizador do protótipo (estados e zoom);
- "Copiar link" e alto contraste.

**Modo pasta:** uma página HTML estática por funcionalidade. Ela é legível sem JavaScript, e o
`index.html` só redireciona as rotas antigas para ela.

**Arquivo único:** as mesmas páginas viram `<template>` dentro de um único `index.html`, e o
roteador troca o conteúdo. Os protótipos ficam em `<template>` e abrem num `iframe` por `blob:`,
com o CSS injetado inline na hora de abrir. Com isso o CSS e as fontes ficam guardados uma vez só.

**Comparação:** prepara a versão anterior (uma pasta, ou uma referência do Git lida com
`git show`, sem checkout) com o mesmo `preparar()`, pareia funcionalidades por endereço e
cenários por título, e calcula a diferença por palavra com `diff`.

**PDF:** uma página de impressão é gerada em duas passadas pelo Chromium. A primeira descobre a
página de cada item lendo os destinos nomeados (`/Dests`) do PDF com `pdf-lib`. A segunda escreve
os números no sumário.

**`prumo servir`:** servidor HTTP local em `127.0.0.1`, com `chokidar` vigiando as mudanças e
recarga por Server-Sent Events.

Validado antes do desenho, nesta máquina:
- **PDF:** o `printToPDF` do Chromium gera `/Dests` com o nome de cada `id` linkado. Com o `pdf-lib`,
  cada destino resolve para a página exata (teste com 6 seções de tamanhos diferentes: páginas 2, 3, 5, 8, 12 e 17).
- **Arquivo único:** um `iframe` por `blob:` aberto de `file://` funciona no Edge 156 com `<style>` inline e
  fontes em `data:`. Um CSS carregado por outro `blob:` é **bloqueado** ("Not allowed to load local resource").
  Por isso a opção pelo CSS inline.

## 2. Alternativas Consideradas

| Tema | Escolhida | Alternativa | Por que não |
|---|---|---|---|
| Site | Páginas estáticas + JS leve | SPA (Preact/Vue) | Framework e roteador para 50 páginas; perde leitura sem JS (RN-59) e encarece o arquivo único |
| Busca | MiniSearch com índice pré-gerado | Lunr; busca por regex como o Pirilampo | Lunr não tem `fuzzy` por termo tão simples e está parado; regex não ordena por relevância nem tolera erro |
| Índice em `file://` | `busca.js` (atribui a `window`) | `fetch('busca.json')` | `fetch` de `file://` é bloqueado no Chrome/Edge |
| Protótipo no arquivo único | `<template>` + `blob:` + CSS inline | `iframe srcdoc` com tudo inline por estado | 121 páginas × CSS com fontes (~90 KB) ≈ 11 MB repetidos; o template guarda o CSS uma vez |
| Prévia de regra | `<dialog>` nativo (`showModal`) | Modal próprio (Bootstrap como no Pirilampo) | O nativo já prende o foco, fecha com Esc e devolve o foco |
| Números do sumário do PDF | 2 passadas + `/Dests` via `pdf-lib` | Medir alturas no navegador; PDF por funcionalidade + junção | Medição falha com quebras de tabela; junção perde os links internos e a contagem "X de Y" |
| Versão anterior do Git | `git show <ref>:<caminho>` para uma pasta temporária | `git worktree`/checkout; `isomorphic-git` | Checkout mexe no repositório do usuário; biblioteca nova para algo que o `git` instalado faz |
| Diff | `diff.diffWordsWithSpace` sobre o texto de cada bloco | Diff de linhas do `.feature` (Pirilampo) | Realinhar colunas de tabela marcaria a tabela inteira como alterada |
| Servidor | `node:http` + SSE | Vite/servidor de desenvolvimento | Dependência pesada; só servimos arquivos gerados |

## 3. Reutilização

| Da 0001 | Uso |
|---|---|
| `preparar()`, `ArquivoFeature`, `Indice`, `ModeloTelas` | Fonte única do conteúdo (versão atual e anterior) |
| `gerarPrototipos()` | Protótipos embutidos (`<saida>/prototipos/`) e da versão anterior |
| `cssDosTokens()`, fontes embutidas, `contraste()` | Identidade da documentação |
| `extrairLinks()`, `chaveCodigo()` | Links da documentação e rótulos das prévias |
| `NavegadorPlaywright` (`pdf`, `axe`) | PDF e testes |
| `gravarSeMudou()`, `dentroDe()` | Escrita idempotente e segura |
| `textoPuro()`, `normalizar()`, `slug()` | Busca e âncoras |

Novos reutilizáveis (registrar no `COMPONENTS.md`): `renderizarMarkdown()` (sanitizado),
`modeloDaDocumentacao()`, `compararVersoes()`, `prepararVersaoAnterior()`, `paginasDosDestinos()`.

## 4. Modelo de Dados

```ts
// docs/tipos.ts
type Situacao = 'nova' | 'alterada' | 'removida' | 'igual';
interface NoArvore { titulo: string; pasta?: string; endereco?: string; filhos: NoArvore[]; situacao?: Situacao; erro?: boolean }
interface BlocoPasso { palavra: string; html: string; tabela?: TabelaDoc; docString?: string }
interface TabelaDoc { cabecalho: string[]; linhas: string[][] /* HTML seguro por célula */; tipo: 'definicao' | 'exemplo' | 'outra' }
interface FilhoDoc {
  posicao: number; tipo: 'Contexto' | 'Cenário' | 'Esquema'; titulo: string; ancora: string; // c-{posicao}
  tags: string[]; descricaoHtml: string; passos: BlocoPasso[]; exemplos: TabelaDoc[];
  codigo?: string; usadaEm?: { endereco: string; titulo: string; posicao: number; cenario: string }[];
  situacao?: Situacao; diffHtml?: string;
}
interface PaginaDoc {
  endereco: string; arquivo: string; titulo: string; modulo: string; tipo?: string; fluxo?: string;
  narrativaHtml: string; filhos: FilhoDoc[]; removidos: { titulo: string; html: string }[];
  prototipo?: { tela: string; estados: { id: string; rotulo: string; href: string }[]; png?: string; anterior?: { href: string } };
  citadas: { codigo: string; endereco: string; titulo: string }[]; // regras/mensagens citadas (telas)
  fonte: string; // texto bruto do .feature
  situacao?: Situacao; erroSintaxe?: { linha?: number; mensagem: string };
}
interface Documentacao {
  projeto: { nome: string; versao: string; orgao: string; logo?: string };
  arvore: NoArvore[]; paginas: PaginaDoc[]; matriz: { telas: string[]; codigos: string[]; marcas: [number, number][] };
  achados: Achado[]; comparacao?: { versao: string; novas: string[]; alteradas: string[]; removidas: string[] };
  busca: DocBusca[];
}
interface DocBusca { id: string; tipo: 'funcionalidade' | 'cenario' | 'regra' | 'lista' | 'mensagem' | 'email'; titulo: string; caminho: string /* rótulo do pai */; texto: string; destino: string /* rota nova */ }
```

## 5. Contratos

### 5.1 Motor

```ts
modeloDaDocumentacao(p: Preparado, o?: { anterior?: Preparado; rotuloAnterior?: string }): Documentacao
gerarDocumentacao(specs: string, o: { projeto?: string; saida?: string; arquivoUnico?: boolean; comparar?: string | false; estrito?: boolean }): Promise<ResultadoDocs>
gerarPdf(specs: string, o: { saida: string; recorte?: Recorte; orientacao?: 'retrato' | 'paisagem'; soMudancas?: boolean; comparar?: string; navegador?: Navegador }): Promise<{ arquivo: string; paginas: number }>
servir(specs: string, o: { porta?: number; comparar?: string }): Promise<{ url: string; parar(): Promise<void> }>
prepararVersaoAnterior(specs: string, valor: string): Promise<{ preparado: Preparado; rotulo: string; limpar(): Promise<void> }>
renderizarMarkdown(md: string, o: { linkDe(l: LinkCitado): string }): string
paginasDosDestinos(pdf: Uint8Array): Map<string, number>
```

### 5.2 CLI (novos comandos)

```
prumo docs    [--specs] [--projeto] [--saida <pasta>] [--arquivo-unico | --pasta] [--comparar <pasta|ref> | --sem-comparar] [--estrito]
prumo pdf     [--specs] [--projeto] --saida <arquivo.pdf> [--modulo …] [--tela …] [--orientacao retrato|paisagem] [--comparar …] [--so-mudancas]
prumo servir  [--specs] [--projeto] [--porta 4300] [--comparar …]
```
Códigos de saída como na 0001; `docs --estrito` sai com 1 se a verificação tiver erros.

### 5.3 Rotas no navegador (RN-51)

| Fragmento | Destino (modo pasta) |
|---|---|
| `#/scenario/{end}/{n}`, `#!/scenario/{end}/{n}`, `#!/f/{end}/c/{n}` | `f/{end}.html#c-{n}` |
| `#/feature/{end}`, `#!/feature/{end}`, `#!/f/{end}` | `f/{end}.html` |
| `#!/feature/{end}/{termo}` | `f/{end}.html#busca={termo}` |
| `#!/busca/{termo}` | resultados da busca na própria `index.html` |
| `#!/matriz`, `#!/mudancas` | `matriz.html`, `mudancas.html` |
| outro | "Não encontrado" com sugestão |

`{end}` é decodificado (`decodeURIComponent`) e normalizado em NFC antes da busca no mapa
`endereco → arquivo` (gravado no `index.html` como JSON). Arquivos `f/*.html` usam um nome
ASCII seguro (`slug` + hash curto) para não depender de acentos no sistema de arquivos e nas URLs.
No arquivo único as mesmas rotas mostram o `<template>` correspondente.

## 6. Arquitetura da Solução

```
packages/motor/src/docs/
  tipos.ts
  markdown.ts        # markdown-it (html:true, linkify:false) + sanitização por lista branca (RN-54); reescreve links #/scenario e #!/feature para rotas novas preservando o href antigo em data-rota
  modelo.ts          # Preparado → Documentacao: árvore, páginas, tabelas, "usada em", matriz, busca
  comparar.ts        # pareamento (RN-63), diffWordsWithSpace (RN-64), situação por página/filho, renomeações
  anterior.ts        # pasta ou ref: git rev-parse/ls-tree/show → pasta temporária (RN-62)
  gerar.ts           # grava site (pasta | único), recursos, índice de busca, .prumo-arquivos (RN-50)
  embutir.ts         # arquivo único: data URIs de imagens/fontes, templates de protótipos
  pdf.ts             # página de impressão, 2 passadas, /Dests (pdf-lib), rodapé "página X de Y"
  servir.ts          # http + SSE + chokidar (debounce 300 ms), regenera e avisa
packages/motor/kits/docs/
  base.njk  inicio.njk  funcionalidade.njk  matriz.njk  mudancas.njk  impressao.njk  macros.njk  estilo.css  impressao.css
packages/motor/web/        # cliente do navegador (TS → esbuild → kits/docs/prumo-docs.js, versionado)
  rotas.ts  busca.ts  previa.ts  prototipo.ts  copiar.ts  contraste.ts  principal.ts
```

**Fluxo de `prumo docs`.** `preparar()` → (se `comparar`) `prepararVersaoAnterior()` →
`gerarPrototipos()` em `<saida>/prototipos` (e `<saida>/prototipos-anterior` para telas alteradas) →
`modeloDaDocumentacao()` → `gerarDocumentacao()` (pasta ou único) → resumo DOC-01/DOC-06.

**Arquivo único (RN-55, RN-56).** O `index.html` contém:
- o CSS da documentação inline e o JS inline;
- o índice de busca num `<script type="application/json">`;
- uma `<template id="f-{hash}">` por página;
- uma `<template id="p-{tela}-{estado}">` por página de protótipo, com o `<link>` do CSS trocado por `<!--CSS-->`;
- uma `<template id="css-prototipos">`, com o CSS dos protótipos e as fontes em `data:`;
- os PNGs e o logo em `data:`.

Ao abrir um protótipo, o cliente monta o HTML (troca `<!--CSS-->` pelo `<style>`), cria um `blob:` e
o coloca no `iframe`. Os links entre telas dentro do protótipo (`../../mod/tela/estado.html`) são
reescritos no build para `#prumo-prototipo={tela}/{estado}`; o `iframe` avisa a página-mãe por
`postMessage`, e ela troca o estado.

**Erros.** Pasta de saída fora do permitido → `ErroPrumo`. Referência do Git inexistente → `ErroPrumo('DOC-07')`
(FA-15). Git ausente com `--comparar <ref>` → `ErroPrumo('DOC-08')`. Arquivo com erro de sintaxe → página com o
erro (FA-11), sem interromper.

## 7. Integrações Externas

| Fronteira | Adaptador | Teste |
|---|---|---|
| Git (só com `--comparar <ref>`) | `node:child_process.execFile('git', …)` com `cwd` = specs, argumentos sem shell | Repositório Git real criado em pasta temporária no teste |
| Chromium (PDF, testes) | `NavegadorPlaywright.pdf` (já existe) | Chromium real; `PRUMO_EXIGIR_NAVEGADOR` no CI |
| Sistema de arquivos (vigiar) | `chokidar` 6 | Teste de integração do `servir` com escrita real e espera do evento SSE |

## 8. Eventos / Jobs

`servir`: vigia `**/*.feature`, `projeto.yml`, `telas.overrides.yml` e imagens; debounce de 300 ms;
uma regeneração por vez (as mudanças que chegam durante uma regeneração disparam só mais uma);
manda `event: recarregar` por SSE às páginas abertas.

## 9. Cache e Performance

- **Busca:** índice MiniSearch serializado (`toJSON`) no build e carregado com `loadJSON`, sem reindexar no
  navegador. Campos `titulo` (peso 3), `texto`, `caminho`. `processTerm` tira os acentos e passa para
  minúsculas. Opções: `prefix: true` e `fuzzy: termo.length >= 5 ? 0.2 : 0`. O atalho de código
  (`/^(rng|lov|msg|e-?mail)\s*-?\s*\d+$/i`) vai direto ao item, sem passar pelo índice.
- **Meta de desempenho:** consulta < 200 ms. Medição prevista num teste com 5× o tamanho do piloto, sintético.
- **Geração:** páginas renderizadas uma vez; `gravarSeMudou` evita reescrever; o JS do cliente é pré-compilado e versionado.
- **PDF:** duas renderizações da mesma página de impressão (a segunda só muda os números, que já têm largura fixa: 4 dígitos com `font-variant-numeric: tabular-nums`).

## 10. Segurança e LGPD

- **Markdown** (RN-54): markdown-it com `html: true`. Os tokens de Markdown passam como estão (o markdown-it
  já escapa o texto); os tokens de HTML bruto (`html_inline`, `html_block`) passam por um sanitizador próprio,
  sem dependência nova, que mantém só as tags e os atributos da lista branca e escapa o resto. URLs de `href` e
  `src` são validadas depois da renderização. Testado contra `script`, `on*`, `javascript:`, `data:text/html`,
  `style` e `iframe`.
- **CSP** das páginas:
  - documentação: `default-src 'self'; script-src 'self' 'unsafe-inline'` (necessário no arquivo único);
    `img-src 'self' data: blob:`; `frame-src 'self' blob:`; `style-src 'self' 'unsafe-inline'`; `font-src 'self' data:`.
  - protótipo montado no `blob:`: `default-src 'none'` + `style-src 'unsafe-inline'` + `font-src data:` + `img-src data:`.
- **Saída:** `servir` só em `127.0.0.1` e só serve arquivos dentro da pasta gerada (`dentroDe`); nada de listagem de diretório.
- **Git:** `git` é chamado com `execFile` e argumentos separados, sem shell. A referência é validada
  (`git rev-parse --verify <ref>^{commit}`) antes de qualquer `show`.
- **Limpeza da saída** (RN-50): só remove o que está em `.prumo-arquivos`.

## 11. Frontend (documentação)

| Elemento | `id` / âncora | `data-testid` | ARIA / teclado |
|---|---|---|---|
| Busca | `busca` | `docs-busca` | `role="combobox"`, `aria-controls="busca-resultados"`, `aria-expanded`, `aria-activedescendant`; `/` e `Ctrl+K` focam; ↑↓ Enter Esc |
| Resultados | `busca-resultados` | `docs-busca-resultados` | `role="listbox"`, opções `role="option"`; contagem em `aria-live="polite"` |
| Menu | — | `docs-menu` | `nav aria-label="Funcionalidades"`, pastas como `button aria-expanded`, `aria-current="page"` |
| Situação no menu | — | `docs-menu-situacao-{end}` | Texto "nova"/"alterada" visível ou `sr-only`, nunca só ícone |
| Cenário | `c-{posicao}` | `docs-cenario-{posicao}` | `section aria-labelledby`; `h2`/`h3` em ordem |
| Copiar link | — | `docs-copiar-{posicao}` | `button` com `aria-label="Copiar link do cenário {título}"`; confirmação em `aria-live` |
| Prévia | `previa` | `docs-previa` | `<dialog>` com `aria-labelledby`; Esc fecha; foco volta ao link |
| Protótipo | — | `docs-prototipo`, `docs-prototipo-estado-{id}` | `iframe title="Protótipo: {tela} — {estado}"`; estados em grupo de `button aria-pressed`; zoom em `button` com rótulo |
| Mudanças | — | `docs-mudancas-*` | `<ins>`/`<del>` com texto oculto "incluído:"/"excluído:" |
| Alto contraste | — | `docs-contraste` | `button aria-pressed`; preferência em `localStorage` |
| Pular para o conteúdo | — | `docs-pular` | primeiro foco da página |

Tabelas: `<table>` dentro de `<div class="tabela" role="region" aria-label="{legenda}" tabindex="0">` para
rolar no teclado. Celular: menu vira `<details>`/botão; texto sem rolagem horizontal a 390 px.

## 12. Estratégia de Testes desta Feature

- **Integração do motor** sobre o exemplo fictício e as fábricas:
  - modelo da documentação, gravação nos dois modos, limpeza segura, comparação com pasta e com
    repositório Git real em pasta temporária, PDF com `/Dests` e número de páginas.
  - sem mock de módulos internos; o Git e o Chromium são reais.
- **Unitários:** sanitização de Markdown (CT-U13 da 0001 entra aqui), reescrita de links, rotas (tabela da 5.3),
  pareamento e diff, `paginasDosDestinos`, atalho de código da busca.
- **Navegador (Chromium real, `file://`):**
  - todo link do exemplo abre o destino certo, nos formatos antigo e novo;
  - prévia (abre, Esc, devolve o foco);
  - busca: acento, prefixo, erro de digitação, código, teclado, e < 200 ms no índice 5× maior;
  - protótipo embutido nos dois modos, com troca de estado;
  - axe em todas as páginas da documentação, incluindo a 390 px;
  - "Copiar link".
- **CLI:** `docs`, `pdf`, `servir` (inicia, responde em `/saude`, recarrega ao salvar e para) e erros de uso.
- **Piloto (local, não versionado; teste opcional com `PRUMO_PILOTO=<pasta>`):**
  - todos os links das features do Vale-Cultura resolvem;
  - toda funcionalidade, cenário e tabela do `html/index.html` do Pirilampo aparece na documentação
    gerada (lista extraída do HTML antigo), atendendo à RN-53 e ao critério §8.4;
  - busca medida com a especificação real.
- **Massa de dados:**
  - fábrica de especificação grande, 5× o piloto em funcionalidades e cenários;
  - fábrica de repositório Git com duas versões (nova, alterada, removida e renomeada).

## 13. Arquivos a Criar / Alterar

Criar: `packages/motor/src/docs/*`, `packages/motor/kits/docs/*`, `packages/motor/web/*`, `packages/motor/scripts/web.mjs`
(esbuild), testes em `packages/motor/test/{unit,integracao}/docs-*.test.ts`, fábricas `especificacao-grande.ts` e `repositorio-git.ts`.
Alterar: `executar.ts` e `index.ts` (exportar `gerarDocumentacao`, `gerarPdf`, `servir`), `apps/cli/src/main.ts` (3 comandos),
`config/esquema.ts` (`documentacao.saida`, `comparar_com`), `package.json` do motor (dependências e script `build:web`),
`README.md`, `specs/COMPONENTS.md`. O CI não muda: o repositório Git do teste de comparação é criado pelo próprio teste.

Dependências novas (exatas): `minisearch@7.2.0`, `diff@9.0.0`, `pdf-lib@1.17.1`, `chokidar@6.0.0`; dev: `esbuild@0.28.2`.

## 14. Ordem de Execução Recomendada

1. `markdown.ts` + testes de sanitização e reescrita de links.
2. `modelo.ts` (árvore, páginas, usada em, matriz, busca) + integração no exemplo.
3. Kit `docs` e `gerar.ts` no modo pasta; cliente `web/` (rotas, prévia, copiar, contraste); testes de links no navegador.
4. Busca (índice e cliente) + medição de desempenho com a fábrica grande.
5. Protótipo embutido (modo pasta) e arquivo único (`embutir.ts`) + testes nos dois modos.
6. `anterior.ts` + `comparar.ts` + menu/faixas/"O que mudou" + testes com repositório Git.
7. `pdf.ts` (impressão, 2 passadas, rodapé) + testes.
8. `servir.ts` + CLI + CI.
9. Piloto: links, equivalência com o Pirilampo, busca real; relatório.

## 15. Riscos Identificados

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Firefox trata `file://` e `blob:` de forma diferente do Chromium (arquivo único) | Média | Médio | Modo pasta é o recomendado; testar o único no Firefox manualmente e documentar; o conteúdo continua legível sem o protótipo |
| `printToPDF` não repete o cabeçalho da tabela entre páginas | Baixa | Médio | `thead { display: table-header-group }` (suportado no Chromium); teste visual do PDF |
| Tabelas muito largas no PDF retrato | Alta | Baixo | Redução de fonte por tabela (`--fonte-tabela` calculado pelo número de colunas) e, acima de 8 colunas, a página daquela funcionalidade sai em paisagem (`@page :named`) |
| Arquivo único grande (PNGs + protótipos) | Média | Baixo | Aviso acima de 50 MB (FA-13); PNG não é embutido quando o protótipo HTML existe, a não ser no PDF |
| Rotas antigas com acento em forma NFD (links copiados no macOS) | Baixa | Médio | Normalização NFC dos dois lados (RN-51) |
| Pareamento por título falha quando o analista renomeia o cenário | Média | Baixo | Aparece como removido + novo; aceitável e honesto; renomeação de arquivo detectada por semelhança (RN-63) |

## 16. Pesquisa Realizada

- Saída do Pirilampo do piloto:
  - rotas `$routeProvider` `/feature/:feature/:search*?`, `/scenario/:feature/:scenarioid`, `/html/:html`;
  - prévia de cenário em modal, com "Acessar Feature";
  - busca por expressão regular sobre frases;
  - comparação com `master` (templates `master_*`, `prettyTextDiff`, situações `NEW`/`DIFFERENT`/`NOT_COMPARED`);
  - a geração atual está como `NOT_COMPARED`.
- Sondagens nesta máquina:
  - `/Dests` no PDF do Chromium, resolvido com `pdf-lib` (seção 1);
  - `iframe` por `blob:` a partir de `file://`, com e sem CSS por outro `blob:` (seção 1).
- npm (2026-11-04): `minisearch` 7.2.0 (MIT, com tipos), `diff` 9.0.0 (BSD-3, com tipos), `pdf-lib` 1.17.1 (MIT),
  `chokidar` 6.0.0 (MIT), `esbuild` 0.28.2 (MIT).
