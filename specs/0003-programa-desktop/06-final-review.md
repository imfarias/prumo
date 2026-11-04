# 0003 — Revisão Final

**Autor:** arc-lider (Momento B) · **Data:** 2026-11-04

## Veredito: ⚠️ Aprovado com ressalvas

O programa cumpre a especificação nesta máquina e no piloto. As ressalvas:
- os testes de instalar e desinstalar (CT-X) e o E2E no Linux ainda não rodaram; rodam no CI do PR;
- o roteiro manual com NVDA e Orca não foi feito;
- os instaladores não são assinados, então o SmartScreen avisa (decisão do usuário, documentada);
- os instaladores do Linux estão temporariamente fora do CI e da release, a pedido do usuário. O `.deb` (97 MB) e o `.AppImage` (120 MB) são gerados, mas a instalação no CI falhou: o `apt` recebia um caminho relativo, o que o roteiro já corrige. Para reativar, voltar `ubuntu-latest` à matriz do job `instaladores` no `ci.yml` e no `release.yml`.

## 1. Aderência à Especificação

| Critério | Situação | Evidência |
|---|---|---|
| CA-01 Instala e desinstala em máquina limpa | ⏳ | `testar-instaladores.*` no CI; build local dos dois instaladores do Windows |
| CA-02 Menu, área de trabalho, ícone | ⏳ | Conferido pelo roteiro do CI |
| CA-03 Desinstalação limpa | ⏳ | Conferido pelo roteiro do CI (atalhos, chave, pasta) |
| CA-04 Configuração sem terminal, comentários mantidos | ✅ | CT-E02 |
| CA-05 Achado abre no editor na linha | ✅ | CT-E03, CT-M04 |
| CA-06 Protótipos, documentação e PDF com andamento e cancelamento | ✅ | CT-E04, CT-E06, CT-E08, CT-M05 |
| CA-07 Comparar com pasta e com tag | ✅ | CT-E07 (os dois) |
| CA-08 PNGs equivalentes aos da CLI, sem navegador instalado | ✅ | CT-N01 (referência da 0001, mesma tolerância) |
| CA-09 Prévia ao vivo ≤ 3 s | ✅ | CT-E09 |
| CA-10 Sinais e override com diff | ✅ | CT-E04, CT-E05 |
| CA-11 Projeto novo sem erros | ✅ | CT-E10, CT-I03 |
| CA-12 Atualização | ✅ | CT-M03, CT-E15 |
| CA-13 Única conexão é a atualização | ✅ | CT-E16, CT-N05 |
| CA-14 Segurança | ✅ | CT-E13, CT-M01, CT-M05 (DSK-11) |
| CA-15 axe, teclado, foco | ✅ | CT-E14 (leitor de tela manual pendente) |
| CA-16 "Abrir com o Prumo" e segunda instância | ✅ / ⏳ | CT-E12; a chave do `.exe` é conferida no CI |
| CA-17 Abre em < 3 s; piloto em < 3 s; janela não congela | ✅ | 0,3 s; piloto em 0,5 s; tarefas fora do quadro da janela, com cancelar |
| CA-18 Instalador < 150 MB | ✅ | `.exe` com 116 MB e `.msi` com 121 MB (Linux medido no CI) |

## 2. Aderência ao Desenho Técnico
- Motor no processo principal, porta `Navegador` com janelas fora da tela, `prumo-arquivo://` com raízes registradas, lista fechada de canais, preload em sandbox, CSP e fuses: como no desenho.
- A atualização usa um cliente próprio (releases + `SHA256SUMS.txt`) e nunca instala sozinha.
- Desvio: o canal `janela:pronta` não estava no desenho. Ele corrige a perda de eventos na abertura e está registrado na MEMORY.

## 3. Aderência à Arquitetura
- O motor continua sem depender do Electron: o programa é um adaptador, como a CLI e o Docker.
- `playwright-core` não entra no programa.
- Nenhuma dependência nova em produção: Preact, signals, Electron e electron-builder entram só no build.

## 4. Reutilização
O programa chama as funções públicas do motor. A prévia segue o `servir`. Os testes usam as fábricas da 0001 e da 0002.

## 5. Qualidade dos Testes
- Todos os cenários do 03 têm teste, exceto os de instalador, que dependem do CI.
- O E2E roda o programa real com diálogos e editor trocados só fora do empacotamento de produção.
- A verificação de cancelamento usa a especificação 5× o piloto, para não depender de corrida.
- A cobertura do principal sem Electron ficou entre 94% e 100%.

## 6. Achados

| Severidade | Achado | Situação |
|---|---|---|
| Média | `await app.whenReady()` no nível do módulo travava o programa | Corrigido |
| Média | Eventos da abertura perdidos | Corrigido (`janela:pronta`) |
| Baixa | Duplo clique em tarefas gerava DSK-10 e escondia o aviso | Corrigido (botões ocupados) |
| Baixa | 15 vulnerabilidades moderadas na cadeia de build do electron-builder | Aceito: nada entra no programa; acompanhar novas versões |
| Baixa | "Abrir com o Prumo" no `.msi` exige ligar em Preferências | Aceito no desenho; documentado |

## 7. Próximos Passos
1. CI do PR verde, incluindo o job `instaladores`, no Windows e no Linux.
2. Roteiro manual com NVDA no Windows Sandbox e com Orca no Ubuntu antes da tag `v0.1.0`.
3. Primeira release (`v0.1.0`) pelo `release.yml`.
4. Feature 0004: kit gov.br DS, protótipo clicável completo e captura em celular.

## 8. Lições para a MEMORY
Registradas em `specs/MEMORY.md`:
- `whenReady` com ESM;
- `window-all-closed` em roteiros sem janela;
- fila de eventos até `janela:pronta`;
- Ubuntu 24, AppArmor e sandbox;
- esperar a mensagem mudar no E2E;
- barras invertidas no heredoc.
