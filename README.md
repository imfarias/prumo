# Prumo

Gera protótipos de tela, documentação navegável e verificação dos requisitos a partir de
especificações em Gherkin (`.feature`), no mesmo formato usado com o Pirilampo. Nenhum arquivo
de especificação existente precisa mudar.

> Em desenvolvimento. O planejamento está em [`specs/`](specs/INDEX.md).

## O que faz

- **Protótipos:** uma página HTML por tela e estado, com a identidade do projeto, e o PNG de cada
  tela no caminho que o cenário `@prototipo` já referencia.
- **Documentação navegável:** substitui o `html/index.html` do Pirilampo, com o protótipo embutido,
  busca, rastreabilidade de regras e mensagens, comparação de versões e PDF. Sai como site em pasta
  ou como arquivo único.
- **Verificação:** links quebrados, regras e mensagens inexistentes, exemplos fora da máscara,
  com `arquivo:linha` e código de saída para o CI.

## Como usar (planejado)

```bash
prumo verificar --specs "3 - Requisitos/Especificações"
prumo gerar     --specs "3 - Requisitos/Especificações"
prumo capturar
prumo docs      --saida html [--arquivo-unico]
```

Também haverá um programa de computador (Windows e Linux) e uma imagem Docker para o CI.

## Desenvolvimento

Requer Node.js 22.12 ou superior.

```bash
npm install
npm test
npm run prumo -- --help
```

## Licença

MIT. Todas as dependências têm licença livre.
