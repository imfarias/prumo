# language: pt
# encoding: utf-8

Funcionalidade: 02_Portal_Lista_Parceiras

  ---

  **COMO** visitante do portal **Exemplo**<br>

  **QUERO** pesquisar a **Lista de Parceiras**<br>

  **PARA** saber quais empresas participam do programa.

  ---
  # Módulo: 01 Portal
  # Tipo: Consulta
  # Fluxo: Pesquisa pública das parceiras autorizadas

  Contexto: Critérios de Aceitação
    Dado que o visitante aciona a opção **Lista de Parceiras** na Página Inicial
    E o sistema apresenta os <Filtros>
      | Campo    | Editável | Obrigatório | Regras                                                                  |
      | CNPJ     | S        | N           | [RNG-01](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/1)      |
      | Nome     | S        | N           | Pesquisa por parte da razão social                                      |
      | Situação | S        | N           | [LOV-01](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/6)      |

  @fluxo-principal
  Cenário: 01. Pesquisar parceiras
    Dado que o visitante preenche os <Filtros>
      | Campo    | Exemplo            |
      | CNPJ     | 12.ABC.345/01DE-35 |
      | Nome     | Livraria Exemplo   |
      | Situação | Autorizada         |
    Quando o visitante aciona a opção **Filtrar**
    Então o sistema apresenta as parceiras com as <Colunas>
      | Campo    | Editável | Obrigatório | Regras |
      | CNPJ     | N        | S           | -      |
      | Nome     | N        | S           | -      |
      | Município| N        | S           | -      |
      | Situação | N        | S           | -      |

  @fluxo-alternativo
  Cenário: 02. Pesquisa sem resultado
    Quando o visitante aciona a opção **Filtrar** e nenhuma parceira atende aos filtros
    Então o sistema apresenta a [MSG-04](#/scenario/Mensagem_de_Interface_EXEMPLO_Mensagens_de_Interface/4)

  @prototipo
  Cenário: Protótipo
  **Lista de Parceiras**
  ![Image](02_Portal_Lista_Parceiras.png)
