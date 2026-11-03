# language: pt
# encoding: utf-8

Funcionalidade: 01_Gestão_Parceiras

  ---

  **COMO** gestor do programa<br>

  **QUERO** acompanhar as parceiras cadastradas<br>

  **PARA** analisar os pedidos de adesão.

  ---
  # Módulo: 04 Gestão
  # Tipo: Consulta
  # Fluxo: Pesquisa das parceiras pelo gestor

  Contexto: Critérios de Aceitação
    Dado que o gestor está autenticado
    E o sistema apresenta os <Filtros>
      | Campo            | Editável | Obrigatório | Regras                                                                  |
      | CNPJ             | S        | N           | [RNG-01](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/1)      |
      | Situação         | S        | N           | [LOV-01](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/6)      |
      | Data de cadastro | S        | N           | -                                                                       |

  @fluxo-principal
  Cenário: 01. Pesquisar
    Quando o gestor aciona a opção **Filtrar**
    Então o sistema apresenta as <Colunas>
      | Campo            | Editável | Obrigatório | Regras |
      | CNPJ             | N        | S           | -      |
      | Razão Social     | N        | S           | -      |
      | Data de cadastro | N        | S           | -      |
      | Situação         | N        | S           | -      |
    E o gestor pode acionar a opção **Exportar Planilha**

  @prototipo
  Cenário: Protótipo
  **Gestão de Parceiras**
  ![Image](01_Gestão_Parceiras.png)
