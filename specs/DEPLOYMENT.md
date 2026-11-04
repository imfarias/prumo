# Manual de Publicação — Prumo

**Versão deste manual:** v1.1
**Última atualização:** 2026-11-04
**Mantido por:** arc-arquiteto

O Prumo não tem servidor de produção. "Publicar" significa gerar e distribuir três artefatos:
a imagem Docker, os instaladores do programa e (opcionalmente) a documentação gerada de cada
projeto de requisitos. Seções do modelo que não se aplicam estão marcadas.

## 1. Visão Geral da Topologia de Produção

```
GitHub (imfarias/prumo) ──tag v*──▶ GitHub Actions ─┬─▶ ghcr.io/imfarias/prumo:<versão>  (Docker)
                                                    └─▶ Release: .exe, .msi, .deb, .AppImage
Programa instalado ──consulta diária──▶ releases do GitHub (aviso de atualização; baixa só com o clique)
CI de quem usa o Prumo (ex.: Jenkins): docker run ghcr.io/imfarias/prumo verificar|gerar|docs  (pasta como volume)
```

## 2. Infraestrutura
- Provedor: GitHub (código, Actions, GHCR, Releases).
- Orquestração, banco, cache, fila, DNS/TLS, WAF/CDN: não se aplica.

## 3. Pré-requisitos para Primeiro Deploy
- [ ] Repositório `imfarias/prumo` com Actions habilitado e permissão `packages: write`
- [ ] (Opcional) Certificado de assinatura de código, como secret `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD`

## 4. Variáveis de Ambiente
| Variável | Obrigatória | Onde está armazenada | Observações |
|---|---|---|---|
| `PRUMO_CHROMIUM` | Não | Ambiente local/CI | Caminho de um Chromium; sem ela, procura Chrome/Edge instalados |
| `PRUMO_ATUALIZACAO_URL` | Não | Ambiente | Endereço no formato da API `releases/latest` do GitHub (outro repositório ou espelho); só `https` ou `http://127.0.0.1` |
| `PRUMO_ATUALIZACAO` | Não | Ambiente | `desligada` desliga a verificação de atualização |
| `PRUMO_USERDATA` | Não | Ambiente | Pasta de preferências, registro e cache do programa (padrão do sistema) |
| `PRUMO_RECURSOS` | Não | Definida pelo programa | Raiz de kits, fontes e axe fora do pacote do motor (o programa aponta para `resources/recursos`) |
| `PRUMO_TESTE_DIALOGOS`, `PRUMO_EDITOR_TESTE`, `PRUMO_FORMATO` | Não | Só testes | Lidas apenas com o programa não empacotado; o build de produção as remove |
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | Não | Secrets do GitHub | Assinatura do instalador Windows |
| `GITHUB_TOKEN` | Sim (CI) | Automático no Actions | Publicar imagem e release |

## 5. Pipeline de CI/CD
### Gatilhos
- PR para `main` → lint, testes, verificação do exemplo fictício.
- PR → também gera os instaladores e testa instalar, `--verificar-instalacao` e desinstalar (`ci.yml`, job `instaladores`).
- Tag `v*.*.*` → imagem Docker (`ci.yml`) + instaladores testados, `SHA256SUMS.txt` e release (`release.yml`).

### Etapas
1. Checkout → 2. `npm ci` → 3. Lint/tipos → 4. Testes (com Chromium) → 5. Build →
6. `docker build`/`push` → 7. `electron-builder` em `windows-latest` e `ubuntu-latest` → 8. Testar os instaladores
(`apps/desktop/scripts/testar-instaladores.{ps1,sh}`) → 9. `SHA256SUMS.txt` + `gh release create`.

No Linux, os testes do programa rodam sob `xvfb-run` e o CI libera `kernel.apparmor_restrict_unprivileged_userns`
(o Ubuntu 24 a restringe e o sandbox do Chromium não sobe).

### Estratégia de versionamento
- SemVer (`MAJOR.MINOR.PATCH`); a versão maior também sobe quando `telas.json` muda de forma incompatível.

## 6. Procedimento de Publicação
1. Atualizar `CHANGELOG.md` e a versão nos `package.json` (a do `apps/desktop/package.json` precisa ser igual à tag; o `release.yml` confere).
2. Criar a tag `vX.Y.Z` em `main` e enviar.
3. Conferir a release com os quatro instaladores, o `SHA256SUMS.txt` e a imagem no GHCR. O programa instalado avisa da versão nova em até um dia.

Fallback manual: `npm ci && npm run build && npm run dist --workspace @prumo/desktop` na máquina do sistema-alvo; `docker build -f docker/Dockerfile .`.

## 7. Migrations de Banco
Não se aplica. Mudança no formato de `projeto.yml` vem com `prumo migrar-config` compatível.

## 8. Rollback
Reinstalar a versão anterior (instaladores ficam nas releases) ou fixar a tag anterior da imagem no Jenkins.

## 9. Observabilidade
Não há telemetria. Logs locais: CLI em stderr; programa em `userData/logs/prumo.log` (rotação por tamanho).

## 10. Healthchecks
| Serviço | Endpoint | Resposta esperada |
|---|---|---|
| Imagem Docker | `docker run ghcr.io/imfarias/prumo --version` | Versão e código 0 |
| `prumo servir` | `GET http://127.0.0.1:4300/saude` | `200 ok` |

## 11. Backups e Recuperação
Não se aplica: as entradas são arquivos versionados no repositório de documentação de cada projeto.

## 12. Escalabilidade
Não se aplica.

## 13. Segurança
- Instaladores assinados quando houver certificado; sem ele, o SmartScreen mostra "Editor desconhecido" — o usuário escolhe "Mais informações → Executar assim mesmo" (documentado no README).
- Dependências com versão exata; `npm audit` no CI.

## 14. Conformidade
- LGPD: protótipos só com dados fictícios; nenhuma especificação enviada para fora sem pedido explícito.
- Acessibilidade: eMAG 3.1 e WCAG 2.1 AA conferidos por axe no CI.

## 15. Runbook — Incidentes Comuns
### Sintoma: "Nenhum navegador encontrado" ao capturar
**Diagnóstico:** sem Chrome/Edge instalado e sem `PRUMO_CHROMIUM`.
**Mitigação:** instalar Edge/Chrome, definir `PRUMO_CHROMIUM`, ou usar a imagem Docker ou o programa.

### Sintoma: Windows bloqueia o instalador
**Mitigação:** instalador não assinado; ver seção 13 e o README ("Mais informações" → "Executar assim mesmo").

### Sintoma: o programa não abre no Linux ("SUID sandbox helper" ou tela preta)
**Diagnóstico:** o Ubuntu 24 restringe *user namespaces* sem perfil AppArmor.
**Mitigação:** instalar pelo `.deb` (que traz o `chrome-sandbox` configurado) ou rodar o `.AppImage` com `--no-sandbox`.

### Sintoma: o aviso de atualização não aparece
**Diagnóstico:** sem rede, consulta desligada em Preferências, "Lembrar depois" nos últimos 7 dias ou já consultado hoje.
**Mitigação:** Preferências → "Verificar agora". O registro fica em `userData/logs` (Preferências → Sobre → Abrir a pasta).

## 16. Contatos
| Papel | Pessoa | Canal |
|---|---|---|
| Mantenedor | Vinicius Farias | GitHub `imfarias` |

## 17. Checklist de Release
- [ ] Testes verdes no CI
- [ ] Exemplo fictício gerado sem erro na imagem Docker
- [ ] Instaladores instalam e desinstalam em máquina limpa (Windows e Linux)
- [ ] Atalho criado e o programa abre pelo menu
- [ ] axe sem violações sérias ou críticas
- [ ] `SHA256SUMS.txt` confere com os arquivos da release
