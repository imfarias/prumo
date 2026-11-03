# Manual de Publicação — Prumo

**Versão deste manual:** v1.0
**Última atualização:** 2026-11-03
**Mantido por:** arc-arquiteto

O Prumo não tem servidor de produção. "Publicar" significa gerar e distribuir três artefatos:
a imagem Docker, os instaladores do programa e (opcionalmente) a documentação gerada de cada
projeto de requisitos. Seções do modelo que não se aplicam estão marcadas.

## 1. Visão Geral da Topologia de Produção

```
GitHub (imfarias/prumo) ──tag v*──▶ GitHub Actions ─┬─▶ ghcr.io/imfarias/prumo:<versão>  (Docker)
                                                    └─▶ Release: .exe, .msi, .deb, .AppImage
Rede do MinC: cópia dos instaladores e do latest.json no GitLab/Nexus interno ──▶ aviso de atualização no programa
Jenkins do MinC: docker run ghcr.io/imfarias/prumo verificar|gerar|docs  (pasta de documentação como volume)
```

## 2. Infraestrutura
- Provedor: GitHub (código, Actions, GHCR, Releases). Espelho interno opcional no GitLab/Nexus do MinC.
- Orquestração, banco, cache, fila, DNS/TLS, WAF/CDN: não se aplica.

## 3. Pré-requisitos para Primeiro Deploy
- [ ] Repositório `imfarias/prumo` com Actions habilitado e permissão `packages: write`
- [ ] (Opcional) Certificado de assinatura de código do MinC, como secret `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD`
- [ ] (Opcional) Endereço interno para `latest.json` de atualização definido com a TI

## 4. Variáveis de Ambiente
| Variável | Obrigatória | Onde está armazenada | Observações |
|---|---|---|---|
| `PRUMO_CHROMIUM` | Não | Ambiente local/CI | Caminho de um Chromium; sem ela, procura Chrome/Edge instalados |
| `PRUMO_ATUALIZACAO_URL` | Não | Configuração do programa | Sobrepõe `atualizacao.url` |
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | Não | Secrets do GitHub | Assinatura do instalador Windows |
| `GITHUB_TOKEN` | Sim (CI) | Automático no Actions | Publicar imagem e release |

## 5. Pipeline de CI/CD
### Gatilhos
- PR para `main` → lint, testes, verificação do exemplo fictício.
- Tag `v*.*.*` → imagem Docker + instaladores + release.

### Etapas
1. Checkout → 2. `npm ci` → 3. Lint/tipos → 4. Testes (com Chromium) → 5. Build →
6. `docker build`/`push` → 7. `electron-builder` em `windows-latest` e `ubuntu-latest` → 8. Release.

### Estratégia de versionamento
- SemVer (`MAJOR.MINOR.PATCH`); a versão maior também sobe quando `telas.json` muda de forma incompatível.

## 6. Procedimento de Publicação
1. Atualizar `CHANGELOG.md` e versão nos `package.json`.
2. Criar a tag `vX.Y.Z` em `main` e enviar.
3. Conferir a release com os quatro instaladores e a imagem no GHCR.
4. Copiar instaladores e `latest.json` para o endereço interno do MinC, se usado.

Fallback manual: `npm ci && npm run build && npm run dist -w apps/desktop` na máquina do sistema-alvo; `docker build -f docker/Dockerfile .`.

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
**Mitigação:** instalador não assinado; ver seção 13.

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
