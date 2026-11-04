# 0001 — Revisão Final

**Autor:** arc-lider (Momento B) · **Data:** 2026-11-04

## Veredito: ⚠️ Aprovado com ressalvas

A fase 1 cumpre a especificação, o desenho e a arquitetura. As ressalvas são de processo
(o CI ainda não rodou porque a branch não foi enviada) e uma decisão de design pendente com o
usuário. Nada bloqueia o merge depois do CI verde.

## 1. Aderência à Especificação

| Critério | Situação | Evidência |
|---|---|---|
| CA-01 HTML e PNG de todas as telas com `@prototipo` | ✅ | Piloto: 41 telas, 121 páginas; PNGs gerados pelo `comparar-png` (em pasta temporária, para não sobrescrever os PNGs feitos à mão). `capturar` grava no caminho do `@prototipo` (CT-I20) |
| CA-02 Fax obrigatório muda a tela | ✅ | CT-I11 (diff de 2 linhas) |
| CA-03 Identidade no `projeto.yml` muda todas as telas | ✅ | CT-I12 |
| CA-04 `config.properties` e `migrar-config` | ✅ | CT-I13, CT-I14, CT-C08 |
| CA-05 Nenhuma feature precisa mudar | ✅ | 44 arquivos do piloto lidos sem erro |
| CA-06 Posição Pirilampo | ✅ | RNG-06 `/6`, LOV-06 `/53`, MSG-01 `/1` no piloto; CT-U01 |
| CA-07 Problemas plantados e pasta real | ✅ | CT-I15 (13 códigos); piloto: 0 erros, 14 avisos |
| CA-08 JSON | ✅ | CT-C03 |
| CA-09 Determinismo | ✅ | CT-I18, CT-I20 |
| CA-10 axe | ✅ | Exemplo (CT-P07) e piloto: 0 violações em 121 páginas |
| CA-11 Dados fictícios | ✅ | Teste "CNPJs e CPFs das páginas são válidos…" |
| CA-12 Sem rede | ✅ | CT-I21 |
| CA-13 Relatório lado a lado | ✅ | CT-I22; piloto em `saida/piloto-comparacao/` (local) |
| CA-14 Sinais da inferência no modelo | ✅ | `telas.json` (`sinais` por tela e campo) |
| CA-15 Desempenho no piloto | ✅ | verificar 1,1 s; gerar 2,3 s; captura das 41 telas dentro dos 18 s do `comparar-png` (pelo compartilhamento `\\wsl.localhost`) |

Fluxos alternativos FA-01 a FA-12 implementados. CT-U13 (sanitização de Markdown) não se aplica
na fase 1: nada de Markdown é renderizado; fica para a 0002, onde a documentação mostra o texto.

## 2. Aderência ao Desenho Técnico

Implementado como desenhado, com três desvios registrados no 04 (seção 9): verificação num único
arquivo; regras de inferência gerais acrescentadas a partir do piloto; 5 linhas por tabela.
O contrato `telas.json` ganhou `api.exemplos` e `dados` (tabelas que não são de campos) — aditivo,
dentro da versão 1.0.0 do modelo, já que o contrato ainda não foi publicado.

## 3. Aderência à Arquitetura

Monorepo com motor único e CLI fina; porta `Navegador`; ESM e TypeScript estrito; nenhuma rede no
motor; escrita protegida por `dentroDe`; versões exatas e licenças livres (axe-core MPL-2.0, usado
sem modificação). Dockerfile multi-estágio com usuário não-root. Nada do Vale-Cultura no repositório.

## 4. Reutilização

Vocabulário e algoritmos do gerador Python reaproveitados por reescrita; `vc.css` utilizável só
localmente via `css_adicional`. `COMPONENTS.md` atualizado com macros, utilitários e fábricas.

## 5. Qualidade dos Testes

- Integração sem mock de módulos internos: ✅ (pipeline real sobre cópia do exemplo em disco).
- Estado verificado no disco (`telas.json`, HTML, PNG, `mtime`): ✅
- Erros cobertos com o mesmo rigor que sucesso: ✅ (estado de erro, códigos de saída 1/2, YAML inválido, navegador ausente, sintaxe).
- `data-testid`/ARIA presentes e testados: ✅ (CT-P01–P06).
- a11y automatizada: ✅ axe zerado.
- Cobertura: 94,9% linhas, 80,5% ramos.

## 6. Achados

🔴 Bloqueante — nenhum.

🟡 Importante
1. **CI não executado:** a branch está só local. Enviar e conferir os jobs Ubuntu, Windows e Docker antes do merge.
2. **Estilo da caixa de mensagem:** o verificador de design aponta a borda lateral grossa (`.aviso`, `estilo.css`). Mantida até o usuário decidir (pergunta feita em 2026-11-03).
3. ~~README ainda descrevia o uso como "planejado"~~ — atualizado com a CLI real.

🔵 Sugestão (propostas para fases seguintes)
1. Layout/override `janela_sobre` para telas que no piloto são janelas sobre o portal (maiores diferenças visuais).
2. Selo de situação (ícone + cor) para colunas Situação/Status com valores de LOV.
3. `projeto.logo_claro` para cascas com fundo claro (o logo do piloto é para fundo escuro).
4. Exercitar `NavegadorPlaywright.pdf` na 0002.

## 7. Próximos Passos

- [x] Atualizar o README (🟡 3)
- [ ] Enviar a branch e abrir o PR; conferir o CI (🟡 1)
- [ ] Decisão do usuário sobre a borda das mensagens (🟡 2)
- [ ] Iniciar a 0002 (documentação navegável)

## 8. Lições para a MEMORY

- Rodar no piloto cedo pagou: oito regras gerais de inferência surgiram da comparação com as telas reais.
- `tsbuildinfo` precisa ficar fora do contexto do Docker.
- IDs que começam com dígito são válidos em HTML, mas não em `querySelector`; nos testes, usar `getElementById`.
