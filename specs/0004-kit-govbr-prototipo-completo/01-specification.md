# 0004 — Kit gov.br DS, protótipo clicável completo e captura em celular

**Autor:** arc-requisito · **Data:** 2026-11-04 · **Status:** Em especificação

## 1. Contexto e Objetivo

Até a 0003, o Prumo gera protótipos com um só kit de design (`proprio`), que aplica as cores e as fontes do `projeto.yml`.
Navegar entre as telas se limita a links soltos, e a captura sai só em 1440 px.

Sistemas de governo seguem o padrão gov.br DS. Quem especifica um sistema novo precisa de protótipos com a cara do
gov.br e de um protótipo que se comporte como o sistema: clicar em "Enviar" com dado errado mostra o erro, com dado
certo mostra o sucesso, e os botões e o menu levam às telas certas.

Esta feature entrega:
- **Kit `govbr`:** cabeçalho, menu, migalha, rodapé, campos, botões, tabelas e mensagens do gov.br DS, com a fonte
  Rawline embutida, sem nada baixado da internet. Projetos novos já nascem com ele.
- **Protótipo clicável completo:** as ações e o menu levam às telas de destino. Os botões que, nos cenários, produzem
  erro, aviso ou sucesso passam a mostrar esse estado, encadeando as telas como no fluxo descrito.
- **Captura em celular (390 px):** opcional, gravada ao lado do PNG atual como `<tela>-celular.png`.
- **Três ajustes pendentes da 0001:**
  - o layout "janela sobre o portal";
  - o selo de situação nas colunas Situação e Status;
  - o logo para fundo claro.

**Valor:** o protótipo deixa de ser uma coleção de telas e vira um ensaio navegável do sistema, no padrão visual exigido em
projetos de governo, sem o analista desenhar nada à mão.

## 2. Atores

| Ator | Interesse |
|---|---|
| Analista de requisitos | Escreve as features; quer o protótipo gov.br e os fluxos sem ajuste manual |
| Pessoa que valida (gestor, área de negócio) | Navega o protótipo na documentação ou no programa como se fosse o sistema |
| Equipe de desenvolvimento | Usa os protótipos (inclusive de celular) como referência de tela |
| Mantenedor do Prumo | Mantém os dois kits sem duplicar regra |

## 3. Pré-condições

- Especificações no formato Pirilampo, como nas features anteriores.
- `projeto.yml` com `identidade.design_system: govbr` ou `proprio`. Sem a chave, vale `proprio`, para não mudar
  nenhum projeto existente.

## 4. Fluxo Principal

1. O analista escolhe o kit `govbr`, no `projeto.yml` ou na tela de Configuração do programa.
2. O Prumo gera os protótipos com a estrutura e a aparência do gov.br DS.
3. Em cada tela, as ações têm destino:
   - links e botões que abrem outra funcionalidade levam a ela;
   - o menu e a migalha levam às telas do módulo;
   - os botões que, num cenário, produzem uma mensagem levam ao estado daquele cenário.
4. A pessoa que valida abre o protótipo, pela documentação, pelo programa ou pela pasta, e percorre o fluxo clicando.
5. Ao capturar com a opção de celular ligada, o Prumo grava também `<tela>-celular.png`, a 390 px.
6. A documentação e o programa mostram o protótipo em largura de celular e de computador.

## 5. Fluxos Alternativos

- **FA-01 Ação sem destino conhecido:** o botão fica no protótipo, sem levar a lugar nenhum. Um aviso discreto ("Esta ação
  não está descrita nos cenários") aparece ao clicar, e a verificação registra uma informação, não um erro.
- **FA-02 Mais de um cenário para a mesma ação:** por exemplo, "Enviar" com CPF inválido (erro) e "Enviar" com tudo
  certo (sucesso). O botão leva ao estado de sucesso; os estados de erro ficam no seletor de estados e podem ser
  provocados com um modo "simular erro" (RN-84).
- **FA-03 Kit `govbr` com cores do `projeto.yml`:** as cores principais do gov.br são mantidas (o padrão exige). Só o logo,
  o nome do sistema e o órgão vêm do projeto. A verificação avisa se o projeto define cores que o kit `govbr` não usa.
- **FA-04 Logo só para fundo escuro:** sem `projeto.logo_claro`, o cabeçalho branco do gov.br usa o logo normal se o
  contraste com o branco for suficiente. Se não for, mostra só o nome do sistema e a verificação avisa.
- **FA-05 Captura de celular de tela muito larga** (tabela com muitas colunas): a tabela rola na horizontal dentro do
  PNG, como num celular. A página não estoura a largura de 390 px.
- **FA-06 Projeto antigo sem `design_system`:** continua no `proprio`, com saída idêntica à da 0003. Mudar o kit é sempre
  uma escolha explícita.
- **FA-07 Layout "janela sobre o portal" em kit sem portal** (tela de sistema autenticado): a janela aparece sobre a
  casca autenticada esmaecida, da mesma forma.

## 6. Telas e comportamentos

### 6.1 Kit `govbr` (protótipos gerados)

| Parte | Comportamento |
|---|---|
| Cabeçalho | Padrão gov.br: logo do projeto, nome do sistema, órgão; casca autenticada com o perfil e "Sair" |
| Menu | Menu lateral do gov.br na casca autenticada, com os itens do perfil, marcando a tela atual |
| Migalha | Breadcrumb do gov.br com os mesmos itens de hoje |
| Rodapé | Rodapé do gov.br com o nome do órgão e a versão do projeto |
| Campos | Input, select, checkbox, radio, textarea, upload e captcha do gov.br, com rótulo, ajuda, obrigatório e mensagem de erro no campo |
| Botões | Primário, secundário e terciário do gov.br; o primário é a ação marcada como principal |
| Tabelas | Tabela do gov.br com cabeçalho, ações por linha e paginação |
| Mensagens | Message do gov.br (sucesso, erro, aviso e informação) no topo, e feedback no campo |
| Selo de situação | Tag do gov.br com cor por valor (RN-86), também no kit `proprio` |
| Fonte | Rawline embutida (subconjunto latino) |

Todos os layouts existentes (listagem, formulário, formulário em etapas, leitura, API) têm versão `govbr`, além do
novo "janela sobre o portal" (6.4).

### 6.2 Protótipo clicável

| Elemento | Ao clicar |
|---|---|
| Ação que abre outra funcionalidade (texto em negrito igual ao título de uma feature) | Vai para a tela de destino, estado padrão |
| Item do menu ou da migalha | Vai para a tela correspondente |
| Botão que produz mensagem num cenário (ex.: "Quando aciona **Enviar** … Então exibe MSG-05") | Vai ao estado daquele cenário: sucesso por padrão, erro no modo "simular erro" |
| Ação de linha na tabela (Visualizar, Editar) | Vai para a tela de leitura ou de edição correspondente, se houver |
| Paginação, filtros, abas | Funcionam localmente (página 2, limpar filtros) sem mudar de tela |
| Ação sem destino | FA-01 |

**Barra do protótipo** (fora da área capturada, como o seletor de estados de hoje):
- seletor de estado;
- interruptor "Simular erro";
- "Voltar" para a tela anterior do percurso;
- largura "Computador" ou "Celular".

### 6.3 Captura em celular

- Ligada por `captura.celular: true` no `projeto.yml`, pela opção `--celular` da CLI ou pela caixa "Também em celular" no
  programa.
- Grava `<módulo>/<tela>-celular.png` a 390 px de largura, página inteira, só no estado padrão.
- O PNG de 1440 px e o caminho que o `@prototipo` referencia não mudam.
- "Comparar com os PNGs atuais" também compara os de celular quando existirem.

### 6.4 Layout "janela sobre o portal"

- Para telas que, no sistema, abrem como janela sobre uma página (por exemplo, a lista de beneficiárias do piloto).
- A página de fundo, que é a tela de origem ou a casca pública, aparece esmaecida, e a tela atual fica numa janela
  central com título e "Fechar".
- Escolhido por override (`layout: janela_sobre`) ou pelo comentário `# Layout: janela` na feature.
- Funciona nos dois kits.

### 6.5 Programa e documentação

| Lugar | Mudança |
|---|---|
| Configuração (programa) | "Kit de design" passa a oferecer gov.br; campo do logo para fundo claro; caixa "Também capturar em celular" |
| Projeto novo (programa e `prumo novo`) | Já vem com `design_system: govbr` |
| Protótipos (programa) | Barra do protótipo da 6.2; prévia em largura de celular |
| Documentação | Protótipo embutido com a mesma barra; seletor Computador/Celular |

### 6.6 Mensagens

| Código | Texto | Quando |
|---|---|---|
| — | "Esta ação não está descrita nos cenários." | Clique em ação sem destino (FA-01) |
| `kit/cor-ignorada` (aviso) | "O kit gov.br usa as cores do padrão; as cores de {papéis} do projeto.yml não são aplicadas." | FA-03 |
| `identidade/logo-contraste` (aviso) | "O logo tem pouco contraste com o cabeçalho claro; informe projeto.logo_claro." | FA-04 |
| `prototipo/acao-sem-destino` (informação) | "A ação {rótulo} de {tela} não leva a nenhuma tela nem estado descrito." | FA-01 |
| `prototipo/varios-sucessos` (aviso) | "{n} cenários de sucesso para {ação} em {tela}; o protótipo usa o primeiro." | RN-84 |

## 7. Regras de Negócio

- **RN-80:** `identidade.design_system` aceita `govbr` e `proprio`. Sem a chave, vale `proprio`. Projeto novo, pela CLI ou
  pelo programa, nasce com `govbr`.
- **RN-81:** o kit `govbr` segue a estrutura e as classes do gov.br DS 3.7, sem JavaScript de terceiros nem recurso
  externo. CSS e fonte vão embutidos na saída, que continua abrindo por `file://`.
- **RN-82:** a mesma tela no kit `govbr` e no kit `proprio` tem os mesmos `id`, `data-testid`, campos, ações e estados. Só a
  aparência muda.
- **RN-83 (destino das ações):** uma ação leva a outra tela quando:
  - o rótulo coincide com o título de uma funcionalidade;
  - um passo "aciona **X**" é seguido de "o sistema exibe **{tela}**";
  - um override define `destino`.
  As ações de linha usam a tela de leitura ou de edição do mesmo módulo cujo título contém a entidade.
- **RN-84 (fluxo dos estados):** um estado de erro, aviso ou sucesso fica ligado à ação acionada no seu cenário.
  - Clicar na ação mostra o estado de **sucesso** daquela ação.
  - Com "Simular erro" ligado, mostra o primeiro estado de **erro**; cliques seguidos percorrem os erros em ordem.
  - Sem cenário de sucesso, clicar mostra o primeiro erro.
- **RN-85 (percurso):** "Voltar" retorna à tela e ao estado anteriores do percurso da sessão. Abrir uma tela diretamente
  começa um percurso novo.
- **RN-86 (selo de situação):** coluna cujo nome contenha "Situação" ou "Status", com valores de uma LOV, mostra o valor
  como selo.
  - A cor sai do sentido do valor: verde para "Autorizada", "Ativa" ou "Aprovada"; vermelho para "Não autorizada",
    "Inativa" ou "Reprovada"; amarelo para "Aguardando", "Em análise" ou "Pendente"; neutro nos demais casos.
  - A cor pode ser definida no `telas.overrides.yml`.
  - O selo sempre traz o texto, nunca só a cor.
- **RN-87 (celular):** a captura de celular usa 390 px de largura, a mesma página com o layout responsivo, e nunca substitui
  o PNG de 1440 px.
- **RN-88 (logo claro):** `projeto.logo_claro` é o logo para fundos claros, como o cabeçalho do gov.br e a casca pública
  clara do `proprio`; `projeto.logo` segue para fundos escuros.
- **RN-89:** todo protótipo, nos dois kits e nas duas larguras, passa no axe sem violações sérias ou críticas e funciona
  por teclado.

## 8. Permissões

Não se aplica: o Prumo não tem usuários. As cascas autenticadas mostram o perfil da feature, como hoje.

## 9. Dados

| Chave nova | Onde | Tipo | Padrão |
|---|---|---|---|
| `identidade.design_system` | `projeto.yml` | `govbr` \| `proprio` | `proprio` (projeto novo: `govbr`) |
| `projeto.logo_claro` | `projeto.yml` | caminho | — |
| `captura.celular` | `projeto.yml` | booleano | `false` |
| `layout: janela_sobre` | `telas.overrides.yml` | layout | — |
| `acoes.{rótulo}.destino` | `telas.overrides.yml` | tela ou `estado:{id}` | — |
| `selos.{valor}` | `telas.overrides.yml` (por coluna) | `sucesso` \| `erro` \| `aviso` \| `neutro` | pela RN-86 |

O `modelo/telas.json` ganha, para cada ação:
- o destino;
- a ligação com os estados;
- o porquê, com sinal e regra, como na inferência.

## 10. Requisitos Não-Funcionais

- **Sem rede:** o kit `govbr` não carrega nada de fora (fonte, ícones e CSS embutidos). A verificação de rede das capturas
  continua sem pedidos externos.
- **Tamanho:** o CSS do gov.br entra só com o necessário. A documentação em arquivo único do piloto no kit `govbr` não
  passa de 1,5× a do `proprio`.
- **Desempenho:** gerar e capturar o piloto no kit `govbr` não leva mais que 1,3× o tempo do `proprio`. A captura de celular
  soma no máximo 60% ao tempo da captura.
- **Acessibilidade:** eMAG 3.1 e WCAG 2.1 AA nos dois kits e nas duas larguras. O foco visível segue o gov.br.
- **Compatibilidade:**
  - projeto existente sem `design_system` gera os mesmos protótipos e PNGs da 0003;
  - os testes de referência visual do kit `proprio` continuam passando sem atualização.

## 11. Dependências

- `@govbr-ds/core` 3.7.0 (MIT): CSS e estrutura.
  - O `core.min.css` tem 719 KB e só *cita* a Rawline (`Rawline, Raleway, sans-serif`), sem trazê-la.
  - Os ícones vêm do Font Awesome 5 Free, como fonte de ícones.
  - O Prumo embute só o CSS usado e ícones em SVG.
- Fonte: a Rawline (SIL OFL) não está no npm. A Raleway, que é a reserva do próprio gov.br, está em `@fontsource/raleway`
  5.3.0 (OFL-1.1). Ver D-01.
- Ícones: o gov.br DS usa o Font Awesome Free, cujos ícones têm licença CC BY 4.0 e as fontes, SIL OFL. Uso só os ícones
  necessários, em SVG embutido, com a atribuição exigida.

## 12. Fora de Escopo

- Sugestões por IA e o uso no CI (0005, em espera).
- Temas escuros do gov.br, variantes de densidade e componentes avançados (carrossel, wizard animado).
- Fluxos com dados que persistem entre telas (o protótipo não guarda o que foi digitado de uma tela para outra).
- Larguras de captura além de 1440 e 390 px.
- Reativar os instaladores do Linux (pendência da 0003, tratada à parte).

## 13. Glossário Específico

| Termo | Significado |
|---|---|
| Kit | Conjunto de templates e CSS que dá a aparência ao protótipo (`proprio` ou `govbr`) |
| Percurso | Sequência de telas e estados visitados ao clicar no protótipo |
| Simular erro | Modo do protótipo em que as ações mostram o estado de erro dos cenários |
| Selo | Etiqueta colorida com o texto da situação |
| Janela sobre o portal | Tela que aparece como janela sobre outra página esmaecida |

## 14. Dúvidas em Aberto

| # | Dúvida | Impacto | Proposta |
|---|---|---|---|
| D-01 | O `@govbr-ds/core` não inclui a Rawline (confirmado no pacote 3.7.0) e ela não está no npm | Aparência do kit | (a) Raleway pelo `@fontsource`, a reserva prevista no próprio gov.br; ou (b) a Rawline (OFL) versionada no repositório, baixada uma vez da fonte oficial, com a licença ao lado |
| D-02 | Cores do projeto no kit `govbr` (FA-03): ignorar ou permitir só a cor primária? | Baixo | Ignorar todas, com aviso; o padrão gov.br define as cores |
| D-03 | Os PNGs de celular devem aparecer na documentação? | Baixo | Sim: no seletor Computador/Celular, quando existirem |
