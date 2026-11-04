# language: pt
# encoding: utf-8

Funcionalidade: 03_Portal_Contato

  ---

  **COMO** visitante do portal **Exemplo**<br>

  **QUERO** enviar uma mensagem à equipe<br>

  **PARA** tirar dúvidas sobre o programa.

  ---
  # Módulo: 01 Portal
  # Tipo: Manual
  # Fluxo: Envio de mensagem pelo formulário de contato

  Contexto: Critérios de Aceitação
    Dado que o visitante aciona a opção **Contato** na Página Inicial
    E o sistema apresenta os <Campos>
      | Campo              | Editável | Obrigatório | Regras                                                                  |
      | Nome               | S        | S           | -                                                                       |
      | E-mail             | S        | S           | [RNG-03](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/3)      |
      | Confirme o E-mail  | S        | S           | [RNG-03](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/3)      |
      | Fone               | S        | N           | -                                                                       |
      | Mensagem           | S        | S           | -                                                                       |
      | Código verificador | S        | S           | [RNG-04](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/4)      |

  @fluxo-principal
  Cenário: 01. Enviar mensagem
    Dado que o visitante preenche os <Campos>
      | Campo             | Exemplo                     |
      | Nome              | Pessoa Um Exemplo           |
      | E-mail            | pessoa.um@exemplo.com.br    |
      | Confirme o E-mail | pessoa.um@exemplo.com.br    |
      | Fone              | (61) 3322-4400              |
      | Mensagem          | Como a empresa pode aderir? |
    Quando o visitante aciona a opção **Enviar**
    Então o sistema apresenta a [MSG-02](#/scenario/Mensagem_de_Interface_EXEMPLO_Mensagens_de_Interface/2)

  @validacao
  Cenário: 02. E-mails diferentes
    Quando o visitante informa no campo **Confirme o E-mail** um valor diferente do **E-mail**
    Então o sistema apresenta a [MSG-03](#/scenario/Mensagem_de_Interface_EXEMPLO_Mensagens_de_Interface/3)

  @prototipo
  Cenário: Protótipo
  **Contato**
  ![Image](03_Portal_Contato.png)
