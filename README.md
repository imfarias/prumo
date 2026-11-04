# Prumo

Gera protótipos de tela, documentação navegável e verificação dos requisitos a partir de
especificações em Gherkin (`.feature`), no mesmo formato usado com o Pirilampo. Nenhum arquivo
de especificação existente precisa mudar.

> Fases 1 a 3 de 5 prontas: verificação, protótipos HTML e PNG, documentação navegável (substitui o
> Pirilampo), comparação de versões e PDF, pela linha de comando, pela imagem Docker e pelo programa de
> computador (Windows e Linux). Kit gov.br e sugestões por IA vêm nas próximas fases ([`specs/INDEX.md`](specs/INDEX.md)).

## O que faz hoje

- **Verificação:** links `#/scenario/…` e `#!/feature/…` quebrados ou com rótulo trocado, RNG, LOV, MSG e
  e-mails citados e não definidos (ou nunca citados, ou duplicados), exemplos fora da máscara, ações para
  telas inexistentes, protótipos e imagens faltando, erro de sintaxe. Saída `arquivo:linha`, em texto ou JSON,
  com código de erro para o CI.
- **Protótipos:** uma página HTML por tela e estado (padrão, erro com a MSG no campo certo, sucesso, vazio),
  com a identidade do `projeto.yml`, fontes embutidas e dados fictícios válidos. Cada decisão automática fica
  registrada em `modelo/telas.json` ("este campo virou seleção por causa da LOV-06").
- **Captura:** o PNG de cada tela, a 1440 px, no caminho que o cenário `@prototipo` já referencia.
- **Comparação de PNGs:** relatório lado a lado entre os PNGs atuais e os gerados, com a diferença por tela.
- **Documentação navegável:** no lugar do `html/index.html` do Pirilampo, em site de pasta ou arquivo único, abrindo
  por `file://`. Os links antigos (`#/scenario/…`, `#!/feature/…`) continuam valendo. Cada funcionalidade traz o
  protótipo clicável com os estados; os links de regras abrem uma prévia. Há busca (`/` ou `Ctrl+K`), "Usada em" e
  Matriz de rastreabilidade, e "Copiar link" por cenário.
- **Comparação de versões:** com uma pasta ou com uma branch, tag ou commit do Git. Marca o que é novo, alterado e
  removido, destaca o trecho mudado e mostra a versão anterior lado a lado.
- **PDF:** de tudo, de módulos ou de funcionalidades, com capa, sumário numerado e tabelas sem corte.
- **`prumo servir`:** documentação em `http://127.0.0.1:4300`, recarregada ao salvar.

## Programa de computador

Baixe o instalador da [última release](https://github.com/imfarias/prumo/releases/latest):

| Sistema | Arquivo | Instalação |
|---|---|---|
| Windows (por usuário, sem administrador) | `Prumo-Setup-<versão>.exe` | Cria atalhos e o "Abrir com o Prumo" no botão direito de pastas |
| Windows (por máquina) | `Prumo-<versão>.msi` | Em `Program Files`; o "Abrir com o Prumo" se liga em Preferências |
| Debian e Ubuntu | `prumo_<versão>_amd64.deb` | `sudo apt install ./prumo_<versão>_amd64.deb` (temporariamente fora das releases) |
| Outras distribuições Linux | `Prumo-<versão>.AppImage` | `chmod +x` e executar (temporariamente fora das releases) |

O programa traz o próprio navegador: não precisa de Node.js, Edge nem Chrome. Abra a pasta de especificações
(ou uma pasta acima dela) e use as telas de Configuração, Verificação, Protótipos, Documentação e PDF e
Comparar versões. Com a "Prévia ao vivo" ligada, a verificação e os protótipos se atualizam ao salvar um `.feature`.

**Aviso do Windows.** Os instaladores ainda não são assinados com certificado. Na primeira execução o
SmartScreen mostra "O Windows protegeu o computador": clique em **Mais informações** e em **Executar assim mesmo**.
Para conferir o arquivo, compare o SHA-256 com o `SHA256SUMS.txt` da release:

```powershell
Get-FileHash .\Prumo-Setup-0.1.0.exe -Algorithm SHA256
```

**Atualizações.** Uma vez por dia o programa consulta as releases do GitHub e avisa quando há versão nova.
Nada é baixado sem o seu clique; o arquivo baixado é conferido com o `SHA256SUMS.txt` antes de abrir o
instalador. A consulta pode ser desligada em Preferências. Nenhum dado das especificações sai do computador.

## Linha de comando

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

```bash
node apps/cli/dist/main.js docs --specs "3 - Requisitos/Especificações" [--arquivo-unico] [--comparar master]
```

```bash
node apps/cli/dist/main.js pdf --specs "3 - Requisitos/Especificações" --saida especificacao.pdf [--modulo 04_Cadastro_Beneficiária]
```

```bash
node apps/cli/dist/main.js servir --specs "3 - Requisitos/Especificações"
```

Opções comuns: `--projeto <arquivo>`, `--modulo <pasta>` e `--tela <nome>` (repetíveis), `--comparar <pasta-ou-ref>`, `--formato json`,
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

Programa de computador em desenvolvimento e instaladores:

```bash
npm run iniciar --workspace @prumo/desktop
```

```bash
npm run dist --workspace @prumo/desktop
```

O projeto de exemplo em [`exemplos/exemplo-ficticio`](exemplos/exemplo-ficticio) é inteiramente fictício e serve aos testes.

## Licença

MIT. Todas as dependências têm licença livre.
