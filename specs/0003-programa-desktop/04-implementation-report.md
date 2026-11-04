# 0003 — Relatório de Implementação

**Autor:** arc-dev · **Data:** 2026-11-04 · **Status:** ✅ Completo

## 1. Resumo

O programa de computador está implementado conforme o desenho:
- Electron 45.2.2 com o motor no processo principal;
- janela em Preact, com sete telas: Projetos, Configuração, Verificação, Protótipos, Documentação e PDF, Comparar versões, Preferências e Sobre;
- captura e PDF pelo Chromium do próprio Electron (`NavegadorElectron`);
- aviso de atualização pelas releases do GitHub;
- instaladores `.exe` (por usuário), `.msi` (por máquina), `.deb` e `.AppImage`.

| Medida (Windows 11, esta máquina) | Resultado |
|---|---|
| Abrir o programa até a tela de Projetos | 0,3 s (três aberturas: 348, 293 e 307 ms) |
| Piloto (Vale-Cultura, 44 funcionalidades, 41 telas): abrir o projeto | 0,5 s, 0 erros e 14 avisos (os mesmos da CLI) |
| Piloto: documentação em pasta | 1,9 s, 9,3 MB |
| Piloto: PDF completo | 5,6 s, 175 páginas, 6,2 MB |
| `Prumo-Setup-0.1.0.exe` | 116 MB |
| `Prumo-0.1.0.msi` | 121 MB |
| Pacote instalado (`win-unpacked`) com `--verificar-instalacao` | `ok 0.1.0 motor 0.1.0 png 2707`, com asar e fuses ligados |

O piloto foi copiado do WSL para uma pasta temporária; nada dele entrou no repositório.

## 2. Arquivos Criados

| Caminho | Conteúdo |
|---|---|
| `apps/desktop/package.json`, `tsconfig.json` | Pacote `@prumo/desktop` (Prumo 0.1.0), scripts `build`, `iniciar`, `dist` |
| `apps/desktop/electron-builder.yml` | Alvos, ícones, `extraResources` (recursos do motor), fuses, NSIS por usuário, MSI por máquina, `.deb`, `.AppImage` |
| `apps/desktop/build/icon.png`, `scripts/icone.mjs` | Ícone gerado (prumo sobre azul-petróleo, 512 px) |
| `apps/desktop/build/instalador.nsh` | "Abrir com o Prumo" em HKCU, criado e removido pelo `.exe` |
| `apps/desktop/scripts/empacotar.mjs` | esbuild: `main.mjs` (ESM), `preload.cjs`, `janela.js`; copia HTML, CSS, fontes e recursos; em produção remove as variáveis de teste por `define` |
| `apps/desktop/scripts/testar-instaladores.{ps1,sh}` | Instalar, conferir atalhos, menu de contexto e `.desktop`, `--verificar-instalacao`, desinstalar, conferir limpeza e tamanho |
| `apps/desktop/src/comum/{tipos,canais}.ts` | Tipos compartilhados; lista fechada de canais com validação |
| `apps/desktop/src/preload/preload.ts` | `window.prumo` (`invocar`, `ouvir`, `caminhoDoArquivo`, `plataforma`) |
| `apps/desktop/src/principal/main.ts` | Ciclo de vida, instância única, `--verificar-instalacao`, fila de eventos até `janela:pronta`, verificação diária de atualização |
| `apps/desktop/src/principal/ipc.ts` | Despacho dos canais com conferência do remetente; diálogos (com respostas fixas só nos testes) |
| `apps/desktop/src/principal/servicos.ts` | Projeto aberto, configuração com diff e conferência de base, protótipos, lista de liberados, fila de tarefas |
| `apps/desktop/src/principal/navegador-electron.ts` | Porta `Navegador` com janelas fora da tela: captura, PDF com rodapé, axe, bloqueio de rede |
| `apps/desktop/src/principal/{protocolo,seguranca,preferencias,atualizacao,editor,menu-contexto,previa,registro}.ts` | `prumo-arquivo://`, CSP e blindagem, preferências, atualização, editor, registro do Windows, prévia ao vivo, registro em arquivo |
| `apps/desktop/src/janela/{index.html,estilo.css,estado.ts,app.tsx}` | Casca, tema claro e escuro, sinais, menu, barra de tarefa com cancelar, aviso de atualização, atalhos |
| `apps/desktop/src/janela/telas/*.tsx` | As sete telas |
| `apps/desktop/test/**` | Testes do principal, do navegador embutido e E2E (ver o 05) |
| `.github/workflows/release.yml` | Instaladores testados nos dois sistemas, `SHA256SUMS.txt` e release |

Do motor, criados na primeira etapa:
- `util/execucao.ts`, `util/recursos.ts`;
- `config/editar.ts`, `config/novo.ts`;
- `navegador/marca-png.ts`.

## 3. Arquivos Alterados

| Caminho | Mudança |
|---|---|
| `packages/motor/src/**` | Andamento e cancelamento nos fluxos longos; recursos por `PRUMO_RECURSOS`; gravação atômica; `playwright-core` sob demanda; marca `Software=Prumo` nos PNGs |
| `package.json` (raiz) | Workspace `apps/desktop`; `tipos` inclui o desktop |
| `vitest.config.ts` | Testes de `apps/*`; cobertura do principal sem Electron com meta de 80% |
| `.github/workflows/ci.yml` | Sandbox liberado e `xvfb-run` no Linux; job `instaladores` nos PRs |
| `README.md` | Instalação, aviso do SmartScreen, atualizações, comandos do programa |
| `specs/{COMPONENTS,DEPLOYMENT,MEMORY,INDEX}.md` | Componentes, publicação, lições e situação |

## 4. Migrations
Não se aplica.

## 5. Reutilização Aplicada
- O programa chama as mesmas funções da CLI: `preparar`, `gerar`, `gerarECapturar`, `compararComAtuais`, `gerarDocumentacao`, `gerarPdf`, `verificar`.
- `NavegadorElectron` implementa a porta `Navegador` da 0001 sem mudar o motor.
- A prévia ao vivo segue o padrão do `prumo servir`: debounce de 300 ms e uma regeneração por vez.
- Os testes reaproveitam as fábricas do motor: `criarRepositorio`, `criarEspecificacaoGrande` e o exemplo fictício.

## 6. IDs e Acessibilidade
- Todo controle tem `data-testid` estável (`{tela}-{ação}`); a lista está nos E2E.
- Rótulos visíveis e `aria-describedby` para ajuda e erro.
- `aria-current` no menu.
- `role=alert` para erro e `role=status` para aviso.
- Barra de andamento com `aria-valuenow` e texto `aria-live`.
- Atalhos: Ctrl+O abre a pasta, F5 verifica e Ctrl+S salva a configuração.
- Foco visível em todos os controles; tema claro e escuro.

## 7. Variáveis de Ambiente Novas
`PRUMO_USERDATA` e `PRUMO_RECURSOS`. Só para testes, lidas com o programa não empacotado e removidas do build de produção:
- `PRUMO_TESTE_DIALOGOS`;
- `PRUMO_EDITOR_TESTE` e `PRUMO_EDITOR_SAIDA`;
- `PRUMO_FORMATO`.

Ver o `DEPLOYMENT.md`.

## 8. Comandos

```bash
npm run iniciar --workspace @prumo/desktop
```

```bash
npm run dist --workspace @prumo/desktop
```

## 9. Decisões Durante Implementação

| Decisão | Motivo |
|---|---|
| `app.whenReady().then(...)` em vez de `await` no nível do módulo | Com `main` ESM, o Electron só emite `ready` depois do script terminar: o `await` travava para sempre |
| Canal `janela:pronta` e fila de eventos no principal | Eventos enviados logo após `loadFile` chegavam antes dos ouvintes da janela e se perdiam (aviso de atualização, pasta do "Abrir com o Prumo") |
| `window-all-closed` não encerra no `--verificar-instalacao` | Fechar as janelas fora da tela derrubava o app antes de gravar o resultado |
| Botões de tarefa desativados enquanto outra roda (`ocupado`) | Evita o DSK-10 por clique duplo e deixa claro que só há uma tarefa por vez |
| `net.fetch` do Electron na atualização | Respeita o proxy do sistema |
| Ícone gerado por script | Sem arte de terceiros; o arquivo é reproduzível |
| Mantenedor do `.deb` com o e-mail `noreply` do GitHub | O pacote é público; não expõe e-mail pessoal |

## 10. Pendências e Débitos Técnicos
- O teste de instalar e desinstalar roda só no CI (máquinas limpas). Ele não foi executado nesta máquina, para não criar atalhos e chaves de registro aqui, e o `.msi` exige administrador.
- O roteiro manual com NVDA no Windows Sandbox e com Orca numa VM Ubuntu fica para antes da primeira release.
- `npm audit`: 15 moderadas, todas na cadeia de build do electron-builder (`minimatch` antigo via `glob`, `rimraf` e `temp`). Nenhuma entra no programa (`--omit=dev`: 0).
- Sem certificado de assinatura: o SmartScreen avisa (documentado). O CI está pronto para os secrets `WIN_CSC_LINK` e `WIN_CSC_KEY_PASSWORD`.

## 11. Observações para o arc-tester
- O E2E usa o `dist/` de desenvolvimento. O `npm run dist` gera o de produção, sem os ganchos de teste; refaça com `npm run build -w @prumo/desktop` antes do E2E.
- No Linux: `xvfb-run` e o `sysctl` do AppArmor (já no CI).

## 12. Bloqueios Encontrados
Nenhum.
