# language: pt
# encoding: utf-8

Funcionalidade: 01_API_Indicadores

  ---

  **COMO** sistema externo<br>

  **QUERO** consultar o indicador de **Parceiras**<br>

  **PARA** publicar os números do programa.

  ---
  # Módulo: 05 API
  # Tipo: Integração
  # Fluxo: Consulta pública ao recurso /api/parceiras/{indicador}

  Contexto: Critérios de Aceitação
    Dado que o sistema externo envia uma requisição **GET** para "/api/parceiras/{indicador}"
    Então o sistema responde em JSON sem exigir autenticação

  @fluxo-principal
  Cenário: 01. Total
    Quando a requisição não informa filtros
    Então o sistema retorna o total do indicador
      | Campo | Exemplo |
      | valor | 1250    |

  @consulta
  Cenário: 02. Por período
    Quando a requisição informa "ano" e, opcionalmente, "mes"
    Então o sistema retorna o indicador por período
      | Campo | Exemplo |
      | ano   | 2026    |
      | mes   | 06      |
      | valor | 320     |

  @prototipo
  Cenário: Protótipo
  **API de Indicadores**
  ![Image](01_API_Indicadores.png)
