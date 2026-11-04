# language: pt
# encoding: utf-8

Funcionalidade: 01_Acesso_Entrar

  ---

  **COMO** responsável por uma parceira<br>

  **QUERO** entrar na área restrita<br>

  **PARA** manter os dados da minha empresa.

  ---
  # Módulo: 02 Acesso
  # Tipo: Manual
  # Fluxo: Autenticação por CPF e senha

  Contexto: Critérios de Aceitação
    Dado que o visitante aciona a opção **Entrar** na Página Inicial
    E o sistema apresenta os <Campos>
      | Campo | Editável | Obrigatório | Regras                                                                  |
      | CPF   | S        | S           | [RNG-02](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/2)      |
      | Senha | S        | S           | -                                                                       |

  @fluxo-principal
  Cenário: 01. Entrar
    Dado que o responsável preenche os <Campos>
      | Campo | Exemplo        |
      | CPF   | 123.456.789-09 |
    Quando o responsável aciona a opção **Entrar no sistema**
    Então o sistema apresenta a tela [Gestão de Parceiras](#!/feature/04_Gestão_01_Gestão_Parceiras)

  @validacao
  Cenário: 02. CPF ou senha inválidos
    Quando o responsável aciona a opção **Entrar no sistema** com CPF ou senha inválidos
    Então o sistema apresenta a [MSG-01](#/scenario/Mensagem_de_Interface_EXEMPLO_Mensagens_de_Interface/1)

  @prototipo
  Cenário: Protótipo
  **Entrar**
  ![Image](01_Acesso_Entrar.png)
