import { sorteador } from '../../src/util/hash.js';
import { criarProjeto, type ProjetoTemp } from './projeto.js';
import { fabricaFeature } from './feature.js';

const PALAVRAS = ['beneficiária', 'operadora', 'certificado', 'responsável', 'cadastro', 'faixa', 'salarial', 'divulgação', 'análise', 'situação', 'relatório', 'empresa', 'documento', 'telefone', 'endereço', 'município', 'trabalhador', 'cultura', 'programa', 'inscrição'];

/**
 * Especificação ~5× o piloto (CT-P06): `modulos` × `porModulo` funcionalidades com `cenarios` cenários cada,
 * mais 250 regras. Textos variados e determinísticos.
 */
export async function criarEspecificacaoGrande(o = { modulos: 20, porModulo: 10, cenarios: 5, regras: 250 }): Promise<ProjetoTemp> {
  const p = await criarProjeto();
  const r = sorteador('grande');
  const frase = (n: number) => Array.from({ length: n }, () => PALAVRAS[Math.floor(r() * PALAVRAS.length)]).join(' ');
  for (let m = 1; m <= o.modulos; m++) {
    const pasta = `${String(10 + m).padStart(2, '0')}_Modulo_${m}`;
    for (let f = 1; f <= o.porModulo; f++) {
      const nome = `${String(f).padStart(2, '0')}_Tela_${m}_${f}`;
      const extras = Array.from({ length: o.cenarios - 1 }, (_, c) => `  @fluxo-alternativo\n  Cenário: ${String(c + 2).padStart(2, '0')}. ${frase(3)}\n    Quando o usuário aciona a opção **${frase(1)}**\n    Então o sistema apresenta ${frase(12)}`);
      await p.escrever(`${pasta}/${nome}.feature`, fabricaFeature({
        nome, tipo: 'Manual', campos: [{ nome: 'CNPJ', regras: '[RNG-01](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/1)' }, { nome: frase(2) }, { nome: frase(2), editavel: false }],
        passosPrincipais: [`    Quando o usuário aciona a opção **Salvar**`, `    Então o sistema registra ${frase(15)}`], cenariosExtras: extras,
      }));
    }
  }
  const regras = Array.from({ length: o.regras }, (_, i) => `  Cenário: RNG-${100 + i} - ${frase(3)}\n    Quando ${frase(8)}\n    Então ${frase(14)}`);
  await p.escrever('Regras_de_negócio/EXTRA_Regras_de_negócio.feature', `# language: pt\nFuncionalidade: EXTRA_Regras_de_negócio\n\n  Contexto: Regras\n    Dado as regras\n\n${regras.join('\n\n')}\n`);
  return p;
}
