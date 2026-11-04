# 0002 — Relatório de Testes

**Autor:** arc-tester · **Data:** 2026-11-04 · **Suíte:** ✅ 150 testes passando, 3 pulados (piloto, opcional); Windows 11 + Edge 156

## 1. Resumo da Estratégia

Igual à 0001:
- pipeline real do motor sobre cópias do exemplo em pasta temporária;
- Git real (repositório criado no teste);
- Chromium real abrindo as páginas por `file://`, com a rede bloqueada;
- CLI pelo processo real.

O piloto foi testado com `PRUMO_PILOTO` apontando para a pasta no WSL.

## 2. Testes Implementados (0002)

| Arquivo | Testes |
|---|---|
| `packages/motor/test/docs/markdown.test.ts` | 6 |
| `packages/motor/test/docs/unidades.test.ts` | 12 |
| `packages/motor/test/docs/integracao.test.ts` | 16 |
| `packages/motor/test/docs/navegador.test.ts` | 18 |
| `packages/motor/test/docs/servir.test.ts` | 3 |
| `packages/motor/test/docs/piloto.test.ts` | 3 (opcional) |
| `apps/cli/test/docs.test.ts` | 6 |
| Fábricas: `repositorio-git.ts`, `especificacao-grande.ts` | — |

## 3. Mapeamento Cenário → Teste

| Cenário | Teste |
|---|---|
| CT-I01–CT-I07, CT-I19 | integracao › documentação em pasta (8) |
| CT-I08 | integracao › arquivo único (2) |
| CT-I09 | integracao › limpeza segura |
| CT-I10–CT-I13 | integracao › comparação (3) |
| CT-I14 | unidades › comparação (diff por palavra, realinhamento) |
| CT-I15, CT-I16, CT-U06 | navegador › PDF (3) |
| CT-I17, CT-I18 | integracao › determinismo e identidade |
| CT-U01, CT-U02 | markdown.test |
| CT-U03–CT-U05, CT-U07, CT-U08 | unidades.test |
| CT-P01, CT-P02 | navegador › links antigos e novos (3) |
| CT-P03, CT-P04, CT-P07, CT-P08 | navegador › prévia, copiar e protótipo (4) |
| CT-P05, CT-P06 | navegador › busca (2) |
| CT-P09, CT-P10, CT-P13, CT-P15 | navegador › comparação, matriz, sem JS, contraste (4) |
| CT-P11, CT-P12, CT-P14 | navegador › acessibilidade e teclado (2) |
| CT-C01–CT-C07 | cli › docs.test (6) |
| CT-E01 | Coberto pela soma de CT-P01, P03, P04 e P05 |
| CT-E02 | cli › servir + servir.test (edição do `.feature` → evento → conteúdo novo) |
| CT-E03 | piloto.test (3), rodado com `PRUMO_PILOTO` |

## 4. Cobertura Atingida

`npm run cobertura` (v8, motor): **96,2% das linhas**, **80,35% dos ramos** (metas: 85% e 80%).

| Módulo | Linhas |
|---|---|
| `docs/markdown.ts` | 98,7% |
| `docs/comparar.ts` | 96,8% |

O cliente `web/` é coberto pelos testes de navegador e tem os tipos conferidos por `npm run tipos`.

## 5. Cenários Adicionais Cobertos

- PDF em paisagem, recorte por tela capturando o PNG que falta, e recorte vazio (DOC-11).
- Arquivo único com `css_adicional` (`@import` removido, fontes em `data:`) e sem logo.
- `servir`:
  - bloqueia `..` cru e codificado (404);
  - URL malformada dá 400;
  - porta ocupada dá DOC-05;
  - erro na regeneração é repassado e o servidor continua.
- Docker: `docs` e `pdf` no exemplo dentro da imagem (manual, e agora também no job `docker` do CI).
- **Piloto:**
  - equivalência com o Pirilampo nas 44 funcionalidades;
  - todos os links resolvem;
  - busca abaixo de 200 ms;
  - axe sem violações nas páginas do exemplo, a 1440 e a 390 px.

## 6. Bugs Encontrados Durante Teste

| # | Bug | Correção |
|---|---|---|
| 1 | Rota antiga gravada com `%C3%B3` em `data-rota` | Decodificada ao gravar |
| 2 | Totais da verificação errados (`selectattr` com comparação não existe no Nunjucks) | Totais calculados no TS |
| 3 | Achado de arquivo com erro de sintaxe quebrava o modelo | Guarda contra página sem arquivo |
| 4 | Limpeza não removia protótipos antigos (listava o que estava na pasta) | Registra só os arquivos gerados na execução |
| 5 | Comparação por Git falhava com o nome curto do Windows | `rev-parse --show-prefix` |
| 6 | Busca sem contorno de foco visível | Contorno de 3 px por fora |
| 7 | A 390 px a página esticava para 1180 px | `minmax(0, 1fr)` |
| 8 | Arquivo único de 10,2 MB (logo repetido 121 vezes) | Recursos compartilhados: 2,9 MB |

## 7. Comandos

```bash
npm test
```

```bash
npm run cobertura
```

```bash
PRUMO_PILOTO="<pasta Especificações>" npx vitest run packages/motor/test/docs/piloto.test.ts
```

## 8. Observações para o arc-lider

- Nenhum teste simula módulos internos do motor.
- O Git e o Chromium usados nos testes são os reais.
- Firefox ficou fora: não está instalado aqui.
