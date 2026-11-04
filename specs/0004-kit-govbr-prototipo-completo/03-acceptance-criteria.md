# 0004 — Critérios de Aceite e Cenários de Teste

**Autor:** arc-lider (Momento A) · **Data:** 2026-11-04

## 1. Critérios de Aceite Funcionais

| # | Critério | Origem |
|---|---|---|
| CA-01 | Com `design_system: govbr`, todas as telas do exemplo saem com cabeçalho, menu, migalha, rodapé, campos, botões, tabelas e mensagens do gov.br DS e a fonte Raleway, sem nenhum pedido de rede | RN-80, RN-81 |
| CA-02 | A mesma tela nos dois kits tem os mesmos `id`, `data-testid`, campos, ações e estados | RN-82 |
| CA-03 | Projeto sem `design_system` gera os mesmos PNGs da 0003 (referência do `proprio` sem atualização) | §10 do 01, FA-06 |
| CA-04 | Projeto novo (CLI e programa) nasce com `design_system: govbr` e passa na verificação sem erros | RN-80 |
| CA-05 | Ações que abrem outra funcionalidade, itens de menu e de migalha e ações de linha levam à tela certa | RN-83 |
| CA-06 | "Enviar" (ou outra ação com cenários) leva ao estado de sucesso; com "Simular erro", aos estados de erro em ordem; "Voltar" refaz o percurso | RN-84, RN-85 |
| CA-07 | Ação sem destino avisa ao clicar e gera a informação `prototipo/acao-sem-destino` na verificação | FA-01 |
| CA-08 | A barra do protótipo não aparece nos PNGs e não aparece dentro da documentação nem do programa (que têm controles próprios) | §6.2 do 01 |
| CA-09 | Com `captura.celular` ou `--celular`, cada tela ganha `<tela>-celular.png` a 390 px; o PNG de 1440 não muda; segunda execução sem mudança | RN-87 |
| CA-10 | A 390 px nenhuma página tem rolagem horizontal; tabelas largas rolam dentro da própria região | FA-05 |
| CA-11 | Colunas Situação/Status com LOV mostram selo com texto e a cor pelo sentido do valor; override muda a cor | RN-86 |
| CA-12 | Layout "janela sobre o portal" por override e por `# Layout: janela`, nos dois kits, com o fundo inerte | §6.4 do 01 |
| CA-13 | `projeto.logo_claro` é usado no cabeçalho claro; sem ele e com logo PNG de pouco contraste, aviso `identidade/logo-contraste` | RN-88, FA-04 |
| CA-14 | No kit `govbr`, cores do projeto diferentes do padrão geram o aviso `kit/cor-ignorada` | FA-03 |
| CA-15 | Documentação: protótipo embutido com Computador/Celular e Simular erro, nos dois modos (pasta e arquivo único) | §6.5 do 01 |
| CA-16 | Programa: escolher gov.br, logo claro e celular na Configuração; prévia em celular nos Protótipos | §6.5 do 01 |
| CA-17 | axe sem violações sérias ou críticas nos dois kits, nas duas larguras e em todos os estados | RN-89 |
| CA-18 | `govbr.css` < 120 KB; arquivo único do piloto no `govbr` ≤ 1,5× o do `proprio`; gerar e capturar o piloto no `govbr` ≤ 1,3× o tempo; celular soma ≤ 60% à captura | §10 do 01 |

## 2. Cenários de Unidade (motor)

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-U01 | `acaoDoCenario`: "aciona a opção **Enviar**", "aciona o botão **Salvar**", "clica em **Enviar**", "seleciona **Filtrar**", acento e caixa diferentes | Ação certa em todos; texto sem ação → indefinido |
| CT-U02 | `ligarFluxos` no Contato do exemplo | `Enviar.fluxo = { sucesso, erros: [2 erros em ordem] }`; estados com `acao = enviar` |
| CT-U03 | Ação só com cenários de erro | `sucesso` indefinido; clique vai ao primeiro erro |
| CT-U04 | Dois cenários de sucesso para a mesma ação | Usa o primeiro; aviso `prototipo/varios-sucessos` |
| CT-U05 | "aciona **Cadastrar** … o sistema exibe **Cadastro de Parceira**" | `destino` = tela do cadastro, com sinal |
| CT-U06 | Override `acoes.Voltar.destino: 01_Portal_Inicio` e `estado:erro-3` | Destino e estado do override |
| CT-U07 | Ação de linha Visualizar/Editar numa listagem | Destino na leitura/formulário do mesmo módulo com a entidade no título |
| CT-U08 | `classificarSelo` | Autorizada/Ativa → sucesso; Não autorizada/Inativa → erro; Aguardando análise → aviso; Outra → neutro |
| CT-U09 | Esquema: `logo_claro` inexistente, `captura.celular: "sim"`, selo com cor inválida | Achados de configuração com caminho |
| CT-U10 | `kit/cor-ignorada` | Só no `govbr` e só quando a cor difere do padrão |
| CT-U11 | `identidade/logo-contraste` | PNG escuro sem `logo_claro` → aviso; com `logo_claro` ou SVG → nada |
| CT-U12 | `criarProjetoNovo` | `design_system: govbr`; verificação sem erros |

## 3. Cenários de Integração (motor, com navegador)

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-I01 | Gerar o exemplo no `govbr` | Todas as telas e estados; `govbr.css` < 120 KB; Raleway embutida; zero pedidos de rede |
| CT-I02 | Comparar o DOM das mesmas páginas nos dois kits | Mesmo conjunto de `id` e `data-testid` |
| CT-I03 | axe no `govbr` e no `proprio`, a 1440 e a 390, todas as páginas | Zero sérias/críticas |
| CT-I04 | Rolagem horizontal a 390 | `scrollWidth ≤ 390` em todas as páginas dos dois kits |
| CT-I05 | Referência visual do `proprio` (teste da 0001) | Passa sem atualizar a referência |
| CT-I06 | Capturar com celular | 7 `-celular.png` com 390 px de largura e marca do Prumo; 2ª execução: todos "sem mudança" |
| CT-I07 | `comparar-png` com celular | Relatório com os pares de celular |
| CT-I08 | Fluxo no navegador (Contato) | Enviar → sucesso; Simular erro → erro 1 → erro 2 → erro 1; Voltar → tela anterior; ação sem destino → aviso em `role=status` |
| CT-I09 | Página aberta com `#captura` | Barra ausente; PNG idêntico ao sem barra |
| CT-I10 | Janela sobre o portal (override numa tela do exemplo) | Fundo `inert` e `aria-hidden`; foco no título; "Fechar" leva à origem |
| CT-I11 | Selo na listagem do exemplo | Cada valor de Situação com a classe da cor e o texto; contraste ≥ 4,5:1 |
| CT-I12 | Logo claro no `govbr` | `<img>` do cabeçalho aponta para o `logo_claro` |

## 4. Cenários da Documentação

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-D01 | Protótipo embutido, Simular erro (pasta e arquivo único) | Enviar leva ao erro dentro da moldura |
| CT-D02 | Seletor Celular | Iframe com 390 px; PNG de celular quando existe |
| CT-D03 | Dentro do iframe | Barra do protótipo não aparece |
| CT-D04 | Documentação do exemplo no `govbr` | axe sem sérias/críticas; zero pedidos de rede |

## 5. Cenários E2E do Programa

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-E01 | Configuração: kit gov.br, salvar | `projeto.yml` com só essa linha mudada; protótipo regenerado no gov.br |
| CT-E02 | Configuração: logo claro e "Também capturar em celular" | `projeto.yml` com as chaves novas |
| CT-E03 | Protótipos: gerar PNG do módulo com celular ligado | PNGs 1440 e `-celular.png` gravados |
| CT-E04 | Protótipos: prévia em Celular e Simular erro | Iframe a 390; Enviar mostra o erro |
| CT-E05 | Projeto novo | `design_system: govbr`; 0 erros |
| CT-E06 | axe nas telas do programa afetadas | Zero sérias/críticas |

## 6. Massa de Dados

| Entregável | Caminho | Conteúdo |
|---|---|---|
| Exemplo fictício | `exemplos/exemplo-ficticio/` | Ganha override `janela_sobre` numa tela e a LOV de Situação com selos (sem mudar os PNGs de referência das telas comparadas) |
| Projeto `govbr` de teste | `packages/motor/test/fabricas/projeto.ts` (`criarProjeto({ kit: 'govbr' })`) | Cópia do exemplo com `design_system: govbr` |
| Features de fluxo | `fabricaFeature` | Cenários com as variações de redação do CT-U01 |

## 7. Cobertura Mínima
- Motor: metas atuais (85% linhas, 80% ramos); `fluxo.ts` e `selo.ts` ≥ 90% de linhas.
- `prumo-prototipo.js`: coberto pelos CT-I08, CT-I09 e CT-D01.

## 8. Definition of Done
- [ ] CA-01 a CA-18 atendidos
- [ ] Testes verdes no CI (Ubuntu e Windows)
- [ ] Referência visual do `proprio` inalterada
- [ ] README (kit gov.br, celular, simular erro) e `COMPONENTS.md` atualizados
- [ ] Commits sem referência a IA
