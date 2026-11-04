# 0001 — Desenho Técnico

**Autor:** arc-lider (Momento A) · **Data:** 2026-11-03 · **Spec:** [01-specification.md](01-specification.md)

## 1. Resumo da Abordagem

Um pacote `@prumo/motor` em TypeScript faz tudo em etapas puras: **ler** (configuração e
features com o parser oficial do Gherkin), **indexar** (posição Pirilampo de cada cenário e
códigos RNG/LOV/MSG/E-mail), **modelar** (uma `Tela` por feature com `@prototipo`, com a
inferência registrando os sinais de cada decisão), **sobrepor** (`telas.overrides.yml`),
**verificar** (achados com `arquivo:linha`), **renderizar** (Nunjucks com o kit `proprio`, CSS gerado
dos tokens) e **capturar** (porta `Navegador` com adaptador `playwright-core` que usa Edge, Chrome
ou o Chromium de `PRUMO_CHROMIUM`).

A CLI `@prumo/cli` (commander) só traduz argumentos em chamadas ao motor e o resultado em texto,
JSON e código de saída. Toda saída é determinística: ordenação por caminho e posição, dados
fictícios semeados por hash, nenhum horário gravado.

Validado antes do desenho, nos arquivos reais do piloto:
- `@cucumber/gherkin` 42.0.1 leu os 44 `.feature` sem erro (BOM, `# language: pt`, descrições com
  Markdown e `![Image](…)` no cenário `@prototipo` ficam em `scenario.description`; comentários
  `# Módulo/Tipo/Fluxo` vêm em `gherkinDocument.comments` com a linha).
- `playwright-core` 1.64.1 abriu Edge 156 e Chrome 156 desta máquina (`channel`), com captura de
  página inteira e PDF, em ~0,9 s por inicialização.
- A numeração dos links foi conferida na saída do Pirilampo (`data-target="#scenario-N"`).

## 2. Alternativas Consideradas

| Tema | Escolhida | Alternativa | Por que não |
|---|---|---|---|
| Parser | `@cucumber/gherkin` | Regex próprio (como o Pirilampo antigo) | Frágil com Esquema/Exemplos, idiomas e descrições; o oficial já passou nos 44 arquivos |
| Templates | Nunjucks (macros por componente, herança de casca) | Funções TS com template string (estilo `comum.py`) | Ganha tipagem, mas mistura HTML com lógica e dificulta o kit `govbr` e overrides de template por projeto (fase 4) |
| CSS do kit | CSS gerado dos tokens + `css_adicional` | Copiar o `vc.css` do piloto para o Prumo | O `vc.css` é do projeto (repositório público não pode conter); `css_adicional` dá a fidelidade localmente |
| Navegador | `playwright-core` + `channel: msedge/chrome` ou `PRUMO_CHROMIUM` | Playwright completo (baixa Chromium); Puppeteer | Download de ~150 MB e rede; Puppeteer não tem `channel` para Edge com a mesma API |
| Inferência | Tabela de regras puras, cada uma `(contexto) → decisão + sinal` | Classificação por IA | Pedido exige base determinística; IA só na fase 5 e via override |
| Estados | Um HTML por estado | Um HTML com estados alternáveis por JS | Captura e diff por estado ficam triviais; a navegação entre estados (fase 4) usa links |
| Configuração | `yaml` (Document API) + validação própria com mensagens em português | JSON Schema + ajv | Mensagens do ajv são técnicas e em inglês; o esquema é pequeno |

## 3. Reutilização

`COMPONENTS.md` está vazio (primeira feature). Do gerador Python do piloto (não versionado) são
**reescritos** em TS, sem copiar texto do projeto:
- Algoritmo de dígito verificador de CPF/CNPJ (`_dv`) — estendido para CNPJ alfanumérico.
- Vocabulário de componentes: casca com trilho e menu por perfil, migalha + topo, `campo`, `selecao`,
  `texto_longo`, `tabela` com `data-rotulo`, `paginacao`, `botao`, `aviso`, `situacao`, `dados` (dl).
- Grade de 12 colunas (`c3`, `c4`…) para larguras de campo.
- Captura: viewport 1440 × 900, `document.fonts.ready` antes de `screenshot({ fullPage: true })`.

Componentes novos reutilizáveis são registrados em `COMPONENTS.md` na Etapa 5.

## 4. Modelo de Dados

Tipos em `packages/motor/src/modelo/tipos.ts` (serializados em `modelo/telas.json`, camelCase):

```ts
type Origem = { arquivo: string; linha: number; coluna?: number };   // arquivo relativo às specs, com '/'
type Referencia = { codigo: string; tipo: 'RNG'|'LOV'|'MSG'|'EMAIL'; titulo: string;
                    endereco: string; posicao: number; origem: Origem; usadaEm: Origem[];
                    opcoes?: string[]; texto?: string };               // opções da LOV; texto da MSG
type Sinal = { regra: string; descricao: string; origem?: Origem };  // ex.: 'RN-14', 'regra LOV-06 → seleção'
type Componente = 'texto'|'mascara'|'email'|'tel'|'data'|'valor'|'selecao'|'confirmacao'
                | 'caixa'|'captcha'|'arquivos'|'texto-longo'|'leitura';
type Campo = { id: string; nome: string; rotulo: string; grupo: string; editavel: boolean;
               obrigatorio: boolean; regras: RefCitada[]; regraTexto?: string; componente: Componente;
               mascara?: string|string[]; opcoes?: string[]; confirma?: string; exemplo?: string;
               largura?: string; secao?: string; ajuda?: string; sinais: Sinal[]; origem: Origem };
type RefCitada = { codigo?: string; rotulo: string; destino: string; origem: Origem };
type Acao = { id: string; rotulo: string; primaria: boolean; destino?: string /* id da tela */;
              origem: Origem };
type Estado = { id: string; tipo: 'padrao'|'erro'|'sucesso'|'vazio'|'sem-permissao';
                cenario?: { posicao: number; titulo: string }; mensagem?: { codigo: string; texto: string;
                local: 'topo'|'campo'; campo?: string }; exemplos: Record<string,string>; };
type Tela = { id: string; modulo: string; titulo: string; tipo: 'Consulta'|'Manual'|'Integração'|null;
              layout: 'listagem'|'formulario'|'formulario-etapas'|'leitura'|'api';
              casca: string; perfil: string|null; fluxo?: string;
              narrativa?: { como: string; quero: string; para: string };
              filtros: Campo[]; campos: Campo[]; colunas: Campo[]; secoes: { titulo: string; campos: string[] }[];
              acoes: Acao[]; estados: Estado[]; api?: { metodo: string; caminho: string };
              prototipo: { imagem?: string; html?: string; origem: Origem };
              sinais: Sinal[]; origem: Origem };
type ModeloTelas = { versaoModelo: '1.0.0'; projeto: { nome: string; versao: string };
                     telas: Tela[]; referencias: Referencia[] };
```

Estruturas internas (não serializadas): `ArquivoFeature { caminho, pasta, nome, doc: GherkinDocument,
filhos: Filho[] }` e `Filho { posicao, tipo: 'Contexto'|'Cenário'|'Esquema', titulo, tags, passos, descricao, linha }`;
`Indice { porEndereco: Map<string, Filho>, porCodigo: Map<string, Referencia[]>, porFeature: Map<string, ArquivoFeature> }`.

## 5. Contratos de API

### 5.1 API do motor (`packages/motor/src/index.ts`)

```ts
carregarProjeto(specs: string, opcoes?: { projeto?: string }): Promise<{ config: ConfigProjeto; achados: Achado[]; fonte: 'projeto.yml'|'config.properties'|'padrao' }>
migrarConfig(specs: string, opcoes?: { forcar?: boolean }): Promise<{ caminho: string }>
lerEspecificacoes(specs: string): Promise<{ arquivos: ArquivoFeature[]; indice: Indice; achados: Achado[] }>
carregarOverrides(specs: string): Promise<{ overrides: Overrides; achados: Achado[] }>
montarModelo(entrada: { arquivos; indice; config; overrides }): { modelo: ModeloTelas; achados: Achado[] }
verificar(entrada: { arquivos; indice; modelo; config; specs }): Achado[]
gerarPrototipos(modelo: ModeloTelas, config: ConfigProjeto, opcoes: { specs: string; saida: string; recorte?: Recorte }): Promise<PaginaGerada[]>
capturar(paginas: PaginaGerada[], navegador: Navegador, opcoes: { specs: string; largura: number; forcar?: boolean }): Promise<ResultadoCaptura[]>
compararPng(opcoes: { referencia: string; gerados: string; saida: string }): Promise<RelatorioComparacao>
executar(opcoes): Promise<ResultadoExecucao>          // orquestra os passos acima (usado pela CLI e, depois, pelo desktop)

interface Navegador { abrir(): Promise<void>; capturar(url: string, o: { largura: number; altura?: number }): Promise<Buffer>;
                      pdf(url: string, o: OpcoesPdf): Promise<Buffer>; axe(url: string): Promise<ResultadoAxe>; fechar(): Promise<void> }
type Achado = { severidade: 'erro'|'aviso'|'info'; codigo: string; arquivo: string; linha?: number; coluna?: number; mensagem: string; sugestao?: string }
type PaginaGerada = { tela: string; estado: string; arquivo: string /* absoluto */; destinoPng?: string }
```

### 5.2 CLI

```
prumo verificar     [--specs] [--projeto] [--formato texto|json] [--avisos-quebram]
prumo gerar         [--specs] [--projeto] [--saida] [--modulo …] [--tela …]
prumo capturar      [--specs] [--projeto] [--saida] [--modulo …] [--tela …] [--largura] [--forcar]   # gera e captura
prumo comparar-png  [--specs] [--saida]           # PNGs atuais (referência) × gerados
prumo migrar-config [--specs] [--forcar]
```

Códigos de saída: 0 ok · 1 verificação com erro · 2 erro de uso · 3 inesperado. `--formato json`
escreve só JSON no stdout (esquema na spec 9.4).

## 6. Arquitetura da Solução

```
packages/motor/src/
  util/        texto.ts (normalizar: sem acento, minúsculas), hash.ts (FNV-1a), caminhos.ts (dentroDe, relativoPosix), erros.ts (ErroPrumo)
  config/      esquema.ts (padrões + validação), projeto-yml.ts, properties.ts, migrar.ts, overrides.ts
  parser/      ler.ts (descobrir .feature em ordem, parse, erro de sintaxe → Achado),
               filhos.ts (posição Pirilampo), metadados.ts (# Módulo/Tipo/Fluxo/Tela/Perfil/Seção),
               tabelas.ts (definição × exemplo, grupo pelo <Parâmetro> do passo), links.ts (extrair [rótulo](#/scenario/…) e #!/feature/…),
               markdown.ts (markdown-it com lista branca), indice.ts
  modelo/      tipos.ts, montar.ts, serializar.ts (chaves ordenadas)
  inferencia/  regras.ts (uma função por RN-10…RN-21, cada uma devolve decisão + Sinal), layout.ts, campos.ts, acoes.ts, estados.ts, aplicar-overrides.ts
  dados/       documentos.ts (cpf, cnpj numérico/alfanumérico, validar), mascara.ts (aplicar/conferir), ficticios.ts (semeado)
  verificacao/ verificar.ts + regras/*.ts (uma por código de achado), formatar.ts (texto/JSON)
  render/      ambiente.ts (nunjucks, autoescape, filtros), tokens-css.ts, contraste.ts, recursos.ts (copiar fontes/logo/css_adicional), gerar.ts
  kits/proprio/ base.njk, casca-publica.njk, casca-autenticada.njk, macros/{campo,selecao,tabela,paginacao,botao,aviso,acoes,api}.njk,
               layouts/{listagem,formulario,formulario-etapas,leitura,api}.njk, estilo.css.njk, indice.njk (navegação do protótipo)
  navegador/   navegador.ts (interface), playwright.ts (resolve executável), localizar.ts
  comparacao/  png.ts (pngjs + pixelmatch, relatório HTML)
  executar.ts, index.ts
```

**Fluxo de erro.** Problema do requisito → `Achado` (nunca lança). Falha de uso → `ErroPrumo(codigo, mensagem)`
com códigos `CLI-01…CLI-05` da spec; a CLI imprime a mensagem e sai com 2. Exceção não prevista →
mensagem curta + pilha com `--verboso`, saída 3.

**Inferência — ordem e regras de decisão.**
1. Grupos de tabelas (RN-06): o nome vem do último `<Parâmetro>` no texto do passo; sem parâmetro,
   `Campos`. Mesma tabela de definição repetida em vários cenários: a 1ª ocorrência define a ordem;
   as seguintes completam atributos vazios.
2. Destino de cada grupo: `Filtros` → `tela.filtros`; `Colunas` → `tela.colunas`; `Campos` →
   `colunas` se a tela é listagem e todos os itens têm `Editável = N`, senão `campos`; `Blocos` → `secoes`;
   outros grupos (`Mensagens`, `Indicador`, `Menu`, `Perfil`) → bloco de dados de leitura e `info` no modelo.
3. Layout (RN-10…RN-12, `# Tela:` vence, override vence tudo).
4. Componente de cada campo, primeira regra que casa, em ordem: override → `Editável=N` (RN-13) →
   LOV (RN-14) → confirmação (RN-16) → caixa (RN-17) → captcha (RN-18) → arquivos (RN-19) →
   máscara/tipo pelo nome (RN-15) → `texto` com aviso `inferencia/sem-regra` (FA-07) apenas quando
   o campo é editável e nenhuma regra disse nada.
5. Ações (RN-21) por regex sobre o texto dos passos: `(aciona|clica|seleciona)\s+(?:a opção|o botão|em)\s+\*\*([^*]+)\*\*`.
6. Estados (RN-20): `padrao` (fluxo principal); por cenário que cita `MSG-xx`: `erro-<posição>` ou
   `sucesso-<posição>` (classificação pelo texto da MSG: `/sucesso|realizad|enviad|salv|conclu/i` → sucesso;
   `projeto.yml > mensagens.<código>: erro|sucesso|aviso` sobrepõe); `vazio` para listagem; `sem-permissao`
   quando o passo cita "não permitid" ou "sem permissão".
7. Overrides (9.2 da spec) por último.

**Posição Pirilampo.** `filhos(feature)` percorre `feature.children` na ordem; cada `background`
ou `scenario` (inclusive Esquema) recebe `posicao = índice`. `rule` (não usado hoje) é achatada na
mesma contagem e gera `info`. Endereço = `{pasta}_{nome sem .feature}` com a pasta **imediata**
do arquivo (o Pirilampo não inclui a raiz).

## 7. Integrações Externas

| Fronteira | Adaptador | Duplo para teste |
|---|---|---|
| Chromium | `navegador/playwright.ts`: ordem `PRUMO_CHROMIUM` → `channel: 'msedge'` → `channel: 'chrome'` → `ErroPrumo('CLI-05')` | `NavegadorGravador` (grava URLs e devolve PNG 1×1) para testes que não precisam de pixel; testes de captura e axe usam o Chromium real (marcados `@navegador`, pulados se nenhum for encontrado, obrigatórios no CI) |
| Sistema de arquivos | `node:fs/promises` | Pasta temporária por teste (`fs.mkdtemp`) — sem mock |

## 8. Eventos / Jobs / Filas

Não se aplica. Captura em paralelo com até 4 páginas no mesmo navegador (`p-limit` não é necessário:
fila simples com `Promise` em lote).

## 9. Cache e Performance

- Cada `.feature` é lido e parseado uma vez por execução; o índice é montado em uma passada.
- Nunjucks com `noCache: false` e templates pré-compilados na inicialização.
- PNG: compara bytes com o arquivo existente antes de gravar (FA-09).
- Meta: verificar < 2 s, gerar < 5 s, capturar < 60 s no piloto (medido no 05-test-report).

## 10. Segurança e LGPD

- `autoescape: true` no Nunjucks; trechos de Markdown passam por `markdown.ts` (markdown-it com `html: true`
  seguido de filtro de lista branca de tags e atributos; `href` só `#`, relativo ou `https:`; `src` só relativo).
- `caminhos.dentroDe(base, alvo)` em toda escrita; `destinoPng` precisa estar em `specs/<módulo>/`.
- CSP nas páginas: `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; script-src 'self'`.
- Nenhuma chamada de rede no motor (teste garante: `navegador` roda com `route('**', abort)` para hosts ≠ `file://`).
- Dados fictícios: `ficticios.ts` só combina listas fixas de palavras genéricas + sufixo; CPF/CNPJ gerados
  de semente; e-mails sempre em domínio `exemplo.com.br`.

## 11. Frontend (páginas geradas)

Saída de `gerar` (padrão `saida/prototipos/`):

```
saida/prototipos/
  index.html                            # navegação do protótipo: módulos → telas → estados (fora da captura)
  _recursos/prumo.css  fontes/*.woff2  logo.<ext>  adicional.css
  <módulo>/<tela>/padrao.html | erro-3.html | vazio.html | …
modelo/telas.json                       # ao lado da saída: saida/modelo/telas.json
```

**IDs e `data-testid`** (`{tela}` = slug do id da tela, `{campo}` = slug do nome):

| Elemento | `id` | `data-testid` | ARIA |
|---|---|---|---|
| Campo editável | `{tela}-{campo}` | `{tela}-campo-{campo}` | `label[for]`, `aria-required="true"` se obrigatório, `aria-invalid` + `aria-describedby="{id}-erro"` no estado de erro |
| Valor só leitura | `{tela}-{campo}` | `{tela}-valor-{campo}` | `output` com `label[for]` |
| Seleção (LOV) | `{tela}-{campo}` | `{tela}-selecao-{campo}` | idem campo |
| Botão de ação | — | `{tela}-acao-{acao}` | `button type="button"`; ícone com `aria-hidden` |
| Tabela de resultado | — | `{tela}-tabela` | `caption` (visualmente oculto), `th scope="col"`, `td data-rotulo` |
| Paginação | — | `{tela}-paginacao` | `nav aria-label="Paginação"`, `aria-current="page"` |
| Resumo de erros | `{tela}-erros` | `{tela}-resumo-erros` | `role="alert"`, `tabindex="-1"`, links para os campos |
| Mensagem de sucesso | — | `{tela}-mensagem` | `role="status"` |
| Estado vazio | — | `{tela}-vazio` | `role="status"` |
| Menu do perfil | — | `casca-menu` | `nav aria-label="Menu do perfil"`, `aria-current="page"` |
| Migalha | — | `casca-migalha` | `nav aria-label="Migalha"` |

Regiões: `header`, `nav`, `main` (com `h1` único), `footer`. Idioma `pt-BR`. Foco visível
(`outline 3px` na cor primária com deslocamento). Contraste conferido em `contraste.ts` para os pares
texto/fundo, texto do menu/menu, primária/branco; par abaixo de 4,5:1 → aviso `identidade/contraste`.

## 12. Estratégia de Testes desta Feature

(Adaptação vinculante da seção 11 da arquitetura; detalhes em `03-acceptance-criteria.md`.)
- **Integração do motor (sem mock de módulos internos):** pipeline completo sobre
  `exemplos/exemplo-ficticio/` e sobre fixtures geradas pela fábrica em pasta temporária; confere
  `telas.json`, HTMLs e PNGs gravados no disco.
- **Unitários (só funções puras):** posição Pirilampo, links, metadados, máscaras, CPF/CNPJ, regras
  de inferência isoladas, contraste, `config.properties`.
- **CLI:** processo real (`node apps/cli/dist/main.js`) com códigos de saída e JSON.
- **Páginas:** axe-core em todas as telas e estados do exemplo (Chromium real); seletores por `data-testid`.
- **Regressão visual:** PNGs do exemplo comparados com referência aprovada em `exemplos/…/referencia/`
  (tolerância 0,5% de pixels, para variação de antialiasing entre SOs).
- **Determinismo:** duas execuções → `telas.json` e HTML idênticos byte a byte.
- **Massa de dados:** projeto `exemplo-ficticio` (módulos público, cadastro, gestão e API; regras, LOVs,
  mensagens e e-mails) + `fabricaFeature()` para casos plantados (link quebrado, ref inexistente, máscara
  errada, sintaxe inválida, duplicada).
- **Piloto (manual e no relatório):** rodar no Vale-Cultura no WSL, gerar o `comparar-png` e anexar o
  resumo ao 05-test-report (sem versionar o material).

## 13. Arquivos a Criar / Alterar

Criar: todos os módulos da seção 6; `apps/cli/src/{main,comandos/*,saida}.ts`; `exemplos/exemplo-ficticio/**`
(features, `projeto.yml`, `telas.overrides.yml`, logo fictício SVG→PNG, `referencia/*.png`);
`packages/motor/test/{unit,integracao,fabricas}/**`; `apps/cli/test/**`.
Alterar: `packages/motor/package.json` (dependências), `apps/cli/package.json`, `.github/workflows/ci.yml`
(instalar Chromium no Ubuntu e rodar testes de navegador), `specs/COMPONENTS.md`, `README.md`.

Dependências novas (versões exatas): `@cucumber/gherkin@42.0.1`, `@cucumber/messages@34.2.1`, `yaml@2.9.1`,
`nunjucks@3.2.4` (+ `@types/nunjucks`), `markdown-it@15.0.3` (+ tipos), `playwright-core@1.64.1`,
`axe-core@4.14.0`, `pngjs@7.0.0`, `pixelmatch@8.0.0`, `@fontsource/jost@5.3.0`,
`@fontsource/atkinson-hyperlegible@5.3.0`.

## 14. Ordem de Execução Recomendada

1. `util/`, `dados/` (CPF/CNPJ/máscaras) + unitários.
2. `config/` (yml, properties, migrar, overrides) + unitários.
3. `parser/` (ler, filhos, metadados, tabelas, links, índice) + unitários; rodar no piloto.
4. Exemplo fictício + fábrica de features.
5. `modelo/` + `inferencia/` + integração (telas.json do exemplo, determinismo).
6. `verificacao/` + integração com casos plantados; rodar no piloto e registrar a lista.
7. `render/` + `kits/proprio` + navegação do protótipo.
8. `navegador/` + `capturar` + axe; referência visual do exemplo.
9. `comparacao/png`; CLI completa; CI.
10. Piloto: `projeto.yml` no WSL com tokens Cobalto e `css_adicional` → `vc.css`; `comparar-png`; overrides
    e regras novas para as diferenças.

## 15. Riscos Identificados

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Equivalência visual com telas feitas à mão é limitada (layout de janela sobre o portal, larguras, dados ricos) | Alta | Médio | `css_adicional`, overrides por tela, relatório `comparar-png` com % de diferença por tela; critério da fase é "listagens e formulários simples equivalentes" |
| Diferença de renderização de fontes entre Windows, Linux e Docker | Média | Baixo | Fontes embutidas; referência visual gerada no CI (Linux) e tolerância |
| Bold como ação × bold como destaque | Média | Baixo | Regex restrita a verbos de acionamento; override `acoes` |
| Rótulo de link divergente gerar muitos erros no piloto (RN-32) | Média | Baixo | Código separado; pode ser rebaixado por `verificacao.severidades` |
| TypeScript 7 (compilador nativo) com incompatibilidade em tipos de terceiros | Baixa | Médio | `skipLibCheck`; recuo para TS 5.9 se necessário, registrado no MEMORY |
| Caminhos com acento/espaço no Windows/WSL (`\\wsl.localhost`) | Média | Médio | Testes com nomes acentuados; `pathToFileURL` em todas as URLs |

## 16. Pesquisa Realizada

- Sondagem do `@cucumber/gherkin` 42.0.1 nos 44 arquivos do piloto (0 erros; estrutura de `description`, `comments`, `dataTable`).
- Sondagem do `playwright-core` 1.64.1 com `channel: msedge` e `chrome` nesta máquina (Edge/Chrome 156).
- Saída do Pirilampo: índice `data-target="#scenario-N"` por arquivo (0 = Contexto, quando há).
- Gerador Python do piloto (`comum.py`, `telas_publicas.py`, `renderizar.mjs`) e `vc.css`: vocabulário de componentes, grade c1–c12, captura 1440 px.
- `DESIGN.md` (tokens Cobalto) e `PADROES_UI.md` do `novo-vale-cultura`.
- npm (2026-11-03): versões e licenças de todas as dependências da seção 13.
- IN RFB 2.229/2024: CNPJ alfanumérico — 12 primeiras posições alfanuméricas (valor = código ASCII − 48), DVs numéricos pelo módulo 11 com os mesmos pesos do CNPJ numérico.
