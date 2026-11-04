# 0004 — Desenho Técnico

**Autor:** arc-lider (Momento A) · **Data:** 2026-11-04 · **Base:** 01-specification.md

## 1. Resumo

A 0004 não muda a arquitetura (motor + adaptadores). São cinco mudanças:

1. **Kit `govbr` como pasta irmã do `proprio`** (`packages/motor/kits/govbr/`), com os mesmos nomes de template e o mesmo
   modelo de página (`contextoDaPagina`). Assim, os mesmos `id`, `data-testid`, campos e ações saem nos dois kits (RN-82).
   - **CSS:** gerado no build do motor a partir do `@govbr-ds/core` 3.7.0, só com as regras que os templates usam (PurgeCSS).
     O resultado vai embutido na saída, como o `prumo.css` de hoje.
   - **Fonte:** Raleway pelo `@fontsource/raleway`, a reserva que o próprio gov.br declara (D-01, decidido pelo usuário).
   - **Ícones:** os SVG próprios que o kit `proprio` já usa. Nada de Font Awesome, nem fonte de ícones, nem licença nova.
2. **Fluxos no modelo:**
   - cada `Estado` passa a saber qual ação o produziu (`acao`), lida do "aciona **X**" do cenário;
   - cada `Acao` passa a saber os estados que produz (`fluxo`), além do `destino`, com o sinal que explica a ligação.
   O renderizador transforma isso em `href` e em atributos `data-prumo-*`.
   O `prumo-prototipo.js` cuida de "Simular erro", "Voltar" e da barra, que fica fora da captura.
3. **Captura em celular:** a opção `celular` em `capturar`, `gerarECapturar` e `compararComAtuais` captura também a 390 px e
   grava `<tela>-celular.png` (RN-87).
4. **Ajustes de tela nos dois kits:**
   - layout `janela-sobre`;
   - selo de situação (`selo` na coluna, com a classificação de RN-86);
   - `projeto.logo_claro`.
5. **Adaptadores:**
   - a CLI ganha `--celular`, e o `prumo novo` passa a criar projetos com `govbr`;
   - o programa ganha o kit gov.br, o logo claro e a caixa de celular na Configuração, além da largura de celular na
     prévia dos Protótipos;
   - a documentação ganha o seletor Computador/Celular e repassa "Simular erro" ao protótipo embutido.

## 2. Alternativas Consideradas

| Decisão | Escolhida | Alternativa | Motivo |
|---|---|---|---|
| Como montar o kit | Templates próprios com as classes do gov.br DS e o CSS oficial reduzido | Web Components do `@govbr-ds/webcomponents` | Web Components exigem JavaScript de terceiros (fora da RN-81), quebram o "sem JS" da documentação e a captura fica dependente de hidratação |
| CSS | PurgeCSS 8.0.0 no build, sobre o `core.min.css` (719 KB) | Copiar o CSS inteiro | O arquivo único da documentação ficaria muito acima de 1,5× (seção 10 do 01) |
| Ícones | SVG próprios já existentes | Font Awesome 5 Free (o que o gov.br usa) | Evita fonte de ícones e a atribuição CC BY; os ícones necessários (alerta, visto, lupa, enviar, info, arquivo, fechar, menu) já existem ou são triviais |
| Fonte | Raleway (`@fontsource/raleway` 5.3.0, OFL) | Rawline versionada no repositório | Decisão do usuário; é a reserva declarada no CSS do gov.br |
| Fluxo ação → estado | Ligação no modelo (`Estado.acao`, `Acao.fluxo`) e páginas estáticas por estado | Aplicação de página única com roteador | Mantém um HTML por estado (já capturado, já embutido na documentação, já funcionando por `file://`) |
| "Simular erro" e "Voltar" | `sessionStorage` lido pelo `prumo-prototipo.js` | Parâmetro na URL | Funciona igual em `file://`, dentro do iframe da documentação e no programa, sem reescrever links |
| Barra do protótipo fora da captura | Oculta quando a página é aberta com `#captura` | Remover a barra do HTML | O PNG continua idêntico ao de hoje (compatibilidade da seção 10 do 01) |
| Largura de celular | Escolhida por quem hospeda (documentação, programa, índice) | Botão dentro da página | Uma página não redimensiona a si mesma; o hospedeiro muda a largura do iframe |

## 3. Desvios em relação à especificação

| Spec | Desvio | Motivo |
|---|---|---|
| §11: ícones Font Awesome em SVG | SVG próprios | Seção 2; mesma aparência funcional e sem licença nova |
| §6.2: "Computador/Celular" na barra do protótipo | Fica nos hospedeiros (documentação, programa e índice); a barra tem Estado, Simular erro e Voltar | Seção 2 |

## 4. Modelo (`packages/motor/src/modelo/tipos.ts`)

```ts
export interface Estado {
  // … (como hoje)
  acao?: string;                    // id da ação acionada no cenário (RN-84)
}

export interface Acao {
  // … (como hoje)
  destino?: string;                 // tela (RN-83)
  fluxo?: { sucesso?: string; erros: string[]; avisos: string[] }; // ids de estado
  sinal?: Sinal;                    // por que tem destino ou fluxo (aparece no painel de sinais)
}

export type Layout = 'listagem' | 'formulario' | 'formulario-etapas' | 'leitura' | 'api' | 'janela-sobre';

// Campo (coluna)
selo?: { valores: Record<string, 'sucesso' | 'erro' | 'aviso' | 'neutro'> }; // RN-86
```

**`inferencia/fluxo.ts` (novo):**
- `acaoDoCenario(filho, acoes)`:
  - lê o passo `Quando … aciona(r)? (a opção|o botão)? **X**` e devolve a ação de mesmo rótulo;
  - casa sem acento e sem caixa, e aceita "clica em" e "seleciona".
- `ligarFluxos(tela, telas)`:
  - preenche `Estado.acao`;
  - monta o `Acao.fluxo` (`sucesso` = primeiro estado de sucesso, mais `erros` e `avisos` em ordem);
  - completa o `destino` pela RN-83: passo "aciona **X**" seguido de "o sistema exibe **{tela}**", ou o override
    `acoes.{rótulo}.destino`;
  - grava o sinal.
- Achados:
  - `prototipo/acao-sem-destino` (informação) para ação sem destino e sem fluxo;
  - `prototipo/varios-sucessos` (aviso).
- Ações de linha (Visualizar, Editar): destino na tela do mesmo módulo cujo layout é `leitura` (Visualizar) ou
  `formulario` (Editar) e cujo título contém a entidade da listagem (o título sem "Lista de", "Gestão de" e "Consultar").

**`inferencia/selo.ts` (novo):**
- `classificarSelo(valor)` segue a RN-86, por raiz normalizada:
  - sucesso: `autoriz`, `ativ`, `aprov`, `conclu`, `deferid`;
  - erro: `nao autoriz`, `inativ`, `reprov`, `indeferid`, `cancel`, `bloque`;
  - aviso: `aguard`, `analise`, `pendent`, `em andamento`.
  Os de erro são testados antes ("Não autorizada" contém "autoriz").
- Aplica-se à coluna com "situação" ou "status" no nome cuja origem é uma LOV. O override `selos` substitui a cor por valor.

**`montar.ts`:**
- chama `ligarFluxos` depois de montar todas as telas, porque o destino depende das outras;
- aceita `layout: janela_sobre` no override e `# Layout: janela` na feature.

## 5. Configuração (`config/esquema.ts`)

| Chave | Validação | Padrão |
|---|---|---|
| `identidade.design_system` | `proprio` \| `govbr` (já existe) | `proprio`; `criarProjetoNovo` passa a escrever `govbr` |
| `projeto.logo_claro` | caminho relativo existente (`identidade/logo` se não existir) | — |
| `captura.celular` | booleano | `false` |
| overrides `acoes.{rótulo}.destino` | tela existente ou `estado:{id}` | — |
| overrides `colunas.{nome}.selos.{valor}` | `sucesso` \| `erro` \| `aviso` \| `neutro` | — |

O aviso `identidade/kit` ("chega na fase 4") sai. Entram:
- `kit/cor-ignorada`: no kit `govbr`, quando uma cor do projeto difere do padrão do `esquema.ts`;
- `identidade/logo-contraste`:
  - no kit `govbr`, sem `logo_claro`, e só para PNG: luminância média dos pixels opacos com contraste < 3:1 contra o branco;
  - SVG não é medido.

## 6. Renderização

### 6.1 Kits
- `diretorioDoKit` devolve `kits/govbr` ou `kits/proprio`.
- `gravarRecursos`:
  - no `govbr`, grava o `govbr.css` (gerado), o `@font-face` da Raleway (400, 600, 700 e 400 itálico, latino), o `prumo-prototipo.js`, os logos e o CSS adicional;
  - no `proprio`, segue como hoje.
- `kits/govbr/` tem:
  - `base.njk`, `casca-publica.njk`, `casca-autenticada.njk` (header, menu lateral, breadcrumb e footer do gov.br);
  - `macros.njk`: `campo`, `grade`, `acoes`, `tabela`, `paginacao`, `mensagem`, `icone` e `selo`, com as mesmas assinaturas do `proprio`;
  - `layouts/*.njk`, os mesmos seis;
  - `topo-tela.njk`, `indice.njk` e `ajustes.css` (o pouco que o gov.br não cobre: grade de 12 colunas do Prumo, janela-sobre e barra).
- **CSS do gov.br:** o novo `packages/motor/scripts/govbr-css.mjs`, chamado no `build` do motor:
  - roda o PurgeCSS sobre `node_modules/@govbr-ds/core/dist/core.min.css`, com `content` = `kits/govbr/**/*.njk` e uma
    lista segura (`safelist`) para classes montadas em tempo de execução, como as de `is-*` e `br-tag`;
  - acrescenta o cabeçalho de licença MIT do gov.br DS;
  - grava `kits/govbr/govbr.css`, ignorado no Git como o `prumo-docs.js`.
  Meta: abaixo de 120 KB sem compressão.
- **Tokens:** no `govbr` só entram as fontes e as variáveis de logo; as cores vêm do CSS oficial (FA-03).

### 6.2 Fluxo nas páginas
- `acoesVM` e as ações de linha recebem:
  - `href`, para o destino (tela) ou para o estado de `sucesso` (`../../m/t/sucesso-N.html`);
  - `data-prumo-erros="erro-3 erro-5"` e `data-prumo-avisos`, quando houver.
- **`prumo-prototipo.js`** passa a ser um único arquivo, comum aos dois kits, em `kits/comum/`:
  - **barra** (`<div class="prumo-barra" role="toolbar" aria-label="Protótipo">`), com:
    - o seletor de estado (links para os HTML irmãos, vindos de `data-prumo-estados` no `<body>`);
    - o interruptor "Simular erro", com `aria-pressed`;
    - "Voltar".
    A barra **não** aparece quando `location.hash` contém `captura` (a captura abre `…/padrao.html#captura`) nem dentro
    do iframe da documentação ou do programa, que têm os próprios controles e mandam `simular`/`voltar` por `postMessage`.
  - **simular erro**: com `sessionStorage['prumo:simular']` ligado, o clique numa ação com `data-prumo-erros` vai ao próximo
    erro da lista (índice guardado por ação em `sessionStorage`). Sem erros, vai ao `href` normal.
  - **percurso**: pilha em `sessionStorage['prumo:percurso']`. "Voltar" volta uma posição; abrir uma página que não veio de
    clique no protótipo zera a pilha (RN-85).
  - **ação sem destino**: `href` ausente e `data-prumo-sem-destino`; o clique mostra o aviso de FA-01 num `role="status"` da barra.
  - Dentro do iframe, como hoje: altura e `navegar` por `postMessage`, agora com `data-prumo-alvo` também para os erros.
- **Documentação (`docs/gerar.ts`):** a reescrita dos links do protótipo embutido passa a valer também para
  `data-prumo-erros`. O cliente `web/` ganha:
  - o interruptor "Simular erro" e o "Voltar" na moldura do protótipo;
  - o seletor Computador/Celular, que muda o iframe para 390 px e, quando o PNG existe, também a imagem de referência.

### 6.3 Selo, janela sobre o portal e logo claro
- **Selo:** `linhasDaTabela` marca as células de coluna com `selo` como `{ selo: { texto, cor } }`.
  - `govbr`: macro `selo` com `<span class="br-tag {cor}">`.
  - `proprio`: `<span class="selo selo-{cor}">`, com as cores derivadas dos tokens (sucesso/erro do projeto; aviso = destaque).
  - O texto vai sempre visível (RN-86).
- **Janela sobre o portal** (`layouts/janela-sobre.njk`):
  - fundo: a casca pública (ou a autenticada, se for essa a casca da tela), com o conteúdo de exemplo esmaecido e `aria-hidden`;
  - janela: `<section role="dialog" aria-modal="false" aria-labelledby>` com título, corpo (o layout interno inferido:
    listagem ou formulário) e "Fechar", que leva à tela de origem se ela for conhecida.
  - Captura de página inteira, como as outras telas.
- **Logo claro:** `recursos.logoClaro`. O `govbr` usa `logoClaro ?? logo`, e a casca pública clara do `proprio` também.

### 6.4 Captura em celular
- `capturar(paginas, nav, o)` recebe `celular?: boolean`. Para cada página padrão capturada a 1440, captura também a 390
  (mesmo `navegador.capturar(url + '#captura', { largura: 390 })`) e grava `<tela>-celular.png`, com a marca do Prumo e a
  mesma regra de "sem mudança".
- `gerarECapturar` usa `o.celular ?? config.captura.celular`.
- `compararComAtuais` compara os pares de celular que existirem.
- **CSS responsivo:**
  - o `govbr` já é responsivo (grade do gov.br);
  - no `proprio`, o `@media (max-width: 900px)` atual é conferido e completado a 390: tabela em região rolável
    (`overflow-x:auto`), cabeçalho empilhado e menu da casca autenticada recolhido.
  Isso não muda o PNG de 1440 (seção 10 do 01).

## 7. Adaptadores

| Onde | Mudança |
|---|---|
| CLI `capturar`, `comparar-png` | `--celular` |
| CLI `novo` (se existir) e `criarProjetoNovo` | `design_system: govbr` |
| Programa, Configuração | Kit de design com gov.br (já é uma escolha; o aviso some); "Logo para fundo claro" (escolher arquivo); "Também capturar em celular" (`captura.celular`) |
| Programa, Protótipos | Botões Computador/Celular na moldura da prévia (largura 390 com zoom 100%); "Simular erro" e "Voltar" repassados ao iframe |
| Programa, tarefa `capturar` | Parâmetro `celular` validado no canal `tarefa:iniciar` |
| Documentação | Seletor Computador/Celular e "Simular erro" na moldura do protótipo |

## 8. Segurança e privacidade
- Nenhum recurso externo: o teste de rede de cada captura (e o do programa) continua exigindo zero pedidos fora de
  `file:`, `data:` e `blob:`.
- O `prumo-prototipo.js` só lê e grava `sessionStorage` com chaves `prumo:*` e só fala com `window.parent` por `postMessage`
  com mensagens `prumo:*`, como hoje. O hospedeiro confere a origem.

## 9. Acessibilidade
- Os dois kits e as duas larguras passam no axe (sérias e críticas = 0), nas telas do exemplo em todos os estados.
- Barra: `role="toolbar"`, botões com nome, `aria-pressed` no "Simular erro" e anúncio da mudança num `role="status"`.
- Janela sobre o portal: foco inicial no título da janela; o fundo fica com `aria-hidden` e `inert`.
- Selo: texto sempre presente e contraste ≥ 4,5:1 conferido no teste.
- Celular: sem rolagem horizontal da página, alvos de toque ≥ 44 px nos botões do gov.br.

## 10. Dependências novas

| Pacote | Versão | Licença | Uso |
|---|---|---|---|
| `@govbr-ds/core` | 3.7.0 | MIT | Só como entrada do script de CSS (dependência de build do motor) |
| `@fontsource/raleway` | 5.3.0 | OFL-1.1 | Fonte do kit `govbr` |
| `purgecss` | 8.0.0 | MIT | Redução do CSS no build (dev) |

As dependências do `@govbr-ds/core` (`@popperjs/core`, `flatpickr`) não são usadas e não entram na saída.

## 11. Estratégia de Testes
- **Unidade (motor):**
  - `acaoDoCenario` (variações de redação);
  - `ligarFluxos` (sucesso, vários erros, sem sucesso, destino por "exibe **tela**", override);
  - `classificarSelo` (cada grupo e "Não autorizada" antes de "Autorizada");
  - esquema (`logo_claro`, `captura.celular`, overrides novos);
  - avisos `kit/cor-ignorada` e `identidade/logo-contraste`.
- **Integração (motor, com navegador):**
  - exemplo no `govbr`: os mesmos `id` e `data-testid` do `proprio` em todas as páginas (RN-82); zero pedidos de rede;
    axe a 1440 e a 390 em todas as páginas e estados; nenhuma rolagem horizontal a 390;
  - `govbr.css` < 120 KB;
  - captura com `celular`: 7 `-celular.png` a 390 px; segunda execução sem mudança;
  - **compatibilidade:** os PNGs de referência do `proprio` continuam dentro da tolerância, sem atualizar a referência;
  - fluxo no navegador (Playwright): no Contato, "Enviar" leva ao sucesso; com "Simular erro", leva ao erro 1 e depois ao
    erro 2; "Voltar" retorna; uma ação sem destino mostra o aviso; abrir com `#captura` esconde a barra;
  - janela sobre o portal: override no exemplo, fundo `inert` e foco no título;
  - selo nas colunas Situação do exemplo, com a cor esperada e o texto presente.
- **Documentação:** "Simular erro" e Celular na moldura do protótipo embutido, nos dois modos.
- **Programa (E2E):** trocar o kit para gov.br e salvar; capturar com celular; prévia em celular; projeto novo com `govbr`.
- **Massa:** o exemplo fictício ganha o override `janela_sobre` numa tela e a coluna Situação com LOV (já existe na
  listagem); uma cópia de teste troca o kit para `govbr`.

## 12. Arquivos a Criar / Alterar

- **Criar:**
  - `packages/motor/kits/govbr/**`;
  - `packages/motor/kits/comum/prumo-prototipo.js`, substituindo o do `proprio`;
  - `packages/motor/scripts/govbr-css.mjs`;
  - `packages/motor/src/inferencia/{fluxo,selo}.ts`;
  - `kits/{proprio,govbr}/layouts/janela-sobre.njk`;
  - testes em `packages/motor/test/{unit,integracao,docs}` e no E2E do programa.
- **Alterar:**
  - `modelo/tipos.ts`, `modelo/montar.ts`, `config/esquema.ts` e `config/novo.ts`;
  - `render/{gerar,recursos,tokens-css}.ts` e `navegador/capturar.ts`;
  - `executar.ts`, `docs/gerar.ts` e `web/`;
  - CLI (`--celular`);
  - programa (Configuração, Protótipos, canais);
  - `kits/proprio/{estilo.css,macros.njk}` (selo e celular);
  - `package.json` do motor (dependências e `build`) e `.gitignore`;
  - `COMPONENTS.md`, `MEMORY.md` e README.

## 13. Ordem de Implementação
1. Modelo: `fluxo.ts`, `selo.ts`, `Estado.acao`, `Acao.fluxo`, layout `janela-sobre`, testes de unidade.
2. Configuração: chaves novas, avisos, projeto novo em `govbr`.
3. `prumo-prototipo.js` comum, barra e fluxo no kit `proprio` (sem mudar PNG); selo e janela sobre o portal no `proprio`.
4. Script do CSS do gov.br e kit `govbr` (todos os layouts), com a Raleway.
5. Captura em celular e o CSS responsivo do `proprio` a 390.
6. Documentação: celular e simular erro; programa e CLI.
7. Testes de integração, E2E e axe; README e componentes.

## 14. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| O PurgeCSS remove classes usadas em estados (`.is-invalid`, `.active`) | Média | Médio | `safelist` explícita e teste de axe e estilo em todos os estados |
| A barra ou o selo mudam os PNGs do `proprio` | Média | Alto | `#captura` esconde a barra; o selo só onde há LOV de situação; o teste de referência é o critério |
| Redação dos cenários varia ("clica no botão", "seleciona a opção") | Alta | Médio | Regex tolerante, testes com variações e o achado `prototipo/acao-sem-destino` para o resto |
| Raleway difere da Rawline | Certa | Baixo | Decisão do usuário; documentado no README |
| A tabela do gov.br não cabe a 390 px | Média | Baixo | Região rolável (FA-05) e teste de rolagem horizontal da página |
