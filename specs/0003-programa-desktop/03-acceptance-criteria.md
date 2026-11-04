# 0003 — Critérios de Aceite e Cenários de Teste

**Autor:** arc-lider (Momento A) · **Data:** 2026-11-04

## 1. Critérios de Aceite Funcionais

| # | Critério | Origem |
|---|---|---|
| CA-01 | Os instaladores `.exe`, `.msi`, `.deb` e `.AppImage` instalam e desinstalam em máquina limpa (sem Node, Python, Java, Git ou navegador além do padrão do sistema) | Pedido §8.8 |
| CA-02 | Depois de instalar, o Prumo aparece no menu Iniciar/aplicativos e na área de trabalho (`.exe`), com o ícone, e abre pelo menu | Pedido §8.8 |
| CA-03 | A desinstalação remove atalhos, a entrada "Abrir com o Prumo" e a pasta do programa; `userData` só se o usuário marcar | Spec 9.2 |
| CA-04 | Pelo programa, sem terminal: abrir a pasta de especificações, mudar a versão e as cores e salvar (o `projeto.yml` mantém os comentários) | Pedido §8.8, RN-74 |
| CA-05 | Verificar e, com um clique no achado, abrir o arquivo na linha no editor | Pedido §8.8, FA-05 |
| CA-06 | Gerar os protótipos (HTML e PNG) de um módulo, a documentação e o PDF, com andamento e cancelamento | Pedido §8.8, RN-79 |
| CA-07 | Comparar com a versão anterior (pasta e branch/tag), ver a lista de mudanças e abrir o trecho alterado | Pedido §8.8 |
| CA-08 | PNGs gerados pelo programa equivalem aos da CLI (mesma tolerância da 0001) e não dependem de navegador instalado | RN-71 |
| CA-09 | Prévia ao vivo: salvar um `.feature` atualiza o protótipo e a verificação abertos em até 3 s | Spec 6.5 |
| CA-10 | Sinais da inferência visíveis por campo; editar o override mostra o diff e grava preservando comentários | Spec 6.4 |
| CA-11 | Criar projeto novo gera uma estrutura que passa na verificação sem erros | FA-04 |
| CA-12 | Atualização: com versão nova publicada, o aviso aparece; nada é baixado sem clique; arquivo com SHA-256 errado é recusado; sem rede, nada quebra | RN-73 |
| CA-13 | Única conexão de rede do programa é a verificação de atualização; desligada, nenhuma conexão | Pedido §8.11 |
| CA-14 | Segurança: a janela não tem acesso a Node; canal fora da lista é recusado; caminho fora do projeto é recusado; navegação externa bloqueada | RN-72 |
| CA-15 | axe sem violações sérias ou críticas em todas as telas; todas as ações por teclado; foco visível | Pedido §8.9 |
| CA-16 | "Abrir com o Prumo" e segunda instância entregam a pasta à janela aberta | RN-76, RN-77 |
| CA-17 | O programa abre em < 3 s e o projeto do piloto em < 3 s; a janela não congela durante tarefas | Spec §10 |
| CA-18 | Instalador < 150 MB | Spec §10 |

## 2. Cenários de Integração do Motor

| ID | Cenário | Esperado |
|---|---|---|
| CT-I01 | `editarYaml` muda `projeto.versao` e `identidade.cores.primaria` | Só essas linhas mudam; comentários, ordem e mapas na mesma linha intactos |
| CT-I02 | `editarYaml` cria chave nova e remove chave | Chave criada no bloco certo; remoção limpa |
| CT-I03 | `criarProjetoNovo` | `projeto.yml` válido, módulo de exemplo, regras e mensagens mínimas; `verificar` sem erros |
| CT-I04 | Cancelamento em `gerar` e em `gerarDocumentacao` | `ErroPrumo('CANCELADO')`; nenhum arquivo pela metade (todos os HTML existentes válidos) |
| CT-I05 | Andamento | Etapas em ordem, `feito ≤ total`, última = total |
| CT-I06 | `PRUMO_RECURSOS` | Kits, fontes e axe lidos da raiz indicada |
| CT-I07 | Gravação atômica | Nenhum `.tmp` restante; conteúdo completo |

## 3. Cenários do Processo Principal (Node)

| ID | Cenário | Esperado |
|---|---|---|
| CT-M01 | Validadores de canal | Forma errada → erro; canal desconhecido → erro; caminho fora do projeto → erro |
| CT-M02 | Preferências | Ausentes/corrompidas → padrões; gravação atômica; recentes limitados a 10, sem duplicata |
| CT-M03 | Atualização | Versão maior → disponível; igual/menor → nada; escolhe o arquivo do formato em uso; SHA-256 certo → pronto; errado → recusa e apaga; sem rede → silêncio (automática) / DSK-06 (manual); desligada → nenhuma requisição |
| CT-M04 | Editor | `vscode` → `code --goto arquivo:linha`; executável próprio com `{arquivo}`/`{linha}`; sem editor → aplicativo padrão |
| CT-M05 | Fila | Uma tarefa por vez; cancelar; erro do motor vira `{codigo, mensagem}` |

## 4. Cenários do `NavegadorElectron` (dentro do Electron)

| ID | Cenário | Esperado |
|---|---|---|
| CT-N01 | Captura do exemplo | 7 PNGs 1440 px de largura; diferença ≤ tolerância da 0001 em relação à referência |
| CT-N02 | Página alta (> 10.000 px) | Capturada inteira, conteúdo no fim |
| CT-N03 | PDF | Destinos `/Dests` corretos; rodapé presente |
| CT-N04 | axe | Executa e devolve violações no formato da porta |
| CT-N05 | Rede | Página que pede `https://` → bloqueado e registrado |

## 5. Cenários E2E (Playwright `_electron`, Windows e Linux)

| ID | Fluxo | Esperado |
|---|---|---|
| CT-E01 | Abrir o exemplo (diálogo trocado por resposta fixa) | Resumo DSK-02; recente gravado |
| CT-E02 | Configuração: versão "2.0", cor primária `#0B6E4F`, salvar | DSK-03; `projeto.yml` com só essas mudanças e comentários preservados; prévia de contraste mostrada |
| CT-E03 | Verificação: plantar link quebrado, verificar, clicar no achado | Editor falso recebe `arquivo:linha` certos |
| CT-E04 | Protótipos: gerar PNG do módulo `01_Portal` | 3 PNGs gravados; andamento mostrado; painel da tela com sinais |
| CT-E05 | Override: mudar componente do campo Fone, ver diff, salvar | `telas.overrides.yml` gravado com comentários; protótipo atualizado |
| CT-E06 | Documentação e PDF | Site gerado; PDF salvo no caminho escolhido; "Ver aqui" mostra a documentação |
| CT-E07 | Comparar com pasta anterior | Lista com nova, alterada e removida; abrir a alterada mostra o diff |
| CT-E08 | Cancelar a geração da documentação | Estado "Cancelado"; nenhum arquivo pela metade |
| CT-E09 | Prévia ao vivo | Editar o `.feature` fora do programa → protótipo e verificação atualizados em ≤ 3 s |
| CT-E10 | Criar projeto novo | Estrutura criada e aberta; verificação sem erros |
| CT-E11 | Mudança não salva + trocar de tela | DSK-04 |
| CT-E12 | Segunda instância com pasta | A janela aberta recebe a pasta |
| CT-E13 | Segurança | `typeof require === 'undefined'` na janela; `window.prumo.invocar('x')` recusa; navegação para `https://` bloqueada |
| CT-E14 | axe em cada tela + teclado (Tab pelo menu, Enter abre, `Ctrl+S` salva) | Sem violações sérias/críticas; foco visível |
| CT-E15 | Atualização contra servidor local com versão maior | Aviso; "Baixar" baixa e confere; "Lembrar depois" some por 7 dias |
| CT-E16 | Sem rede e atualização desligada | Nenhuma requisição fora de `file:`/`prumo-arquivo:` durante todo o roteiro |

## 6. Cenários dos Instaladores (CI)

| ID | Sistema | Esperado |
|---|---|---|
| CT-X01 | Windows `.exe /S` | Instala sem administrador em `%LOCALAPPDATA%\Programs\Prumo`; atalhos no menu e na área de trabalho; chave `HKCU\…\Directory\shell\Prumo`; `--verificar-instalacao` imprime "ok"; desinstalação silenciosa remove tudo |
| CT-X02 | Windows `.msi /qn` | Instala em `Program Files`; atalho no menu; `--verificar-instalacao` ok; `msiexec /x /qn` remove |
| CT-X03 | Linux `.deb` | `dpkg -i`; `.desktop` com `MimeType=inode/directory` e ícone; `--verificar-instalacao` ok (xvfb); `apt remove` limpa |
| CT-X04 | Linux `.AppImage` | Executa com `--appimage-extract-and-run --verificar-instalacao`; ok |
| CT-X05 | Tamanhos | Cada instalador < 150 MB |
| CT-X06 | Release | `SHA256SUMS.txt` confere com os arquivos |

## 7. Massa de Dados

| Entregável | Caminho | Conteúdo |
|---|---|---|
| Exemplo fictício | `exemplos/exemplo-ficticio/` | Base de todos os cenários |
| Repositório Git de duas versões | `packages/motor/test/fabricas/repositorio-git.ts` (0002) | CT-E07 com ref |
| Release falsa | `apps/desktop/test/fabricas/release.ts` | Servidor HTTP local com JSON da API do GitHub, arquivos e `SHA256SUMS.txt` (certo e errado) |
| Editor falso | `apps/desktop/test/fabricas/editor-falso.mjs` | Grava os argumentos recebidos num arquivo |
| Respostas de diálogo | `PRUMO_TESTE_DIALOGOS` | JSON com a pasta/arquivo de cada diálogo, só nos testes |

## 8. Cobertura Mínima

- Motor: metas atuais (85% linhas, 80% ramos).
- `apps/desktop/src/principal`: 80% de linhas nos módulos sem Electron (canais, preferências, atualização, editor, fila).
- Telas: cobertas pelos E2E (todas as telas e ações da seção 5).

## 9. Definition of Done

- [ ] CA-01 a CA-18 atendidos (CA-01 a CA-03 pelo CI de instaladores + roteiro manual no Windows Sandbox e VM Ubuntu)
- [ ] Testes verdes no CI (Ubuntu e Windows), incluindo E2E e instaladores
- [ ] axe sem violações sérias/críticas nas telas do programa
- [ ] README com instalação, aviso do SmartScreen e atualização
- [ ] `COMPONENTS.md`, `DEPLOYMENT.md` e `MEMORY.md` atualizados
- [ ] Commits sem referência a IA
