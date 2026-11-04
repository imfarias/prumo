# 0002 — Revisão Final

**Autor:** arc-lider (Momento B) · **Data:** 2026-11-04

## Veredito: ⚠️ Aprovado com ressalvas

A documentação cumpre a especificação e substitui o Pirilampo com folga no piloto. As ressalvas:
- o CI desta branch ainda não rodou;
- o Firefox ficou sem teste;
- a documentação gerada ainda não foi colocada no lugar do Pirilampo no repositório do Vale-Cultura, o que depende do usuário.

## 1. Aderência à Especificação

| Critério | Situação | Evidência |
|---|---|---|
| CA-01 Site por `file://` em `<specs>/../html` | ✅ | integracao (CT-I01) |
| CA-02 Links antigos | ✅ | Exemplo nos dois modos (CT-P01) e piloto (todos os links) |
| CA-03 Tudo do Pirilampo presente | ✅ | piloto: 44 funcionalidades, mesmos cenários, tabelas ≥ |
| CA-04 Protótipo clicável embutido | ✅ | CT-P07 e CT-P08 |
| CA-05 Link copiável | ✅ | CT-P04 |
| CA-06 Prévia | ✅ | CT-P03 |
| CA-07 Busca < 200 ms | ✅ | 5× o piloto e o piloto real |
| CA-08 Rastreabilidade | ✅ | CT-I04, CT-I05, CT-P10 |
| CA-09 Comparação | ✅ | pasta e Git (CT-I10, CT-I11, CT-P09) |
| CA-10 PDF | ✅ | Sumário = destinos do PDF; capa; rodapé conferido com pdftotext |
| CA-11 Arquivo único | ✅ | CT-I08; piloto com 2,9 MB |
| CA-12 Sem rede | ✅ | Bloqueio nos testes de navegador |
| CA-13 axe e teclado | ✅ | CT-P11, CT-P12 |
| CA-14 Determinismo | ✅ | CT-I17 |
| CA-15 `servir` com recarga | ✅ | servir.test, cli |
| CA-16 Identidade | ✅ | CT-I18 |
| CA-17 Limpeza segura | ✅ | CT-I09 |

## 2. Aderência ao Desenho Técnico

Implementado como desenhado. Os desvios estão registrados no 04 (seção 9), e todos melhoram o resultado:
- páginas de protótipo no arquivo único guardadas como strings, não como `<template>`;
- recursos compartilhados no arquivo único;
- `--show-prefix` para o caminho no Git.

## 3. Aderência à Arquitetura

O motor continua único, e a CLI é fina. Nenhuma chamada de rede. As escritas são protegidas por
`dentroDe` e limitadas ao que está em `.prumo-arquivos`. As dependências novas têm versões exatas e
licenças livres. O JS do cliente tem 32 KB, sem framework.

## 4. Reutilização

O pipeline, os protótipos, os tokens e o navegador da 0001 foram reaproveitados sem duplicar código.
Os componentes novos estão em `COMPONENTS.md`.

## 5. Qualidade dos Testes

- Sem simulação de módulos internos.
- Git e Chromium reais.
- Estado conferido no disco e no DOM.
- Erros testados: DOC-05, DOC-07, DOC-08, DOC-10, DOC-11, 400 e 404.
- axe zerado.
- Cobertura dentro das metas.

## 6. Achados

🔴 Nenhum.

🟡
1. **CI da branch:** enviar e conferir os jobs Ubuntu, Windows e Docker.
2. **Firefox:** testar manualmente o arquivo único (`blob:`) e o modo pasta.
3. **Troca no Vale-Cultura:** gerar em `3 - Requisitos/html/` no repositório de documentação. É uma decisão do usuário e muda os arquivos do cliente.

🔵
1. Traduzir "Usage/Options/default" da ajuda da CLI.
2. Teste automatizado do texto do rodapé do PDF (exige extrair texto do PDF).
3. Proposta da 0001 continua valendo: layout `janela_sobre` e selo de situação.

## 7. Próximos Passos

- [ ] Enviar a branch e abrir o PR; conferir o CI
- [ ] Gerar a documentação do piloto no lugar do Pirilampo, quando o usuário autorizar
- [ ] Iniciar a 0003 (programa de computador e instaladores)

## 8. Lições para a MEMORY

- `<template>` descarta doctype, `<html>` e `<head>`: HTML completo vai como string.
- No Windows, `os.tmpdir()` pode vir com nome curto (8.3); para caminhos do Git, use o próprio Git (`--show-prefix`).
- Grade CSS no celular: `minmax(0, 1fr)`, nunca `1fr`, quando há conteúdo largo (iframe, tabela).
