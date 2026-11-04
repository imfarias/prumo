# 0001 — Relatório de Testes

**Autor:** arc-tester · **Data:** 2026-11-04 · **Suíte:** ✅ 89 testes passando (11 arquivos), Windows 11 + Edge 156

## 1. Resumo da Estratégia

Seguiu a seção 12 do desenho: integração do motor sobre arquivos reais em pasta temporária, sem mock
de módulos internos; unitários só para funções puras; CLI pelo processo real; páginas abertas no
Chromium real com axe-core; regressão visual contra os PNGs aprovados do exemplo. O piloto foi
exercitado manualmente (não pode virar fixture).

## 2. Testes Implementados

| Categoria | Arquivo | Testes |
|---|---|---|
| Unitário — documentos, máscaras, fictícios | `packages/motor/test/unit/documentos.test.ts` | 9 |
| Unitário — parser, links, códigos, tabelas | `packages/motor/test/unit/parser.test.ts` | 13 |
| Unitário — configuração, contraste, utilitários | `packages/motor/test/unit/config.test.ts` | 9 |
| Unitário — inferência, ações, mensagens | `packages/motor/test/unit/inferencia.test.ts` | 8 |
| Unitário — formatação dos achados | `packages/motor/test/unit/formatar.test.ts` | 3 |
| Unitário — versão do contrato | `packages/motor/test/unit/versao.test.ts` | 1 |
| Integração — verificação (limpa e plantada) | `packages/motor/test/integracao/verificacao.test.ts` | 4 |
| Integração — pipeline e inferência | `packages/motor/test/integracao/pipeline.test.ts` | 18 |
| Integração — identidade e recursos | `packages/motor/test/integracao/identidade.test.ts` | 2 |
| Páginas e captura (Chromium real) | `packages/motor/test/integracao/navegador.test.ts` | 11 |
| CLI (processo real) | `apps/cli/test/cli.test.ts` | 11 |
| Fábricas | `packages/motor/test/fabricas/{projeto,feature}.ts` | — |

## 3. Mapeamento Cenário → Teste

| Cenário | Teste |
|---|---|
| CT-I01, CT-I23 | pipeline › "gera telas.json, um HTML por estado e a navegação, em pasta com acento e espaço" |
| CT-I02 | pipeline › "listagem: filtros, Filtrar/Limpar…" |
| CT-I03–CT-I06 | pipeline › "formulário: obrigatórios, máscaras, LOV, confirmação, caixa, captcha e arquivos" |
| CT-I07 | pipeline › "estado de erro com MSG no campo citado" |
| CT-I08 | pipeline › "ação leva a outra tela, por título ou por link" |
| CT-I09, CT-I10 | pipeline › overrides (2 testes) |
| CT-I11, CT-I12 | pipeline › "Fax obrigatório muda só esse campo", "trocar a cor primária muda o CSS e não o HTML" |
| CT-I13, CT-I14 | pipeline › configuração (3 testes) |
| CT-I15, CT-I16 | verificacao › plantados (3) e limpo (1) |
| CT-I17–CT-I19 | pipeline › robustez e determinismo (3) |
| CT-I20 | navegador › "grava os PNGs ao lado das features, a 1440 px, e não regrava sem mudança" |
| CT-I21, CT-P08 | navegador › "fontes embutidas carregadas sem nenhuma requisição de rede" |
| CT-I22 | navegador › "comparar-png gera o relatório com % por tela" |
| CT-U01–CT-U04 | parser.test |
| CT-U05–CT-U07 | documentos.test |
| CT-U08, CT-U09 | config.test |
| CT-U10–CT-U12 | inferencia.test |
| CT-U13 | **Não aplicável nesta fase** — Markdown não é renderizado nos protótipos (ver 04, seção 9); vai para a 0002 |
| CT-P01, CT-P02 | navegador › "todo campo tem rótulo ligado e obrigatório com aria-required" |
| CT-P03 | navegador › "estado de erro: resumo role=alert…" |
| CT-P04 | navegador › "estado vazio com role=status" |
| CT-P05 | navegador › "teclado: Tab segue a ordem do documento e o foco é visível" |
| CT-P06 | navegador › "casca autenticada: item atual do menu" + pipeline › casca autenticada |
| CT-P07 | navegador › "axe sem violações sérias ou críticas em todas as telas e estados" |
| CT-P09 | navegador › "PNGs do exemplo batem com a referência aprovada" |
| CT-C01–CT-C08 | cli.test (11 testes) |
| CT-E01 | coberto por CT-I01 + CT-P* (navegação gerada e páginas abertas) |
| CT-E02 | Manual + CI: `docker run … capturar` no exemplo gravou 7 PNGs, verificação 0 erros (job `docker`) |
| CT-E03 | Manual no piloto (seção 5) |

## 4. Cobertura Atingida

`npm run cobertura` (v8, só `packages/motor/src`): **linhas 94,9%**, **ramos 80,5%** (metas 85% e 80%).
`inferencia/` 98% de linhas; `verificacao/verificar.ts` 98%. Menor: `navegador/playwright.ts` 72%
(ramos de `PRUMO_CHROMIUM` e `pdf`, exercitados pelo Docker e pela 0002).

## 5. Cenários Adicionais Cobertos

- Severidade configurável por código (`verificacao.severidades`).
- `--avisos-quebram`; largura fora do intervalo; `migrar-config` pela CLI.
- Sem rolagem horizontal a 1440 px em todas as páginas (pegou um bug real, seção 6).
- CSS adicional com `@import`, `url()` relativos, `data:` e `https:` ignorados.
- Avisos de fonte não embutida, contraste < 4,5:1, logo e CSS inexistentes, kit `govbr`.
- **Piloto (manual, 2026-11-04):** 121 páginas sem nenhuma violação axe; verificação 0 erros; `comparar-png` 41/41.
- **Docker vs Windows:** diferença de 0,28% a 0,73% nos PNGs do exemplo.

## 6. Bugs Encontrados Durante Teste

| # | Bug | Correção |
|---|---|---|
| 1 | Inputs de arquivo ocultos (`.sr`) alargavam a página para 1552 px | `.sr` com `left/top: 0`, `clip-path`, `li` posicionado |
| 2 | Erro do cenário "e-mails diferentes" ia para "E-mail" em vez de "Confirme o E-mail" | Campo citado primeiro no texto |
| 3 | Imagem Docker não compilava: `*.tsbuildinfo` locais entravam no contexto | `.dockerignore` |
| 4 | Consulta com um campo de leitura virava tabela de 8 linhas iguais | Tabela só com 2+ colunas |

Nenhum bug aberto.

## 7. Comandos para Rodar a Suite

```bash
npm test                 # build + vitest
npm run cobertura        # com cobertura e metas
PRUMO_EXIGIR_NAVEGADOR=1 npm test   # falha se não houver Chrome/Edge
```

## 8. Observações para o arc-lider (Revisão Final)

- Nenhum teste usa mock de módulo do motor; o único duplo possível (`Navegador`) não foi necessário.
- Seletores de teste por `data-testid`/`id`, nunca por texto visível (exceto conferência de mensagens).
- CI ainda não rodou (branch não enviada); o workflow roda Ubuntu e Windows.
