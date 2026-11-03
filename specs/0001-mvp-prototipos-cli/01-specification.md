# 0001 — MVP: parser, modelo, verificação, protótipos (kit `proprio`) e captura pela CLI

**Status:** Especificado · **Data:** 2026-11-03 · **Fase do pedido:** 1 de 5

## 1. Contexto e Objetivo

Hoje as telas dos requisitos do Vale-Cultura são desenhadas por um gerador Python escrito à
mão, tela por tela. Toda tela nova, ou mudança no requisito, exige editar código, e o PNG
referenciado pelo cenário `@prototipo` fica desatualizado em relação ao texto.

Esta feature entrega o núcleo do Prumo pela linha de comando: ler as features no formato
atual, montar um modelo de telas, verificar os requisitos, gerar o HTML de cada tela com a
identidade do projeto e capturar os PNGs no mesmo caminho que o `@prototipo` já usa.

**Critério de sucesso da fase:** só com as features e um `projeto.yml` do Vale-Cultura, gerar as
41 telas que têm `@prototipo` e comparar lado a lado com os 42 PNGs atuais (41 telas + logo).
Listagens e formulários simples saem equivalentes; as diferenças viram overrides ou regras novas,
registradas num relatório.

## 2. Atores

| Ator | Como usa nesta fase |
|---|---|
| Analista de requisitos | Escreve a feature e roda `prumo gerar`/`prumo capturar` no terminal |
| Pipeline de CI | Roda `prumo verificar --formato json` e quebra o build com código de saída ≠ 0 |
| Mantenedor do projeto de requisitos | Escreve `projeto.yml` e `telas.overrides.yml` |

O analista "sem terminal" é atendido na feature 0003 (programa de computador).

## 3. Pré-condições

- Uma pasta de especificações no formato atual (uma pasta por módulo, `Regras_de_negócio/`,
  `Mensagem_de_Interface/`). Nenhum arquivo existente precisa ser alterado.
- `projeto.yml` **ou** `config.properties` na pasta de especificações (ou indicado por `--projeto`).
- Para `capturar`: Chrome ou Edge instalado, `PRUMO_CHROMIUM` definido, ou a imagem Docker.

## 4. Fluxo Principal

1. O analista roda `prumo gerar --specs "3 - Requisitos/Especificações"`.
2. O Prumo lê a configuração: `projeto.yml`; se não houver, `config.properties` (com aviso
   sugerindo `prumo migrar-config`).
3. Lê todos os `.feature` (em ordem de caminho), com o parser oficial do Gherkin.
4. Monta o índice de referências: cada cenário de cada arquivo recebe a posição usada pelo
   Pirilampo (seção 7, RN-02), e cada RNG, LOV, MSG e E-mail é identificado pelo título.
5. Monta o modelo: uma `Tela` por feature com `@prototipo` (seção 9). Aplica a inferência
   (RN-10 a RN-21) e depois o `telas.overrides.yml`.
6. Roda a verificação (seção 7, RN-30 a RN-42). Erros não impedem a geração, salvo erro de
   sintaxe no próprio arquivo, que tira só aquela tela da geração.
7. Grava `modelo/telas.json` e uma página HTML por tela e estado na pasta de saída
   (padrão `saida/prototipos/`), com CSS gerado dos tokens e fontes embutidas.
8. Imprime o resumo: telas geradas, estados, avisos de inferência e achados da verificação.
9. O analista roda `prumo capturar`; o Prumo abre cada página no Chromium a 1440 px de largura,
   captura a página inteira e grava em `Especificações/<módulo>/<tela>.png`.

## 5. Fluxos Alternativos

| # | Situação | Comportamento |
|---|---|---|
| FA-01 | `prumo verificar` sozinho | Só os passos 2–6; imprime os achados e sai com código 1 se houver erro, 0 caso contrário (avisos não quebram, salvo `--avisos-quebram`) |
| FA-02 | `--formato json` | Achados em JSON no stdout (seção 9.3); resumo em stderr |
| FA-03 | `--modulo X` / `--tela Y` | Gera/captura só o recorte; a verificação de links continua considerando todos os arquivos |
| FA-04 | Sem `projeto.yml` e sem `config.properties` | Usa padrões (kit `proprio` com tokens neutros) e avisa |
| FA-05 | `prumo migrar-config` | Cria `projeto.yml` a partir do `config.properties`, com comentários explicando cada campo; não sobrescreve um existente sem `--forcar` |
| FA-06 | Arquivo com erro de sintaxe Gherkin | Achado de erro com `arquivo:linha:coluna` e a mensagem do parser traduzida; os demais arquivos seguem |
| FA-07 | Nenhuma regra de inferência resolve um campo | Vira campo de texto simples e gera aviso `inferencia/sem-regra` |
| FA-08 | Nenhum navegador encontrado ao capturar | Erro de uso: "Nenhum Chrome, Edge ou Chromium encontrado. Instale o Edge ou o Chrome, defina PRUMO_CHROMIUM, ou rode pela imagem Docker." Código 2 |
| FA-09 | PNG existente igual ao novo | Não regrava (evita diff no Git); informa "sem mudança" |
| FA-10 | `prumo comparar-png --referencia <pasta>` | Gera `saida/comparacao/index.html` com o PNG atual e o gerado lado a lado e a porcentagem de diferença (critério da fase) |
| FA-11 | Feature sem `@prototipo` (regras, mensagens) | Não vira tela; entra só no índice de referências |
| FA-12 | `@prototipo` aponta para `.html` com o nome da feature | Usa o HTML existente como protótipo daquela tela (não gera); a captura usa esse HTML |

## 6. Tela(s)

Nesta fase não há interface gráfica do Prumo; as "telas" são (a) a saída da CLI e (b) os
protótipos gerados. As regras de como cada protótipo é montado estão na seção 7.

### 6.1 Saída da CLI (texto, exemplo ilustrativo)

```
Prumo 0.1.0 · Vale-Cultura 1.0 · kit proprio
41 telas · 97 estados · saída: saida/prototipos

Verificação: 3 erros, 12 avisos
  erro   05_Manter_Operadora/03_Operadora_Documentos.feature:31  link/cenario-inexistente  #/scenario/Regras_de_negócio_MINC_VALECULTURA_Regras_de_negócio/72 (o arquivo tem 0–58)
  aviso  01_Portal_Público/02_Portal_Lista_Operadoras.feature:1  fluxo/sem-principal  funcionalidade sem @fluxo-principal
  …
```

Formato de cada achado: `severidade  arquivo:linha  código  mensagem`. Caminhos relativos à
pasta de especificações. Cores só quando a saída é um terminal e `NO_COLOR` não está definido.

### 6.2 Opções da CLI

| # | Comando / opção | Tipo | Obrigatório | Default | Validação | Observações |
|---|---|---|---|---|---|---|
| 1 | `--specs <pasta>` | caminho | Não | pasta atual | precisa existir e conter `.feature` | todos os comandos |
| 2 | `--projeto <arquivo>` | caminho | Não | `<specs>/projeto.yml`, depois `<specs>/config.properties` | YAML válido conforme esquema | |
| 3 | `--saida <pasta>` | caminho | Não | `saida/prototipos` (gerar), pastas das features (capturar) | gravável | |
| 4 | `--modulo <nome>` | texto | Não | todos | nome de pasta existente | repetível |
| 5 | `--tela <nome>` | texto | Não | todas | nome de feature existente (sem `.feature`) | repetível |
| 6 | `--formato texto\|json` | enum | Não | `texto` | | `verificar` |
| 7 | `--avisos-quebram` | flag | Não | falso | | `verificar` |
| 8 | `--largura <px>` | inteiro | Não | `largura_captura` do projeto (1440) | 320–3840 | `capturar` |
| 9 | `--forcar` | flag | Não | falso | | `migrar-config`, `capturar` (regrava mesmo igual) |
| 10 | `--verboso` | flag | Não | falso | | log de depuração em stderr |

Códigos de saída: `0` sucesso; `1` verificação com erros; `2` erro de uso (pasta, YAML, navegador);
`3` falha inesperada.

### 6.3 Protótipo gerado (estrutura comum)

| Região | Conteúdo | Acessibilidade |
|---|---|---|
| Casca pública | topo com logo e nome do projeto, rodapé com órgão | `header`, `footer`, `nav aria-label="Principal"` |
| Casca autenticada | menu lateral do perfil (`perfis` do `projeto.yml`), conta no pé (`conta_no_pe`) | `nav aria-label="Menu do perfil"`, item atual com `aria-current="page"` |
| Topo da tela | migalha (módulo › tela), título = nome da funcionalidade sem o prefixo numérico e com `_` → espaço | `nav aria-label="Migalha"`, `h1` único |
| Conteúdo | filtros, formulário, tabela, ações (conforme inferência) | ver ARCHITECTURE seção 12 |
| Estados | um HTML por estado; seletor de estado só na navegação do protótipo (fora da área capturada) | `role="alert"` para mensagens de erro, `role="status"` para sucesso |

Container máximo `padroes.container_max` (1280 px). Paginação de `padroes.paginacao` (10) linhas.
`padroes.listas_sempre_em_tela: true` → listagens nunca em modal.

### 6.4 Mensagens da CLI

| Código | Texto |
|---|---|
| CLI-01 | "Pasta de especificações não encontrada: {caminho}." |
| CLI-02 | "Nenhum arquivo .feature em {caminho}." |
| CLI-03 | "projeto.yml inválido na linha {n}: {motivo}." |
| CLI-04 | "Usando config.properties. Rode `prumo migrar-config` para criar o projeto.yml e liberar as demais opções." |
| CLI-05 | FA-08 |
| CLI-06 | "{n} PNGs gravados, {m} sem mudança." |

## 7. Regras de Negócio

### Leitura e compatibilidade

- **RN-01** Aceitar BOM, `# language: pt`, `# encoding: utf-8`, Markdown e HTML simples nas
  descrições (`**negrito**`, `<br>`, `---`), `Contexto`, `Cenário`, `Esquema do Cenário` com
  `Exemplos`, tabelas de dados e parâmetros entre `<…>` no texto do passo. Nenhum arquivo precisa mudar.
- **RN-02** Posição de cenário (para links): índice **0-based** de cada filho da `Funcionalidade`
  (Contexto, Cenário, Esquema do Cenário), na ordem do arquivo. Endereço:
  `#/scenario/{Pasta}_{Arquivo sem .feature}/{posição}`. Conferido no Pirilampo atual:
  RNG-06 → `/6`, LOV-06 → `/53` (há Contexto em 0); MSG-01 → `/1` (o arquivo de mensagens não tem
  Contexto e o cenário "Mensagem de Interface" ocupa `/0`).
- **RN-03** Endereço de funcionalidade: `#!/feature/{Pasta}_{Arquivo sem .feature}`.
- **RN-04** Identificação de RNG, LOV, MSG e E-mail pelo título do cenário: `^(RNG|LOV|MSG)-\d+` e
  `^E-?mail-\d+` (sem distinção de maiúsculas), nos arquivos de `Regras_de_negócio/` e
  `Mensagem_de_Interface/` (ou nos caminhos de `projeto.yml > referencias`).
- **RN-05** Comentários de metadados lidos por linha antes do primeiro filho: `# Módulo:`,
  `# Tipo:` (`Consulta` | `Manual` | `Integração`), `# Fluxo:` e as anotações opcionais
  `# Tela:` (tipo de layout), `# Perfil:` e, dentro de um cenário, `# Seção:`.
- **RN-06** Tabela de definição: cabeçalho que contém `Campo` e pelo menos um de `Editável`,
  `Obrigatório`, `Regras`. O nome do grupo vem do parâmetro `<…>` no texto do passo
  (`<Filtros>`, `<Campos>`, `<Colunas>`, `<Blocos>`…). `S`/`N` (sem distinção de maiúsculas) viram booleanos;
  `-` ou vazio = sem regra.
- **RN-07** Tabela de exemplo: cabeçalho `Campo | Exemplo` (ou `Campo` + colunas de valores).
  Os exemplos do cenário `@fluxo-principal` preenchem a tela; os de outros cenários, os estados.
- **RN-08** Configuração: `projeto.yml` tem prioridade; `config.properties` é mapeado
  (`projectName`→`projeto.nome`, `projectVersion`→`projeto.versao`, `projectLogo`→`projeto.logo`,
  `menuColor`→`identidade.cores.menu`, `menuTextColor`→`identidade.cores.menu_texto`,
  `layoutPdf` PORTRAIT/LANDSCAPE→`documentacao.pdf` retrato/paisagem,
  `compilationType` FOLDER/FILE→`documentacao.arquivo_unico`, `htmlPanelToggle`→`documentacao.prototipo_aberto`;
  `embedImages` e `compilationArtifact` são lidos e guardados para a fase 2). Escapes de
  `.properties` (`\#`) são tratados.
- **RN-09** Imagem de protótipo existente: `.png`/`.jpg` com o nome da feature é a referência de
  comparação; `.html` com o nome da feature substitui a geração (FA-12).

### Inferência (determinística; mesma entrada → mesma saída)

Ordem de aplicação: tipo da tela → componentes de campo → ações → estados → override.

- **RN-10** `Tipo: Consulta` com `<Filtros>` e (`<Campos>` ou `<Colunas>`) → listagem: filtros,
  botões **Filtrar** (primário) e **Limpar**, tabela com paginação e estado vazio.
  `Tipo: Consulta` sem filtros → tabela ou cartões de leitura.
- **RN-11** `Tipo: Manual` com `<Campos>` editáveis → formulário com barra de ações, marca de
  obrigatório e resumo de erros no topo (no estado de erro). `# Tela: formulario-etapas` ou
  grupos `<Blocos>` → formulário em etapas com barra de etapas.
- **RN-12** `Tipo: Integração` → página de referência da API: método e caminho (do `# Fluxo:` ou do
  Contexto), parâmetros (tabelas de exemplo) e exemplo de resposta JSON montado dos exemplos.
- **RN-13** `Editável = N` → valor só leitura (texto) ou campo desabilitado preenchido.
- **RN-14** Regra `LOV-xx` → seleção; as opções são a 1ª coluna da tabela da LOV; LOV sem tabela →
  seleção com 3 opções fictícias "Opção 1 Exemplo"… e aviso `inferencia/lov-sem-tabela`.
- **RN-15** Nome do campo contém CNPJ, CPF, CEP, Fone/Telefone/Celular, Fax, E-mail, Data, Valor
  (sem acento e sem distinção de maiúsculas, palavra inteira) → campo com máscara de
  `projeto.yml > mascaras` e o `type` HTML adequado (`email`, `tel`, `date`, texto com máscara).
- **RN-16** Nome começa por "Confirme" ou "Confirmação de" → campo de confirmação ligado ao
  campo de mesmo nome sem o prefixo.
- **RN-17** Nome ou regra que contém "autoriz", "declar" ou "veracidade" → caixa de seleção com o texto da regra.
- **RN-18** "Código verificador" ou "captcha" → bloco de captcha ilustrativo.
- **RN-19** "Documento(s)", "Anexo(s)" ou regra que cita documentos (LOV de documentos) → lista de
  arquivos com botão "Enviar PDF".
- **RN-20** Cenário que cita `MSG-xx` → estado da tela com a mensagem: no campo, quando o passo
  cita um campo; senão, no topo. Estados extras: vazio (listagem sem resultado) e sem permissão
  (cenário que cita "não permitido"/"sem permissão").
- **RN-21** Ação = texto em negrito após "aciona a opção", "aciona o botão", "clica em" ou "seleciona
  a opção" (o negrito em outros contextos, como nomes de situação, não é ação). Primária = a do
  `@fluxo-principal`; demais secundárias. Se o texto da ação coincide com o título de outra
  funcionalidade (normalizado) ou o passo tem link `#!/feature/…`, a ação leva àquela tela.

### Dados

- **RN-22** Preenchimento: primeiro os Exemplos da feature; o que faltar sai de geradores fictícios
  semeados por `tela.id + campo` (determinísticos): CPF válido; CNPJ válido numérico ou
  alfanumérico (IN RFB 2.229/2024, conforme `dados_ficticios.cnpj`); nomes com o sufixo
  `dados_ficticios.sufixo_nomes` ("Exemplo"); datas fixas a partir de 2025-01-01; valores com 2 casas.
- **RN-23** Nenhum dado real: o gerador nunca usa listas de nomes de pessoas reais; usa combinações
  de palavras comuns + sufixo.

### Verificação (código do achado entre parênteses)

| # | Verificação | Severidade |
|---|---|---|
| RN-30 | Link para cenário inexistente ou posição fora do intervalo (`link/cenario-inexistente`) | erro |
| RN-31 | Link para funcionalidade inexistente (`link/feature-inexistente`) | erro |
| RN-32 | Texto do link difere do título do cenário de destino, ex. `[RNG-06](…/7)` (`link/rotulo-divergente`) | erro |
| RN-33 | RNG, LOV, MSG ou E-mail citado e não definido (`ref/inexistente`) | erro |
| RN-34 | Definido e nunca citado (`ref/nao-usada`) | aviso |
| RN-35 | Código duplicado (`ref/duplicada`) | erro |
| RN-36 | Campo editável sem regra quando `verificacao.exigir_regra_em_editavel: true` (`campo/sem-regra`) | aviso |
| RN-37 | Exemplo que não bate com a máscara do campo (`exemplo/mascara`) | erro |
| RN-38 | Funcionalidade de tela sem `@fluxo-principal` (`fluxo/sem-principal`) | aviso |
| RN-39 | Ação que leva a uma tela inexistente (`acao/destino-inexistente`) | erro |
| RN-40 | Tela sem cenário `@prototipo` (`prototipo/ausente`) | aviso |
| RN-41 | Imagem referenciada em `![…](…)` que não existe (`prototipo/imagem-inexistente`) | erro |
| RN-42 | Erro de sintaxe Gherkin (`sintaxe`) | erro |

Cada achado tem: severidade, código, arquivo, linha, coluna (quando houver), mensagem em
português e, quando possível, sugestão ("você quis dizer /7 (RNG-06)?").

## 8. Permissões

Não há perfis no Prumo. A CLI lê a pasta de especificações e escreve apenas em: pasta de saída,
`Especificações/<módulo>/<tela>.png` (`capturar`) e `projeto.yml` (`migrar-config`).

## 9. Dados (entrada e saída)

### 9.1 `projeto.yml` (campos usados nesta fase)

| Campo | Tipo | Obrigatório | Default | Validação |
|---|---|---|---|---|
| `projeto.nome` | texto | Sim | — | 1–80 caracteres |
| `projeto.versao` | texto | Sim | — | — |
| `projeto.orgao` | texto | Não | vazio | — |
| `projeto.logo` | caminho relativo às specs | Não | sem logo | arquivo existe (aviso se não) |
| `identidade.design_system` | `proprio` \| `govbr` | Não | `proprio` | `govbr` nesta fase → aviso e uso de `proprio` |
| `identidade.cores.*` | `#RRGGBB` | Não | paleta neutra | hex válido; contraste texto/fundo ≥ 4,5:1 (aviso) |
| `identidade.fontes.titulo/texto` | nome | Não | fonte do sistema | fontes embutidas disponíveis: Jost, Atkinson Hyperlegible; outras → aviso e fallback |
| `largura_captura` | inteiro | Não | 1440 | 320–3840 |
| `cascas.publica/autenticada` | objeto | Não | ver pedido | — |
| `perfis` | mapa perfil → itens de menu | Não | vazio | — |
| `modulos` | mapa pasta → `{casca, perfil}` | Não | `publica` | pasta existe (aviso) |
| `padroes.listas_sempre_em_tela`, `paginacao`, `container_max` | — | Não | `true`, 10, 1280 | — |
| `dados_ficticios.cnpj` | `numerico` \| `alfanumerico` | Não | `numerico` | — |
| `dados_ficticios.sufixo_nomes` | texto | Não | `Exemplo` | — |
| `mascaras` | mapa nome → máscara ou lista | Não | CNPJ, CPF, CEP, Fone do pedido | `#` = dígito, `A` = letra, `X` = alfanumérico |
| `verificacao.exigir_regra_em_editavel` | booleano | Não | `false` | — |

Campos de `documentacao`, `atualizacao` e `ia` são aceitos e preservados para as fases seguintes.
Chaves desconhecidas geram aviso, não erro.

### 9.2 `telas.overrides.yml`

Por tela (`id` = nome da feature): `layout`, `perfil`, `casca`, `secoes` (lista de
`{titulo, campos[]}`), `ordem` (lista de campos), e por campo `componente`, `largura`
(`1/4`…`1/1`), `rotulo`, `ajuda`, `opcoes`. Override de campo inexistente → aviso
`override/campo-inexistente`.

### 9.3 `modelo/telas.json` (contrato)

```json
{
  "versaoModelo": "1.0.0",
  "projeto": { "nome": "…", "versao": "…" },
  "telas": [{
    "id": "03_Portal_Lista_Beneficiárias",
    "modulo": "01_Portal_Público", "titulo": "Portal Lista Beneficiárias",
    "tipo": "Consulta", "layout": "listagem", "casca": "publica", "perfil": null,
    "narrativa": { "como": "…", "quero": "…", "para": "…" },
    "filtros": [{ "nome": "CNPJ", "editavel": true, "obrigatorio": false,
                  "regras": [{ "codigo": "RNG-06", "destino": "Regras_de_negócio_MINC_VALECULTURA_Regras_de_negócio/6" }],
                  "componente": "mascara", "mascara": "##.###.###/####-##",
                  "exemplo": "00.394.445/0001-01",
                  "sinais": ["nome contém CNPJ → máscara (RN-15)"],
                  "origem": { "arquivo": "01_Portal_Público/03_Portal_Lista_Beneficiárias.feature", "linha": 23 } }],
    "campos": [], "colunas": [],
    "acoes": [{ "rotulo": "Filtrar", "primaria": true, "destino": null, "origem": { "…": "…" } }],
    "estados": [{ "id": "padrao", "cenario": 1, "tipo": "sucesso" }, { "id": "vazio", "tipo": "vazio" }],
    "origem": { "arquivo": "…", "linha": 1 }
  }],
  "referencias": [{ "codigo": "RNG-06", "titulo": "Validação de CNPJ", "endereco": "…/6", "usadaEm": ["…"] }]
}
```

Chaves e listas em ordem estável; sem data/hora no arquivo.

### 9.4 Achados em JSON

`{ "resumo": { "erros": n, "avisos": n }, "achados": [{ "severidade", "codigo", "arquivo", "linha", "coluna", "mensagem", "sugestao" }] }`

## 10. Requisitos Não-Funcionais

- Desempenho (Vale-Cultura, máquina comum): `verificar` < 2 s; `gerar` < 5 s; `capturar` < 60 s.
- Determinismo: duas execuções → `telas.json` e HTML idênticos byte a byte.
- Offline: nenhuma requisição de rede; páginas geradas sem CDN (fontes e CSS locais).
- Acessibilidade das telas geradas: axe-core sem violações sérias ou críticas em todas as
  telas e estados do exemplo fictício e do Vale-Cultura.
- Portabilidade: Windows e Linux; caminhos com acento e espaço ("3 - Requisitos/Especificações",
  "04_Cadastro_Beneficiária").
- Imagem Docker única (Node + Chromium) com a pasta de documentação como volume.

## 11. Dependências

- Features e PNGs atuais do Vale-Cultura (só leitura, fora deste repositório).
- `novo-vale-cultura/DESIGN.md` (tokens Cobalto) para o `projeto.yml` do piloto.
- Chrome/Edge/Chromium para captura.

## 12. Fora de Escopo (desta feature)

- Documentação navegável, busca, rastreabilidade, PDF (0002).
- Programa de computador e instaladores (0003).
- Kit gov.br, navegação clicável entre telas além de links simples, captura em 390 px,
  comparação entre versões de requisitos (0004).
- IA e integração no CI do MinC (0005).
- Gerar código do sistema; editor visual; mudar o formato das features.

## 13. Glossário Específico

- Posição Pirilampo: índice 0-based do filho da Funcionalidade usado nos links `#/scenario/…`.
- Sinal: fato do requisito que levou a uma decisão de inferência; fica gravado no modelo.
- Recorte: subconjunto de telas selecionado por `--modulo`/`--tela`.

## 14. Dúvidas em Aberto

| # | Dúvida | Impacto | Proposta padrão se não houver resposta |
|---|---|---|---|
| D-01 | O gerador Python (`comum.py`, `vc.css`, `renderizar.mjs`) não existe em nenhuma branch do `portal-vale-cultura` nem nesta máquina. Onde está? | Médio: reaproveitar o CSS e os componentes aproxima o resultado dos PNGs atuais | Recriar o visual a partir do `DESIGN.md` e dos 42 PNGs |
| D-02 | Onde fica o `projeto.yml` do piloto (com os tokens Cobalto)? | Baixo | Num MR no `novo-vale-cultura-documentacao`, ao lado do `config.properties`, após o MVP; durante o desenvolvimento, só local |
| D-03 | A verificação deve tratar como erro um link cujo rótulo diverge do destino (RN-32)? Pode haver muitos no Vale-Cultura | Baixo | Erro, com `--avisos-quebram` independente |
| D-04 | Rawline (fonte do gov.br) não está no npm; precisa vir do pacote do gov.br DS ou ser embutida manualmente | Só fase 4 | Resolver na 0004 |
| D-05 | Política de branches no GitHub: "um MR da mesma branch para cada ambiente" — o Prumo só tem `main`. Basta um PR para `main`? | Baixo | Um PR para `main` com título igual ao nome da branch |
