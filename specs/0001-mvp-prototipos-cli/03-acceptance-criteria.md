# 0001 — Critérios de Aceite e Cenários de Teste

**Autor:** arc-lider (Momento A) · **Data:** 2026-11-03

Adaptação da estratégia da arquitetura (seção 11) a uma ferramenta sem backend HTTP:
"backend integração" = pipeline real do motor sobre arquivos em disco, sem mock de módulos
internos; "frontend componente" = páginas geradas abertas no Chromium real.

## 1. Critérios de Aceite Funcionais

| # | Critério | Origem |
|---|---|---|
| CA-01 | Só com as features e o `projeto.yml` do Vale-Cultura, `prumo capturar` gera HTML e PNG das 41 telas com `@prototipo`, gravando em `Especificações/<módulo>/<tela>.png` | Pedido §8.1, spec §4 |
| CA-02 | Tornar "Fax" obrigatório numa feature muda a tela gerada (marca de obrigatório, `aria-required`) sem mudar código | Pedido §8.2 |
| CA-03 | Trocar `identidade.cores` ou `fontes` no `projeto.yml` muda o CSS de todas as telas | Pedido §8.3 |
| CA-04 | Sem `projeto.yml`, o `config.properties` do piloto é lido (nome, versão, logo, cores do menu) e `migrar-config` cria um `projeto.yml` equivalente, com comentários | Spec RN-08, FA-05 |
| CA-05 | Nenhum arquivo de especificação existente precisa mudar: os 44 arquivos do piloto são lidos sem erro de sintaxe | Spec RN-01 |
| CA-06 | A posição de cenário segue o Pirilampo: RNG-06 → `/6`, LOV-06 → `/53`, MSG-01 → `/1` | Spec RN-02 |
| CA-07 | A verificação acha todos os problemas plantados no caso de teste (um de cada código RN-30…RN-42) e sai com código 1; na pasta real lista o que houver | Pedido §8.5 |
| CA-08 | `--formato json` produz JSON válido conforme spec §9.4 e nada mais no stdout | Spec FA-02 |
| CA-09 | Duas execuções seguidas produzem `telas.json` e HTML idênticos byte a byte; PNG sem mudança não é regravado | Spec §10, FA-09 |
| CA-10 | Telas e estados gerados sem violações sérias ou críticas no axe | Pedido §8.9 |
| CA-11 | Nenhum dado real: CPFs/CNPJs gerados são válidos e vêm dos geradores; nomes gerados terminam com o sufixo configurado; e-mails em `exemplo.com.br` | Pedido §8.10 |
| CA-12 | Nenhuma requisição de rede durante gerar/capturar | Pedido §8.11 |
| CA-13 | `comparar-png` produz relatório lado a lado com % de diferença por tela | Pedido §7 fase 1 |
| CA-14 | Cada decisão de inferência fica registrada como sinal no `telas.json` (ex.: "regra LOV-06 → seleção") | Pedido §4.1, §6.1 |
| CA-15 | Desempenho no piloto: verificar < 2 s, gerar < 5 s, capturar < 60 s | Spec §10 |

## 2. Cenários de Integração do Motor (pipeline real, sem mock interno)

| ID | Cenário | Entrada | Esperado (verificado no disco) |
|---|---|---|---|
| CT-I01 | Pipeline completo do exemplo | `exemplos/exemplo-ficticio` | `saida/modelo/telas.json` com todas as telas; um HTML por estado; `index.html` de navegação |
| CT-I02 | Listagem inferida | feature `Tipo: Consulta` com `<Filtros>` e `<Campos>` N | layout `listagem`; HTML com filtros, botões Filtrar/Limpar, tabela, paginação; estado `vazio` existe |
| CT-I03 | Formulário inferido | `Tipo: Manual` com `<Campos>` editáveis | layout `formulario`; obrigatórios com `aria-required`; estado de erro com resumo no topo |
| CT-I04 | LOV vira seleção | campo com `[LOV-02](…)` | componente `selecao`, opções = 1ª coluna da LOV; sinal registrado |
| CT-I05 | Máscaras pelo nome | CNPJ, CPF, CEP, Fone | componente `mascara` com a máscara do `projeto.yml`; exemplo formatado |
| CT-I06 | Confirmação, caixa, captcha, arquivos | "Confirme o E-mail", "Declaração de veracidade", "Código verificador", "Documentos" | componentes `confirmacao` (ligado ao E-mail), `caixa`, `captcha`, `arquivos` |
| CT-I07 | Estado de erro com MSG | cenário `@validacao` citando MSG de erro e um campo | estado `erro-<posição>` com a mensagem no campo e `aria-invalid` |
| CT-I08 | Ação leva a outra tela | `aciona a opção **Cadastrar Exemplo**` com feature homônima | `acao.destino` = id da tela; link no HTML |
| CT-I09 | Override | `telas.overrides.yml` com seções, ordem e `componente` | HTML respeita; override de campo inexistente gera aviso |
| CT-I10 | Override de HTML existente (FA-12) | `.html` ao lado da feature | tela usa o HTML; nada é gerado para ela |
| CT-I11 | CA-02 (Fax obrigatório) | alterar `Obrigatório` de N para S na fixture | HTML muda só nesse campo (diff restrito) |
| CT-I12 | CA-03 (identidade) | trocar `cores.primaria` | `prumo.css` muda; HTMLs não mudam |
| CT-I13 | `config.properties` | só properties (com `\#`) | config com nome, versão, logo e cores; aviso CLI-04 |
| CT-I14 | `migrar-config` | properties | `projeto.yml` criado, YAML válido, comentários presentes; 2ª execução sem `--forcar` → erro de uso |
| CT-I15 | Verificação — casos plantados | fixture com 1 problema de cada código | exatamente os 13 códigos esperados, com arquivo e linha corretos |
| CT-I16 | Verificação — caso limpo | exemplo fictício | 0 erros |
| CT-I17 | Erro de sintaxe isola a tela | 1 feature inválida + 2 válidas | achado `sintaxe` com linha; 2 telas geradas |
| CT-I18 | Determinismo | rodar 2× em pastas diferentes | bytes idênticos de `telas.json` e HTML |
| CT-I19 | Recorte | `--modulo X` | só telas do módulo geradas; verificação de links considera todos |
| CT-I20 | Captura (Chromium real) | exemplo | PNGs gravados em `<módulo>/<tela>.png`, largura 1440; 2ª execução: "sem mudança" |
| CT-I21 | Sem rede | captura com interceptação | nenhuma requisição a host ≠ `file://` |
| CT-I22 | Comparação de PNG | referência + gerados | `saida/comparacao/index.html` com % por tela |
| CT-I23 | Caminhos com acento e espaço | specs em `3 - Requisitos/Especificações/04_Cadastro_Beneficiária` | tudo gerado; URLs `file://` válidas |

## 3. Cenários Unitários (só funções puras)

| ID | Função | Casos |
|---|---|---|
| CT-U01 | `filhos()` | com Contexto (Contexto=0, 1º cenário=1); sem Contexto (1º cenário=0); Esquema conta 1 |
| CT-U02 | `extrairLinks()` | `[RNG-06](#/scenario/…/6)`, `#!/feature/…`, vários links na mesma célula, texto sem link |
| CT-U03 | `lerMetadados()` | `# Módulo/Tipo/Fluxo/Tela/Perfil`; acentos; espaços; ausência |
| CT-U04 | `classificarTabela()` | definição (Campo+Editável…), exemplo (Campo+Exemplo), outra; S/N/s/n/-/vazio |
| CT-U05 | `cpf()`/`validarCpf()` | DVs corretos; semente → mesmo valor |
| CT-U06 | `cnpj()` numérico e alfanumérico | DVs pela regra da IN 2.229/2024 (valor ASCII − 48); casos de referência publicados pela RFB |
| CT-U07 | `confereMascara()` | `##.###.###/####-##`, `X` alfanumérico, lista de máscaras (Fone 8 ou 9 dígitos), falha |
| CT-U08 | `contraste()` | pares conhecidos (preto/branco = 21; `#1D3F8F`/branco ≥ 4,5) |
| CT-U09 | `lerProperties()` | escapes `\#`, `\:`, linhas de comentário, continuação |
| CT-U10 | Regras de inferência RN-13…RN-21 isoladas | cada regra com caso positivo, negativo e precedência |
| CT-U11 | `detectarAcoes()` | "aciona a opção **Filtrar**" sim; "situação **Aguardando análise**" não |
| CT-U12 | `classificarMensagem()` | "Operação realizada com sucesso!" → sucesso; "Login Inválido" → erro; override do projeto |
| CT-U13 | `sanitizarMarkdown()` | mantém `strong`, `br`, `hr`; remove `script`, `onerror`, `href="javascript:"` |

## 4. Cenários das Páginas Geradas (Chromium real)

| ID | Cenário | Esperado |
|---|---|---|
| CT-P01 | Todo campo tem rótulo | `label[for]` aponta para `id` existente em 100% dos campos |
| CT-P02 | Obrigatório | `aria-required="true"` + marca visual `*` com `aria-hidden` |
| CT-P03 | Estado de erro | resumo `role="alert"` no topo com links aos campos; campo com `aria-invalid` e `aria-describedby` válido |
| CT-P04 | Estado vazio | `[data-testid$="-vazio"]` com `role="status"` |
| CT-P05 | Navegação por teclado | ordem de Tab = ordem visual; foco visível em todos os interativos |
| CT-P06 | Casca autenticada | menu do perfil com item atual `aria-current="page"` |
| CT-P07 | axe | 0 violações `serious`/`critical` em todas as telas e estados do exemplo |
| CT-P08 | Fontes offline | `document.fonts` carregadas de `_recursos/fontes`, sem rede |
| CT-P09 | Regressão visual | PNG de cada tela do exemplo ≤ 0,5% de diferença da referência |

## 5. Cenários da CLI (processo real)

| ID | Comando | Esperado |
|---|---|---|
| CT-C01 | `prumo verificar` no exemplo | saída 0, resumo "0 erros" |
| CT-C02 | `prumo verificar` nos casos plantados | saída 1; cada linha `severidade arquivo:linha código mensagem` |
| CT-C03 | `prumo verificar --formato json` | stdout é JSON válido; stderr com resumo |
| CT-C04 | `--specs` inexistente | saída 2, mensagem CLI-01 |
| CT-C05 | `projeto.yml` inválido | saída 2, CLI-03 com a linha |
| CT-C06 | `prumo capturar` sem navegador (`PRUMO_CHROMIUM` inválido e canais indisponíveis simulados) | saída 2, CLI-05 |
| CT-C07 | `prumo gerar --tela X` | só X gerada |
| CT-C08 | `prumo --help` e `prumo <cmd> --help` | textos em português |

## 6. Cenários E2E

| ID | Fluxo | Esperado |
|---|---|---|
| CT-E01 | Analista no exemplo: `verificar` → `gerar` → `capturar` → abrir `saida/prototipos/index.html` | navegação lista módulos, telas e estados; cada link abre a página |
| CT-E02 | Imagem Docker: `docker run -v <exemplo>:/docs prumo capturar` | PNGs gerados no volume com o dono do usuário |
| CT-E03 | Piloto (manual, registrado no 05-test-report): Vale-Cultura no WSL com `projeto.yml` Cobalto | 41 telas; relatório `comparar-png`; lista de diferenças → overrides/regras |

## 7. Massa de Dados — Fábricas e Projeto de Exemplo

| Entregável | Caminho | Conteúdo |
|---|---|---|
| Projeto fictício | `exemplos/exemplo-ficticio/` | ~8 features em 4 módulos (público com listagem e contato; acesso com login; cadastro em etapas; gestão autenticada; API), `Regras_de_negócio/` (RNG e LOV), `Mensagem_de_Interface/` (MSG e E-mail), `projeto.yml`, `telas.overrides.yml`, `config.properties`, logo fictício |
| Referência visual | `exemplos/exemplo-ficticio/referencia/` | PNGs aprovados (gerados no CI Linux) |
| Fábrica de features | `packages/motor/test/fabricas/feature.ts` | `fabricaFeature({ modulo, nome, tipo, contexto, cenarios, campos, tags })` → texto Gherkin no padrão Pirilampo; estados nomeados: `listagem()`, `formulario()`, `comLinkQuebrado()`, `comRefInexistente()`, `comMascaraErrada()`, `comSintaxeInvalida()` |
| Fábrica de projeto | `packages/motor/test/fabricas/projeto.ts` | cria pasta temporária com features, regras, mensagens e `projeto.yml`; override de qualquer parte |
| Casos plantados | `packages/motor/test/fixtures/verificacao-plantada/` | um problema de cada código RN-30…RN-42, com a linha esperada anotada |

Dados sempre fictícios: nomes "… Exemplo", CPF/CNPJ dos geradores, e-mails `@exemplo.com.br`.

## 8. Cobertura Mínima Esperada

- Motor: 85% de linhas e 80% de ramos (vitest + v8).
- `inferencia/` e `verificacao/`: 95% de linhas (são o coração da regra).
- CLI: todos os comandos e códigos de saída exercitados.

## 9. Definition of Done

- [ ] CA-01…CA-15 atendidos (CA-01, CA-13 e CA-15 comprovados no piloto e registrados no 05-test-report)
- [ ] Todos os cenários CT-I, CT-U, CT-P, CT-C e CT-E01/E02 com teste automatizado verde no CI (Linux) e localmente (Windows)
- [ ] axe sem violações sérias/críticas
- [ ] Cobertura da seção 8
- [ ] `COMPONENTS.md` atualizado com macros do kit e utilitários do motor
- [ ] README com instalação e uso da CLI
- [ ] Nenhum arquivo do Vale-Cultura no repositório; commits sem referência a IA
- [ ] `projeto.yml` do piloto criado no WSL (fora do repositório) e lista de diferenças registrada
