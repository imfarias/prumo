# 0003 — Relatório de Testes

**Autor:** arc-tester · **Data:** 2026-11-04 · **Status:** ✅ Completo

## 1. Resumo da Estratégia

| Camada | Ferramenta | Onde |
|---|---|---|
| Motor | vitest, como na 0001 e na 0002 | `packages/motor/test/{unit,integracao}` |
| Principal sem Electron | vitest em Node; `electron` substituído por um módulo mínimo só na fila | `apps/desktop/test/unit` |
| `NavegadorElectron` | Roteiro empacotado pelo esbuild e rodado pelo próprio `electron`, que grava o resultado em JSON | `apps/desktop/test/electron` |
| E2E | `playwright-core` `_electron` sobre o `dist/`, com diálogos de resposta fixa, editor falso e release falsa | `apps/desktop/test/e2e` |
| Instaladores | PowerShell e bash no CI, em máquinas limpas | `apps/desktop/scripts/testar-instaladores.*` |

Resultado local (Windows 11): `npm run tipos` ok. `npm run cobertura`: 25 arquivos e 201 testes, com 198 passando e 3 pulados. Os pulados são os da 0002 que dependem de Firefox ou do piloto.

## 2. Testes Implementados (0003)

| Arquivo | Testes |
|---|---|
| `packages/motor/test/unit/editar.test.ts` | 5 (CT-I01, CT-I02) |
| `packages/motor/test/integracao/execucao.test.ts` | 4 (CT-I03 a CT-I07) |
| `apps/desktop/test/unit/principal.test.ts` | 13 (CT-M01 a CT-M04) |
| `apps/desktop/test/unit/sistema.test.ts` | 4 (editor real, registro do Windows, todos os canais) |
| `apps/desktop/test/unit/fila.test.ts` | 4 (CT-M05) |
| `apps/desktop/test/electron/navegador.test.ts` | 5 (CT-N01 a CT-N05) |
| `apps/desktop/test/e2e/programa.test.ts` | 14 (CT-E01 a CT-E16) |

## 3. Mapeamento Cenário → Teste

| Cenário | Teste | Situação |
|---|---|---|
| CT-I01 a CT-I07 | `editar.test.ts`, `execucao.test.ts` | ✅ |
| CT-M01 Canais | `principal.test.ts` + `sistema.test.ts` ("todos os canais") | ✅ |
| CT-M02 Preferências | `principal.test.ts` (corrompidas, 10 recentes, sem `.tmp`) | ✅ |
| CT-M03 Atualização | `principal.test.ts` contra `servirRelease` (maior, igual, prévia, SHA errado, sem somas, HTTP 503, sem rede, http externo) | ✅ |
| CT-M04 Editor | `principal.test.ts` + `sistema.test.ts` (processo real e executável inexistente) | ✅ |
| CT-M05 Fila | `fila.test.ts` (uma por vez, cancelar, DSK-12 e DSK-14, DSK-11) | ✅ |
| CT-N01 Captura | 7 PNGs a 1440 px, ≤ tolerância contra a referência, sem rede | ✅ |
| CT-N02 Página alta | 12.000 px inteira, com o bloco do fim | ✅ |
| CT-N03 PDF | Sumário = `/Dests` | ✅ |
| CT-N04 axe | `button-name` e `image-alt` apontados | ✅ |
| CT-N05 Rede | `https://` bloqueado e registrado | ✅ |
| CT-E01 Abrir | Mensagem DSK-02 e recente gravado | ✅ |
| CT-E02 Configuração | Ctrl+S; 2 linhas mudadas, comentários iguais, contraste mostrado | ✅ |
| CT-E03 Achado no editor | Link plantado → `03_Portal_Contato.feature:28` no editor falso | ✅ |
| CT-E04 PNG do módulo | 3 PNGs, andamento, painel com sinais | ✅ |
| CT-E05 Override | Diff, uma linha mudada, comentário mantido | ✅ |
| CT-E06 Documentação e PDF | Pasta, "Ver aqui", arquivo único, PDF fora do projeto pelo "Salvar como" | ✅ |
| CT-E07 Comparar | Pasta (1 nova, 1 alterada, 1 removida; abrir a alterada mostra o dado novo) e tag `v1` (branch e árvore intactas) | ✅ |
| CT-E08 Cancelar | Especificação 5× o piloto; "Cancelado", sem `.tmp` | ✅ |
| CT-E09 Prévia ao vivo | Link quebrado salvo fora do programa → "1 erro" no topo em ≤ 3 s | ✅ |
| CT-E10 Projeto novo | Criado, aberto, 0 erros | ✅ |
| CT-E11 Mudança não salva | Confirmação; recusar mantém a tela | ✅ |
| CT-E12 Segunda instância | A janela aberta recebe a pasta; a segunda sai | ✅ |
| CT-E13 Segurança | Sem `require` e sem `process`; canal desconhecido recusado; `https://` não navega | ✅ |
| CT-E14 axe e teclado | Zero sérias ou críticas nas 7 telas; Tab, Shift+Tab, Enter; contorno de foco | ✅ |
| CT-E15 Atualização | Aviso da 99.0.0, download conferido, pergunta antes de instalar (recusada no teste), "Lembrar depois" = 7 dias | ✅ |
| CT-E16 Sem rede | Desligada → nenhum pedido à release; janela só pede `file:`, `prumo-arquivo:`, `data:` e `blob:` | ✅ |
| CT-X01 a CT-X06 | `testar-instaladores.ps1` e `.sh` no job `instaladores` e no `release.yml` | ⏳ No CI do PR |

## 4. Cobertura Atingida

| Escopo | Linhas | Meta |
|---|---|---|
| Total medido | 96,5% | — |
| `comum/canais.ts` | 100% | 80% |
| `principal/atualizacao.ts` | 98,3% | 80% |
| `principal/editor.ts` | 93,8% | 80% |
| `principal/menu-contexto.ts` | 100% | 80% |
| `principal/preferencias.ts` | 100% | 80% |
| Motor | ≥ 85% linhas, ≥ 80% ramos (metas da 0001 mantidas) | 85% / 80% |

As telas e os módulos com Electron (`ipc`, `main`, `servicos`, `navegador-electron`, `protocolo`, `seguranca`) são cobertos pelos testes no Electron e pelo E2E, como define o 03, seção 8.

## 5. Cenários Adicionais Cobertos
- Pacote empacotado (`win-unpacked`, com asar e fuses) passa no `--verificar-instalacao`.
- O build de produção não contém `PRUMO_TESTE_DIALOGOS` nem `PRUMO_EDITOR_TESTE` (conferido no `app.asar`).
- Piloto pelo programa: abrir, grade com 41 telas, documentação e PDF, sem erro na janela.

## 6. Bugs Encontrados Durante Teste

| Bug | Correção |
|---|---|
| O programa não abria: `await app.whenReady()` no nível do módulo ESM | `then` |
| Aviso de atualização e pasta inicial perdidos (evento antes dos ouvintes) | Fila no principal + `janela:pronta` |
| Em desenvolvimento, o caminho do próprio app era lido como "pasta para abrir" | Ignorar `app.getAppPath()` |
| `--verificar-instalacao` podia sair antes de gravar o resultado | `window-all-closed` não encerra nesse modo |
| Clique em "Gerar PDF" com a documentação ainda rodando era recusado (DSK-10) e o aviso sumia | Botões desativados enquanto há tarefa |
| "Ver aqui" com duas barras de rolagem | Moldura sem rolagem própria para a documentação |
| "Sobre" sem alinhamento | `dl` em grade |

## 7. Comandos

```bash
npm run cobertura
```

```bash
npx vitest run apps/desktop/test
```

## 8. Observações para o arc-lider
- Os testes de instaladores (CT-X) só rodam no CI. Nesta máquina foram feitos o build dos dois instaladores do Windows, a medição de tamanho e o `--verificar-instalacao` do pacote.
- O roteiro manual com leitor de tela (NVDA e Orca) não foi feito.
