# language: pt
# encoding: utf-8

Funcionalidade: EXEMPLO_Regras_de_negócio

  Contexto: Critério de Aceitação
    Dado que o sistema deva atender as seguintes regras de negócio

  Cenário: RNG-01 - Validação de CNPJ
    Quando o usuário informa um CNPJ
    Então o sistema valida os dígitos verificadores, aceitando o formato alfanumérico

  Cenário: RNG-02 - Validação de CPF
    Quando o usuário informa um CPF
    Então o sistema valida os dígitos verificadores

  Cenário: RNG-03 - Validação de e-mail
    Quando o usuário informa um e-mail
    Então o sistema confere o formato nome@dominio

  Cenário: RNG-04 - Código verificador
    Quando o visitante envia um formulário público
    Então o sistema exige o código verificador

  Cenário: RNG-05 - Declaração de veracidade
    Quando a parceira conclui o cadastro
    Então o sistema exige a marcação da declaração de veracidade das informações

  Cenário: LOV-01 - Situação
    Quando o sistema apresenta a situação da parceira
    Então o sistema usa os valores
      | Situação           |
      | Aguardando análise |
      | Autorizada         |
      | Não autorizada     |
      | Inativa            |

  Cenário: LOV-02 - Documentos da parceira
    Quando a parceira envia os documentos
    Então o sistema exige os arquivos em PDF
      | Documento                  |
      | Contrato social            |
      | Comprovante de endereço    |
      | Certidão de regularidade   |
