# language: pt
# encoding: utf-8

Funcionalidade: 01_Portal_Início

  ---

  **COMO** visitante do portal **Exemplo**<br>

  **QUERO** ver as opções do programa<br>

  **PARA** encontrar parceiras e falar com a equipe.

  ---
  # Módulo: 01 Portal
  # Tipo: Consulta
  # Fluxo: Página inicial pública

  Contexto: Critérios de Aceitação
    Dado que o visitante acessa o endereço do portal

  @fluxo-principal
  Cenário: 01. Página inicial
    Quando o visitante acessa o portal
    Então o sistema apresenta os <Campos>
      | Campo        | Editável | Obrigatório | Regras |
      | Apresentação | N        | S           | -      |
    E o visitante pode acionar a opção **Lista de Parceiras**
    E o visitante pode acionar a opção **Contato**
    E o visitante pode acionar a opção **Entrar** na área restrita

  @prototipo
  Cenário: Protótipo
  **Página inicial**
  ![Image](01_Portal_Início.png)
