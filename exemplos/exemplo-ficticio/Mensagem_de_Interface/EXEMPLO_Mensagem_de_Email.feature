# language: pt
# encoding: utf-8

Funcionalidade: EXEMPLO_Mensagem_de_Email

  Contexto: Mensagens de e-mail
    Dado que o sistema envia os seguintes e-mails

  Cenário: E-mail-01 - Cadastro recebido
    Quando a parceira conclui o cadastro
    Então o sistema envia ao responsável a mensagem
      | Assunto            | Corpo                                                  |
      | Cadastro recebido  | Recebemos o cadastro da parceira e ele está em análise. |
