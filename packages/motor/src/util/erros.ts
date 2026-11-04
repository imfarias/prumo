/** Falha de uso (pasta, configuração, navegador). Problemas do requisito viram `Achado`, não exceção. */
export class ErroPrumo extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroPrumo';
  }
}
