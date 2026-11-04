# language: pt
# encoding: utf-8

Funcionalidade: 01_Parceira_Cadastrar

  ---

  **COMO** representante de uma empresa<br>

  **QUERO** cadastrar a empresa como parceira<br>

  **PARA** participar do programa.

  ---
  # Módulo: 03 Cadastro
  # Tipo: Manual
  # Fluxo: Cadastro público da parceira

  Contexto: Critérios de Aceitação
    Dado que o visitante acessa o cadastro de parceira
    E o sistema apresenta os <Campos>
      # Seção: Empresa
      | Campo                    | Editável | Obrigatório | Regras                                                                  |
      | CNPJ                     | S        | S           | [RNG-01](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/1)      |
      | Razão Social             | N        | S           | Preenchida pela consulta do CNPJ                                        |
      | CEP                      | S        | S           | -                                                                       |
      | Fone                     | S        | S           | -                                                                       |
      | Fax                      | S        | N           | -                                                                       |
      | Documentos               | S        | S           | [LOV-02](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/7)      |
      | Declaração de veracidade | S        | S           | [RNG-05](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/5)      |

  @fluxo-principal
  Cenário: 01. Cadastrar parceira
    Dado que o representante preenche os <Campos>
      | Campo | Exemplo            |
      | CNPJ  | 12.ABC.345/01DE-35 |
      | CEP   | 70.070-150         |
      | Fone  | (61) 98888-7777    |
    Quando o representante aciona a opção **Salvar**
    Então o sistema apresenta a [MSG-02](#/scenario/Mensagem_de_Interface_EXEMPLO_Mensagens_de_Interface/2)
    E envia o [E-mail-01](#/scenario/Mensagem_de_Interface_EXEMPLO_Mensagem_de_Email/1)

  @fluxo-alternativo
  Cenário: 02. Desistir
    Quando o representante aciona a opção **Cancelar**
    Então o sistema volta à Página Inicial

  @prototipo
  Cenário: Protótipo
  **Cadastro de Parceira**
  ![Image](01_Parceira_Cadastrar.png)
