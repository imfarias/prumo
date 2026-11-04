# Prumo

Gera protótipos de tela, documentação navegável e verificação dos requisitos a partir de
especificações em Gherkin (`.feature`), no mesmo formato usado com o Pirilampo. Nenhum arquivo
de especificação existente precisa mudar.

> Fase 1 de 5 pronta: verificação, protótipos HTML e PNG pela linha de comando e imagem Docker.
> Documentação navegável, programa de computador e kit gov.br vêm nas próximas fases ([`specs/INDEX.md`](specs/INDEX.md)).

## O que faz hoje

- **Verificação:** links `#/scenario/…` e `#!/feature/…` quebrados ou com rótulo trocado, RNG, LOV, MSG e
  e-mails citados e não definidos (ou nunca citados, ou duplicados), exemplos fora da máscara, ações para
  telas inexistentes, protótipos e imagens faltando, erro de sintaxe. Saída `arquivo:linha`, em texto ou JSON,
  com código de erro para o CI.
- **Protótipos:** uma página HTML por tela e estado (padrão, erro com a MSG no campo certo, sucesso, vazio),
  com a identidade do `projeto.yml`, fontes embutidas e dados fictícios válidos. Cada decisão automática fica
  registrada em `modelo/telas.json` ("este campo virou seleção por causa da LOV-06").
- **Captura:** o PNG de cada tela, a 1440 px, no caminho que o cenário `@prototipo` já referencia.
- **Comparação:** relatório lado a lado entre os PNGs atuais e os gerados, com a diferença por tela.

## Uso

Requer Node.js 22.12 ou superior e o Edge ou o Chrome instalados (ou `PRUMO_CHROMIUM`).

```bash
npm install
npm run build
```

```bash
node apps/cli/dist/main.js verificar --specs "3 - Requisitos/Especificações"
```

```bash
node apps/cli/dist/main.js gerar --specs "3 - Requisitos/Especificações" --saida saida/prototipos
```

```bash
node apps/cli/dist/main.js capturar --specs "3 - Requisitos/Especificações"
```

```bash
node apps/cli/dist/main.js comparar-png --specs "3 - Requisitos/Especificações" --saida saida/comparacao
```

```bash
node apps/cli/dist/main.js migrar-config --specs "3 - Requisitos/Especificações"
```

Opções comuns: `--projeto <arquivo>`, `--modulo <pasta>` e `--tela <nome>` (repetíveis), `--formato json`,
`--avisos-quebram`, `--largura <px>`, `--forcar`, `--verboso`. Códigos de saída: 0 ok, 1 verificação com
erro, 2 erro de uso, 3 falha inesperada.

### Docker

```bash
docker build -f docker/Dockerfile -t prumo .
```

```bash
docker run --rm -v "$PWD/3 - Requisitos/Especificações:/docs" prumo verificar --specs /docs
```

## Configuração

`projeto.yml` na pasta de especificações (veja [`exemplos/exemplo-ficticio/projeto.yml`](exemplos/exemplo-ficticio/projeto.yml)).
Sem ele, o Prumo lê o `config.properties` do Pirilampo. Ajustes por tela ficam em `telas.overrides.yml`
(seções, ordem, largura, componente, rótulo, ajuda, opções, ações).

## Desenvolvimento

```bash
npm test
```

```bash
npm run cobertura
```

O projeto de exemplo em [`exemplos/exemplo-ficticio`](exemplos/exemplo-ficticio) é inteiramente fictício e serve aos testes.

## Licença

MIT. Todas as dependências têm licença livre.
