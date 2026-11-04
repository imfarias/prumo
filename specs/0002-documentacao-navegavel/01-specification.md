# 0002 — Documentação navegável (substitui o Pirilampo), busca, rastreabilidade, comparação de versões e PDF

**Status:** Especificado · **Data:** 2026-11-04 · **Fase do pedido:** 2 de 5

## 1. Contexto e Objetivo

Hoje a documentação dos requisitos é o `3 - Requisitos/html/index.html` gerado pelo Pirilampo:
AngularJS 1 e Bootstrap 3 num arquivo de 9 MB, com acentos quebrados (`P�gina`), busca por
sugestão de frases, sem conferência de links e com o protótipo só como imagem.

Esta feature gera, a partir das mesmas features e do mesmo `projeto.yml` da 0001, uma
documentação navegável que substitui a do Pirilampo:
- cada funcionalidade com o **protótipo clicável embutido** (as páginas da 0001) e seus estados;
- todos os **links antigos** (`#/scenario/…`, `#!/feature/…`) abrindo o destino certo;
- **busca** no texto todo;
- **rastreabilidade** de regras, listas e mensagens ("usada em" e Matriz);
- **comparação com a versão anterior** (pasta ou referência do Git), como o Pirilampo faz com a `master`:
  novo, alterado e removido marcados no menu, e o trecho alterado destacado;
- **PDF** por funcionalidade, por módulo ou de tudo.

Funciona offline, abre por `file://` e sai em dois modos: site em pasta ou arquivo único.

**Critérios do pedido atendidos aqui:** §8.8 (comparar com a versão anterior, parte da CLI), §8.4 (conteúdo e links do Pirilampo), §8.6 (busca em menos de
200 ms), §8.7 (PDF com capa, sumário e sem tabela cortada), §8.9 (acessibilidade da documentação) e §8.11 (offline).

## 2. Atores

| Ator | Uso |
|---|---|
| Analista de requisitos | Gera e consulta a documentação; usa `prumo servir` enquanto escreve |
| Fiscal / cliente (MinC) | Lê a documentação e os PDFs anexados à OS; abre links recebidos por e-mail |
| Desenvolvedor do sistema | Consulta regras, campos e protótipos; segue a rastreabilidade |
| Pipeline de CI | Gera o site e o PDF a cada mudança (integração com o CI do MinC fica na 0005) |

## 3. Pré-condições

- As da 0001 (features no formato atual; `projeto.yml` ou `config.properties`).
- Para o PDF: Chrome, Edge ou `PRUMO_CHROMIUM`, ou a imagem Docker.

## 4. Fluxo Principal

1. O analista roda `prumo docs --specs "3 - Requisitos/Especificações"`.
2. O Prumo faz os passos da 0001 (configuração, leitura, índice, modelo, verificação) e gera os protótipos.
3. Monta a documentação: página inicial, uma página por funcionalidade (inclusive regras e mensagens),
   página da Matriz, índice de busca e a navegação lateral pela árvore de pastas.
4. Grava em `3 - Requisitos/html/` (padrão, o mesmo lugar do Pirilampo), com `index.html` como entrada:
   - **site em pasta:** `index.html` + `recursos/` + `prototipos/`;
   - **arquivo único** (`documentacao.arquivo_unico: true` ou `--arquivo-unico`): só o `index.html`, com tudo
     embutido (CSS, JS, fontes, imagens e protótipos).
5. Imprime o resumo (funcionalidades, cenários, referências, tamanho, achados da verificação).
6. O leitor abre o `index.html` no navegador, sem servidor.

## 5. Fluxos Alternativos

| # | Situação | Comportamento |
|---|---|---|
| FA-01 | Link antigo `…/index.html#/scenario/{Pasta}_{Arquivo}/{n}` ou `#!/scenario/…` | Abre a funcionalidade e rola até o cenário `n` (posição Pirilampo), destacando-o |
| FA-02 | Link antigo `#!/feature/{Pasta}_{Arquivo}` ou `#/feature/…` | Abre a funcionalidade |
| FA-03 | Link antigo de busca `#!/feature/{Pasta}_{Arquivo}/{termo}` | Abre a funcionalidade e destaca o termo |
| FA-04 | Endereço inexistente (arquivo ou posição) | Página "Não encontrado" com o endereço pedido, a sugestão mais próxima (mesmo código RNG/LOV/MSG) e a busca |
| FA-05 | Clicar num link para RNG, LOV, MSG ou E-mail dentro de uma funcionalidade | Abre uma prévia com o título e o conteúdo do cenário, sem sair da página; botões **Abrir** e **Fechar**; Esc fecha e o foco volta ao link |
| FA-06 | Funcionalidade sem `@prototipo` (regras, mensagens) | Página sem bloco de protótipo; cada RNG/LOV/MSG mostra "Usada em" |
| FA-07 | Protótipo é um `.html` próprio (FA-12 da 0001) ou só uma imagem `.png`/`.jpg` | Embute o HTML próprio ou mostra a imagem com zoom |
| FA-08 | `prumo servir` | Site e protótipos em `http://127.0.0.1:4300`; ao salvar um `.feature`, o `projeto.yml` ou o `telas.overrides.yml`, regenera e recarrega a página aberta |
| FA-09 | `prumo pdf --saida especificacao.pdf [--modulo X] [--tela Y]` | PDF do recorte (seção 6.5) |
| FA-10 | Verificação com erros | A documentação é gerada mesmo assim; a página inicial mostra o resumo dos achados com link para cada um. `--estrito` faz sair com 1 |
| FA-11 | Funcionalidade com erro de sintaxe | Entra no menu marcada como "com erro"; a página mostra o erro com a linha e o texto bruto do arquivo |
| FA-12 | Busca sem resultado | Mensagem "Nenhum resultado para "{termo}"" e dica (sem acento, menos palavras) |
| FA-14 | `prumo docs --comparar <pasta-ou-ref>` (ou `documentacao.comparar_com`) | Compara com a versão anterior (seção 6.8). `<ref>` é uma branch, tag ou commit do repositório Git que contém as especificações (ex.: `master`, `v1.0`); `<pasta>` é uma cópia da pasta de especificações |
| FA-15 | Referência do Git inexistente ou pasta sem features | Erro de uso: "Versão anterior não encontrada: {valor}. Informe uma branch, tag ou commit, ou uma pasta de especificações." (código 2) |
| FA-16 | Specs fora de um repositório Git e `--comparar` com referência | Erro de uso explicando que só pasta é aceita fora do Git |
| FA-13 | Arquivo único passa de 50 MB | Aviso sugerindo o modo pasta (protótipos e imagens pesam) |

## 6. Telas

### 6.1 Estrutura comum (casca da documentação)

| Região | Conteúdo | Acessibilidade |
|---|---|---|
| Topo | Logo, nome e versão do projeto (`projeto.yml`); campo de busca; botão do menu (celular) | `header`; busca com `role="search"` e rótulo; atalho de teclado `/` ou `Ctrl+K` anunciado no rótulo |
| Menu lateral | Árvore de pastas (módulos → funcionalidades), "Regras e mensagens", "Matriz"; pasta atual aberta, funcionalidade atual marcada; cores `menu` e `menu_texto` | `nav aria-label="Funcionalidades"`, `aria-expanded` nas pastas, `aria-current="page"` |
| Conteúdo | Página atual | `main` com `h1` único; link "Pular para o conteúdo" |
| Rodapé | Órgão, versão, "Gerado pelo Prumo em" a versão da ferramenta (sem data, para ser determinístico) | `footer` |

Cores e fontes vêm dos mesmos tokens dos protótipos. Alto contraste: botão no topo que troca para
fundo escuro e texto claro, lembrado no navegador.

### 6.2 Página inicial

Nome, versão e órgão do projeto; números (funcionalidades, telas, cenários, regras, listas, mensagens);
lista de módulos com as funcionalidades; resumo da verificação (erros e avisos com link para o
arquivo:linha na página da funcionalidade).

### 6.3 Página de funcionalidade

| # | Bloco | Conteúdo | Observações |
|---|---|---|---|
| 1 | Cabeçalho | Título (nome sem prefixo numérico), código da funcionalidade, módulo, tipo, fluxo | Metadados dos comentários `# Módulo/Tipo/Fluxo` |
| 2 | Narrativa | COMO / QUERO / PARA, com o Markdown da descrição (negrito, `<br>`, `---`) | HTML sanitizado (lista branca) |
| 3 | Protótipo | Protótipo **clicável** embutido (iframe das páginas da 0001), seletor de estados (padrão, erro, vazio…), zoom (ajustar à largura / 100%), abrir em nova aba, imagem PNG | Aberto ou fechado conforme `documentacao.prototipo_aberto`; iframe com `title`; o seletor de estados é um grupo de botões com `aria-pressed` |
| 4 | Contexto | Passos com a palavra-chave destacada (Dado, Quando, Então, E, Mas), tabelas legíveis, links | |
| 5 | Cenários | Numerados na ordem do arquivo, com as tags (`@fluxo-principal`…) como etiquetas; cada um com **endereço próprio copiável** (botão "Copiar link") e âncora estável | O endereço copiado é o novo; o antigo continua aceito |
| 6 | Esquema do Cenário | Passos com `<parâmetros>` e a tabela de Exemplos | |
| 7 | Tabelas | `th` com `scope`, rolagem horizontal própria quando largas, sem cortar texto; células com Markdown e links | Tabelas de campos (Campo/Editável/Obrigatório/Regras) mostram Editável/Obrigatório como "Sim/Não" com ícone e texto |
| 8 | Rastreabilidade | Em regras/mensagens: "Usada em" por RNG/LOV/MSG (funcionalidade e cenário, com link). Em telas: "Regras e mensagens citadas" | Ver 6.4 |
| 9 | Fonte | Caminho do arquivo `.feature` e botão "Ver texto do arquivo" (Gherkin bruto) | |

### 6.4 Rastreabilidade e Matriz

- Em cada RNG, LOV, MSG e E-mail: lista "Usada em" com funcionalidade › cenário e link (vem de `referencias[].usadaEm` do modelo da 0001, agrupado).
- Página **Matriz**: linhas = funcionalidades com tela; colunas = RNG, LOV, MSG, E-mail (agrupadas por tipo);
  célula marcada quando a funcionalidade cita o código; filtro por texto e por tipo; cabeçalhos fixos ao rolar.
  Também em versão "por código" (lista) para leitores de tela e celular.

### 6.5 PDF

| Item | Regra |
|---|---|
| Recorte | Tudo (padrão), `--modulo` (repetível) ou `--tela` (repetível) |
| Capa | Logo, nome do projeto, versão, órgão, recorte ("Módulo 04 Cadastro Beneficiária") |
| Sumário | Módulos e funcionalidades com o número da página |
| Corpo | Mesmo conteúdo da página de funcionalidade, sem botões; protótipo como imagem (PNG do estado padrão) |
| Orientação | `documentacao.pdf`: retrato (padrão) ou paisagem; `--orientacao` sobrepõe |
| Tabelas | Nunca cortadas no meio de uma linha; cabeçalho repetido quando a tabela passa de página; tabela larga reduz a fonte até caber, sem perder conteúdo |
| Rodapé | Projeto, versão e "página X de Y" |
| Links | Links internos do PDF levam à página da funcionalidade/regra dentro do próprio PDF |

### 6.6 Comparação com a versão anterior

| Item | Regra |
|---|---|
| Unidade | Funcionalidade (arquivo `.feature`, identificado pelo endereço `{Pasta}_{Arquivo}`) e, dentro dela, cada filho (Contexto, Cenário, Esquema), pareado pelo **título** (não pela posição, que muda quando se insere um cenário) |
| Situações | **Nova** (só na versão atual), **Alterada** (texto diferente, ignorando espaços no fim da linha e BOM), **Removida** (só na anterior), **Sem mudança** |
| Menu | Ícone e texto ("nova", "alterada") ao lado da funcionalidade e da pasta que contém mudanças; nunca só cor |
| Página da funcionalidade | Faixa no topo "Alterada em relação a {versão anterior}" com: botão **Ver versão anterior** (lado a lado) e **Ver mudanças** (texto com inclusões e exclusões destacadas por palavra); cenários novos/alterados marcados; cenários removidos listados ao fim |
| Página "O que mudou" | Lista de funcionalidades novas, alteradas e removidas, com contagem de cenários mudados e link; regras/listas/mensagens mudadas destacadas à parte |
| Protótipo | Quando a tela mudou, opção de ver o protótipo da versão anterior (gerado da pasta/ref anterior) ao lado do atual |
| PDF | Opção `--so-mudancas` gera o PDF só com o que é novo ou alterado, com as marcações |
| Acessibilidade | Inclusões em `<ins>` e exclusões em `<del>`, com texto oculto "incluído"/"excluído"; contraste AA nas marcações |

### 6.7 Busca

| Item | Regra |
|---|---|
| Alcance | Títulos, narrativas, passos, células de tabela e exemplos de funcionalidades, cenários, regras, listas e mensagens |
| Resultado | Lista com o tipo (funcionalidade, cenário, regra…), o título e o trecho com o termo destacado; Enter abre o primeiro |
| Comportamento | Sem acento e sem caixa ("beneficiaria" acha "Beneficiária"); prefixo ("benef"); tolerância a um erro de digitação em palavras de 5+ letras; código exato ("RNG-06", "rng 6") vai direto ao item |
| Destaque | Ao abrir um resultado, a página rola até o trecho e destaca o termo |
| Teclado | `/` ou `Ctrl+K` foca a busca; ↑ ↓ navegam; Enter abre; Esc fecha | 
| Desempenho | < 200 ms por consulta com toda a especificação do Vale-Cultura (índice local) |
| Acessibilidade | Combobox ARIA (`role="combobox"`, `aria-expanded`, `aria-activedescendant`); total de resultados anunciado em `aria-live` |

### 6.8 Mensagens da CLI

| Código | Texto |
|---|---|
| DOC-01 | "Documentação gerada: {n} funcionalidades, {m} cenários, {k} referências · {tamanho} · {caminho}" |
| DOC-02 | "O arquivo único tem {tamanho}; para projetos com muitas imagens, prefira o modo pasta (sem --arquivo-unico)." |
| DOC-03 | "PDF gerado: {páginas} páginas · {caminho}" |
| DOC-04 | "Servindo em http://127.0.0.1:{porta} — Ctrl+C para parar." |
| DOC-05 | "A porta {porta} está ocupada; use --porta." |
| DOC-06 | "Comparado com {versão}: {n} novas, {m} alteradas, {k} removidas." |

## 7. Regras de Negócio

- **RN-50** Entrada da documentação: `<saida>/index.html`; saída padrão `<specs>/../html` (onde o Pirilampo grava hoje).
  O Prumo só apaga, na pasta de saída, os arquivos que ele mesmo gerou (lista em `<saida>/.prumo-arquivos`);
  se a pasta tiver um `index.html` que não é do Prumo (o do Pirilampo), substitui só o `index.html` e avisa.
- **RN-51** Rotas aceitas (todas no fragmento `#`): `/scenario/{end}/{n}`, `!/scenario/{end}/{n}`, `/feature/{end}`,
  `!/feature/{end}`, `!/feature/{end}/{termo}`, e as novas `!/f/{end}` (funcionalidade), `!/f/{end}/c/{n}` (cenário),
  `!/busca/{termo}`, `!/matriz`. `{end}` = `{Pasta}_{Arquivo sem .feature}`, comparado sem diferenciar a forma
  Unicode (NFC/NFD) e decodificando `%XX`.
- **RN-52** Endereço "Copiar link" do cenário: `index.html#!/f/{end}/c/{n}` (posição Pirilampo, a mesma dos links antigos).
- **RN-53** Conteúdo: toda funcionalidade, todo filho (Contexto, Cenário, Esquema), toda tabela e todo protótipo
  existentes na saída do Pirilampo aparecem na documentação (conferido por teste contra a lista extraída
  do `html/index.html` atual do piloto, localmente).
- **RN-54** Markdown e HTML das descrições e células: lista branca de tags (`strong`, `b`, `em`, `i`, `br`, `hr`, `code`,
  `a`, `p`, `ul`, `ol`, `li`, `img`, `table` simples) e atributos (`href` só `#…`, relativo ou `https:`; `src` só relativo
  ou `data:image`); o resto é escapado.
- **RN-55** Imagens referenciadas nas features (`![…](x.png)`) e o logo: modo pasta copia para `recursos/img/`;
  arquivo único embute em base64.
- **RN-56** Protótipos: modo pasta referencia `prototipos/<módulo>/<tela>/<estado>.html` (as páginas da 0001);
  arquivo único embute cada página como `srcdoc`/blob, com os recursos (CSS e fontes) inline.
- **RN-57** Nenhum recurso externo: sem CDN, sem fontes remotas, sem scripts de terceiros carregados da rede.
- **RN-58** Determinismo: mesma entrada → mesmos bytes (sem data/hora; ordem estável).
- **RN-59** A navegação funciona sem JavaScript no modo pasta para o essencial (cada funcionalidade é também uma
  página HTML própria com o conteúdo completo; o JS adiciona busca, prévias e o roteamento dos links antigos).
- **RN-60** PDF: o mesmo conteúdo, a partir das páginas da documentação com CSS de impressão; numeração de páginas
  e sumário com o número real de página de cada item.
- **RN-61** `prumo servir` escuta só em `127.0.0.1`; porta padrão 4300 (`--porta`); recarga por evento do servidor.
- **RN-62** Versão anterior por referência do Git: o Prumo lê os arquivos com `git show <ref>:<caminho>` (sem alterar o
  diretório de trabalho, sem checkout); o caminho é o da pasta de especificações relativo à raiz do repositório.
- **RN-63** Pareamento: funcionalidade pelo endereço; filho pelo título normalizado (sem acento/caixa); títulos repetidos
  pareiam pela ordem. Renomear o arquivo conta como removida + nova (com aviso "possível renomeação" quando o conteúdo é ≥ 80% igual).
- **RN-64** O diff é por palavra, sobre o texto renderizado de cada bloco (passos, tabelas, descrição), para não marcar
  realinhamento de tabela como mudança.
- **RN-65** A comparação não muda os endereços: os links (antigos e novos) apontam sempre para a versão atual.

## 8. Permissões

Não há perfis. Escreve só na pasta de saída da documentação, no arquivo PDF indicado e nas pastas da 0001.

## 9. Dados

### 9.1 `projeto.yml` (bloco `documentacao`, já aceito e preservado pela 0001)

| Campo | Tipo | Default | Uso |
|---|---|---|---|
| `arquivo_unico` | booleano | `false` | Modo de saída (`--arquivo-unico` / `--pasta` sobrepõem) |
| `pdf` | `retrato` \| `paisagem` | `retrato` | Orientação do PDF |
| `prototipo_aberto` | booleano | `true` | Bloco do protótipo começa aberto |
| `saida` | caminho | `../html` | Pasta da documentação (relativa às specs) |
| `comparar_com` | ref do Git ou caminho | nenhum | Versão anterior padrão (`--comparar` sobrepõe; `--sem-comparar` desliga) |
| `embutir_imagens` | booleano | do `config.properties` | Ignorado no modo pasta; no arquivo único sempre embute |

### 9.2 Saída (modo pasta)

```
html/
  index.html                     # entrada, roteamento dos links antigos, busca
  f/<Pasta>_<Arquivo>.html       # uma página por funcionalidade (navegável sem JS)
  matriz.html
  recursos/ prumo-docs.css  prumo-docs.js  busca.json  fontes/  img/
  prototipos/ …                  # saída da 0001
  .prumo-arquivos                # lista do que o Prumo gerou (para limpar com segurança)
```

### 9.3 Índice de busca

Gerado no build (sem servidor): documentos `{id, tipo, titulo, trecho, endereco, texto}` com o texto normalizado.

## 10. Requisitos Não-Funcionais

- Busca: < 200 ms por consulta com o Vale-Cultura inteiro (medido no navegador, 95º percentil de 50 consultas).
- `prumo docs` no piloto: < 10 s (inclui os protótipos); PDF de tudo: < 60 s.
- Tamanho: modo pasta sem limite; arquivo único do piloto menor que o atual (9 MB) sem os PNGs embutidos, e aviso acima de 50 MB.
- Acessibilidade: eMAG 3.1 e WCAG 2.1 AA; axe sem violações sérias ou críticas em todas as páginas da documentação;
  teclado em 100% das ações; foco visível; títulos em ordem; leitura no celular (até 390 px sem rolagem horizontal
  do texto; tabelas rolam dentro do próprio bloco).
- Funciona em `file://` no Edge, Chrome e Firefox atuais; JavaScript próprio sem framework, < 100 KB minificado
  além do índice de busca.
- Determinismo e offline como na 0001.

## 11. Dependências

- 0001 (motor, modelo, protótipos, navegador).
- MiniSearch 7.2.0 (MIT) para o índice; esbuild para empacotar o JS; markdown-it para as descrições; diff 9.0.0 (BSD-3) para a comparação.
- Git instalado, só quando `--comparar` recebe uma referência.
- Saída do Pirilampo do piloto (no WSL, só leitura) para o teste de equivalência de conteúdo e de links.

## 12. Fora de Escopo

- Publicação automática do site (GitLab Pages, servidor do MinC) e geração a cada MR — 0005.
- Programa de computador — 0003.
- Edição dos requisitos pela documentação.

## 13. Glossário Específico

- Prévia: janela com o conteúdo de uma regra/mensagem aberta a partir de um link, sem sair da página.
- Endereço novo: `#!/f/{end}/c/{n}`; endereço antigo: os formatos do Pirilampo (RN-51).
- Modo pasta / arquivo único: as duas formas de saída.

## 14. Dúvidas em Aberto

| # | Dúvida | Impacto | Proposta padrão |
|---|---|---|---|
| D-01 | ~~A comparação com a `master` é usada?~~ Resolvida: sim, entra na 0002 (seção 6.6) | — | — |
| D-02 | ~~Substituir o `html/index.html` do Pirilampo?~~ Resolvida: sim, mesmo caminho (RN-50) | — | — |
| D-03 | ~~Manter a prévia em janela?~~ Resolvida: sim (FA-05) | — | — |
| D-04 | Onde a documentação será publicada (GitLab Pages, servidor interno)? | Só 0005 | Gerar o site; publicação fica para a 0005 |
