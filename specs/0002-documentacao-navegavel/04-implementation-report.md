# 0002 — Relatório de Implementação

**Autor:** arc-dev · **Data:** 2026-11-04 · **Status:** ✅ Completo

## 1. Resumo

A documentação navegável está implementada como mais uma saída do motor, conforme o desenho:
`prumo docs` (site em pasta ou arquivo único), `prumo pdf` e `prumo servir`.

| Recurso | Como ficou |
|---|---|
| Rotas antigas do Pirilampo | Todas abrem o destino certo |
| Protótipo | Embutido e clicável, com estados e zoom |
| Prévia de regra | Janela com retorno do foco |
| "Copiar link" | Endereço novo por cenário |
| Busca | MiniSearch com índice pré-gerado |
| Rastreabilidade | "Usada em" em cada referência e a Matriz |
| Comparação | Com pasta ou referência do Git, incluindo a página "O que mudou" |
| PDF | Sumário numerado pelas páginas reais |

Piloto (Vale-Cultura, no WSL, saída local fora do repositório):

| Medida | Resultado |
|---|---|
| Conteúdo | 44 funcionalidades, 389 cenários, 147 referências |
| `docs` (pasta) | 4,1 s, 9,1 MB com os 121 protótipos e os PNGs |
| Arquivo único | 2,9 MB (o `index.html` do Pirilampo tem 9 MB) |
| Equivalência com o Pirilampo | As 44 funcionalidades, os mesmos cenários pela posição e pelo menos as mesmas tabelas |
| Links | Todos os das features abrem o destino certo |
| Busca | 95º percentil < 200 ms |

## 2. Arquivos Criados

| Caminho | Conteúdo |
|---|---|
| `packages/motor/src/docs/tipos.ts` | Modelo da documentação |
| `packages/motor/src/docs/markdown.ts` | markdown-it com lista branca (RN-54), reescrita de links do Pirilampo e de imagens |
| `packages/motor/src/docs/modelo.ts` | Preparado → Documentacao: árvore, páginas, "usada em", prévias, busca, Matriz, rotas; `lerRotaAntiga`, `arquivoDaPagina` |
| `packages/motor/src/docs/comparar.ts` | Pareamento por título, diff por palavra, renomeação por semelhança |
| `packages/motor/src/docs/anterior.ts` | Versão anterior por pasta ou `git show` (sem checkout) |
| `packages/motor/src/docs/gerar.ts` | Gravação nos dois modos, recursos, índice de busca, limpeza segura (`.prumo-arquivos`) |
| `packages/motor/src/docs/pdf.ts` | Página de impressão, 2 passadas, `/Dests` via pdf-lib, captura do PNG que falta |
| `packages/motor/src/docs/servir.ts` | HTTP em 127.0.0.1 + SSE + chokidar |
| `packages/motor/src/docs/busca-config.ts` | Opções do índice compartilhadas pelo Node e pelo navegador |
| `packages/motor/kits/docs/*` | `base`, `macros`, funcionalidade, início, Matriz, "O que mudou", impressão; `estilo.css`, `impressao.css` |
| `packages/motor/web/*` | Cliente: rotas, busca, prévia, protótipo, copiar, contraste, Matriz (`principal.ts`, `rotas.ts`, `texto.ts`) |
| `packages/motor/scripts/web.mjs` | Empacota o cliente com esbuild em `kits/docs/prumo-docs.js` (gerado, fora do Git) |
| `packages/motor/kits/proprio/prumo-prototipo.js` | Ponte do protótipo embutido: altura e navegação entre telas |

## 3. Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `parser/tipos.ts`, `parser/ler.ts` | `fonte` (texto do arquivo) |
| `kits/proprio/base.njk` e `render/recursos.ts` | Script da ponte do protótipo |
| `navegador/*` | Rodapé no PDF |
| `index.ts` | Exportações novas |
| `apps/cli/src/main.ts` | Comandos `docs`, `pdf` e `servir` |
| `package.json` (raiz e motor) | Dependências e scripts `build:web` e `tipos` com o cliente |
| `.gitignore` | Ignora o script empacotado |
| `.github/workflows/ci.yml` | `docs` e `pdf` na imagem Docker |

## 4. Migrations

Não se aplica.

## 5. Reutilização Aplicada

`preparar`, `verificarPreparado`, `gerarPrototipos`, `cssDosTokens` e as fontes embutidas,
`extrairLinks`, `chaveCodigo`, `NavegadorPlaywright`, `gravarSeMudou`, `dentroDe`, `slug`, `textoPuro`, `hash32`.

## 6. IDs e Acessibilidade

| Elemento | Atributos |
|---|---|
| Busca | `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `aria-controls`; resultados em `role="listbox"`; contagem em `aria-live` |
| Prévia | `<dialog>` nativo com `aria-labelledby`; foco devolvido ao link |
| Menu | `<details>`/`<summary>` (funciona sem JS) e `aria-current="page"` |
| Protótipo | Estados e zoom em `button aria-pressed`; `iframe` com `title` |
| Mudanças | `<ins>`/`<del>` com texto oculto |
| Tabelas | Dentro de `role="region"` com rótulo e `tabindex="0"` |
| Página | "Pular para o conteúdo" é o 1º foco |

`data-testid` conforme a tabela da seção 11 do desenho.

## 7. Variáveis de Ambiente Novas

`PRUMO_PILOTO` e `PRUMO_PILOTO_PIRILAMPO`, só para o teste opcional do piloto.

## 8. Comandos

```bash
node apps/cli/dist/main.js docs --specs "<specs>" [--arquivo-unico] [--comparar v1]
```

```bash
node apps/cli/dist/main.js pdf --specs "<specs>" --saida especificacao.pdf [--modulo 01_Portal] [--orientacao paisagem]
```

```bash
node apps/cli/dist/main.js servir --specs "<specs>" [--porta 4300]
```

## 9. Decisões Durante Implementação

- **Imagens do protótipo no arquivo único.**
  - Logo e brasão ficam uma vez só em `dados.recursosPrototipo` e são trocados na hora de abrir. Antes, o logo
    entrava em cada uma das 121 páginas: o arquivo do piloto caiu de 10,2 MB para 2,9 MB.
  - O PNG do `@prototipo` não é embutido quando a tela tem o protótipo interativo; no PDF continua.
- **Páginas de protótipo no arquivo único são strings JSON, não `<template>`.** O `<template>` descarta
  `<html>`/`<head>` e o doctype, e o iframe abriria em modo quirks.
- **Prefixo do Git com `rev-parse --show-prefix`.** Calcular o caminho no Node falhava com o nome curto do Windows (`VINICI~1`).
- **Gancho `window.prumoBuscar`** para medir a busca nos testes de desempenho.
- **`selectattr` com comparação não existe no Nunjucks:** os totais da verificação vêm prontos do TS.
- **Grade da documentação no celular com `minmax(0, 1fr)`.** Com `1fr`, a página esticava para 1180 px a 390 px.
- **Foco do campo de busca com contorno amarelo por fora, sobre a barra escura.** A borda amarela sobre o branco tinha pouco contraste.

## 10. Pendências e Débitos Técnicos

- Firefox não testado nesta máquina (sem navegador). O modo pasta é o recomendado; o arquivo único usa `blob:` e precisa de verificação manual no Firefox.
- A ajuda da CLI ainda mostra "Usage/Options/default" do commander em inglês; as descrições estão em português.
- O texto "página X de Y" do rodapé do PDF foi conferido com `pdftotext` (em container), não por teste automatizado. O número de páginas do sumário é testado.

## 11. Observações para o arc-tester

- Testes de navegador abrem por `file://` com bloqueio de rede.
- O teste do piloto só roda com `PRUMO_PILOTO` e nunca entra em fixture.

## 12. Bloqueios Encontrados

Nenhum.
