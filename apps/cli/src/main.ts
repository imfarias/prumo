#!/usr/bin/env node
import path from 'node:path';
import { Command, Option } from 'commander';
import {
  ErroPrumo, VERSAO_MOTOR, compararComAtuais, formatarJson, formatarTexto, gerar, gerarECapturar, migrarConfig,
  preparar, resumo, verificarPreparado, type Achado, type Recorte,
} from '@prumo/motor';

/** Códigos de saída: 0 ok · 1 verificação com erro · 2 erro de uso · 3 inesperado. */
const SAIDA = { ok: 0, erros: 1, uso: 2, inesperado: 3 } as const;

let verboso = false;
const cores = process.stdout.isTTY && !process.env.NO_COLOR;
const log = (t: string) => process.stderr.write(t + '\n');

function recorte(o: { modulo?: string[]; tela?: string[] }): Recorte {
  return { modulos: o.modulo, telas: o.tela };
}

function cabecalho(p: { config: { projeto: { nome: string; versao: string }; identidade: { design_system: string } } }) {
  return `Prumo ${VERSAO_MOTOR} · ${p.config.projeto.nome} ${p.config.projeto.versao} · kit ${p.config.identidade.design_system}`;
}

function imprimirAchados(achados: Achado[], destino: (t: string) => void) {
  const r = resumo(achados);
  destino(`Verificação: ${r.erros} ${r.erros === 1 ? 'erro' : 'erros'}, ${r.avisos} ${r.avisos === 1 ? 'aviso' : 'avisos'}${verboso ? `, ${r.infos} informações` : ''}`);
  const t = formatarTexto(achados, { cores, incluirInfo: verboso });
  if (t) destino(t);
}

const repetivel = (v: string, anterior: string[] = []) => [...anterior, v];

const programa = new Command()
  .name('prumo')
  .description('Gera protótipos, documentação e verificação a partir das especificações Gherkin.')
  .version(VERSAO_MOTOR, '-v, --version', 'mostra a versão')
  .helpOption('-h, --help', 'mostra esta ajuda')
  .addHelpCommand('ajuda [comando]', 'mostra a ajuda de um comando')
  .option('--verboso', 'mostra informações de depuração')
  .hook('preAction', (cmd) => {
    verboso = !!cmd.opts().verboso;
  })
  .configureOutput({ outputError: (t, escrever) => escrever(t.replace(/^error:/, 'erro:')) });

const opcoesComuns = (c: Command) =>
  c
    .option('--specs <pasta>', 'pasta de especificações', '.')
    .option('--projeto <arquivo>', 'projeto.yml (padrão: <specs>/projeto.yml, depois config.properties)');

const opcoesRecorte = (c: Command) =>
  c.option('--modulo <nome>', 'só este módulo (repetível)', repetivel).option('--tela <nome>', 'só esta tela (repetível)', repetivel);

opcoesComuns(programa.command('verificar'))
  .description('verifica links, referências, máscaras e protótipos; sai com 1 se houver erro')
  .addOption(new Option('--formato <formato>', 'formato da saída').choices(['texto', 'json']).default('texto'))
  .option('--avisos-quebram', 'avisos também fazem sair com 1')
  .action(async (o) => {
    const p = await preparar(o.specs, { projeto: o.projeto });
    const achados = verificarPreparado(p);
    const r = resumo(achados);
    if (o.formato === 'json') {
      process.stdout.write(formatarJson(achados));
      log(`${r.erros} erros, ${r.avisos} avisos`);
    } else {
      console.log(cabecalho(p));
      console.log(`${p.modelo.telas.length} telas · ${p.arquivos.length} arquivos · configuração: ${p.fonte}\n`);
      imprimirAchados(achados, console.log);
    }
    process.exitCode = r.erros || (o.avisosQuebram && r.avisos) ? SAIDA.erros : SAIDA.ok;
  });

opcoesRecorte(opcoesComuns(programa.command('gerar')))
  .description('gera o modelo de telas (telas.json) e o HTML de cada tela e estado')
  .option('--saida <pasta>', 'pasta de saída', path.join('saida', 'prototipos'))
  .action(async (o) => {
    const g = await gerar(o.specs, { projeto: o.projeto, saida: o.saida, recorte: recorte(o) });
    const estados = g.paginas.length;
    const telas = new Set(g.paginas.map((x) => x.tela)).size;
    console.log(cabecalho(g.preparado));
    console.log(`${telas} telas · ${estados} estados · saída: ${path.relative(process.cwd(), g.saida) || '.'}`);
    console.log(`Modelo: ${path.relative(process.cwd(), g.arquivoModelo)}\n`);
    imprimirAchados(g.achados, console.log);
  });

opcoesRecorte(opcoesComuns(programa.command('capturar')))
  .description('gera as telas e grava os PNGs nas pastas das features (Especificações/<módulo>/<tela>.png)')
  .option('--saida <pasta>', 'pasta do HTML gerado', path.join('saida', 'prototipos'))
  .option('--largura <px>', 'largura da captura (padrão: largura_captura do projeto)', (v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 320 || n > 3840) throw new ErroPrumo('CLI-06', 'A largura deve ser um inteiro entre 320 e 3840.');
    return n;
  })
  .option('--forcar', 'regrava os PNGs mesmo sem mudança')
  .action(async (o) => {
    const r = await gerarECapturar(o.specs, {
      projeto: o.projeto, saida: o.saida, recorte: recorte(o), largura: o.largura, forcar: o.forcar,
      aoGravar: (c) => verboso && log(`${c.situacao === 'gravado' ? 'gravado    ' : 'sem mudança'} ${path.relative(process.cwd(), c.destino)}`),
    });
    const gravados = r.capturas.filter((c) => c.situacao === 'gravado').length;
    console.log(cabecalho(r.preparado));
    console.log(`${gravados} PNGs gravados, ${r.capturas.length - gravados} sem mudança.`);
    if (r.bloqueados.length) log(`Aviso: ${r.bloqueados.length} tentativas de acesso à rede foram bloqueadas.`);
    // Depois da captura as imagens existem; a verificação de imagem inexistente é refeita.
    const p = await preparar(o.specs, { projeto: o.projeto });
    console.log('');
    imprimirAchados(verificarPreparado(p), console.log);
  });

opcoesRecorte(opcoesComuns(programa.command('comparar-png')))
  .description('compara os PNGs atuais das features com os gerados pelo Prumo (relatório lado a lado)')
  .option('--saida <pasta>', 'pasta do relatório', path.join('saida', 'comparacao'))
  .action(async (o) => {
    const r = await compararComAtuais(o.specs, { projeto: o.projeto, saida: o.saida, recorte: recorte(o) });
    const comRef = r.itens.filter((i) => i.diferenca !== null);
    const media = comRef.length ? Math.round((comRef.reduce((s, i) => s + i.diferenca!, 0) / comRef.length) * 100) / 100 : 0;
    console.log(`${r.itens.length} telas comparadas (${comRef.length} com PNG atual); diferença média ${media}%.`);
    for (const i of [...comRef].sort((a, b) => b.diferenca! - a.diferenca!).slice(0, verboso ? undefined : 10)) {
      console.log(`  ${String(i.diferenca).padStart(6)}%  ${i.modulo}/${i.tela}`);
    }
    console.log(`Relatório: ${path.relative(process.cwd(), r.relatorio)}`);
  });

programa
  .command('migrar-config')
  .description('cria o projeto.yml a partir do config.properties do Pirilampo')
  .option('--specs <pasta>', 'pasta de especificações', '.')
  .option('--forcar', 'sobrescreve um projeto.yml existente')
  .action(async (o) => {
    const r = await migrarConfig(path.resolve(o.specs), { forcar: o.forcar });
    console.log(`Criado: ${path.relative(process.cwd(), r.caminho)}`);
  });

try {
  await programa.parseAsync();
} catch (e) {
  if (e instanceof ErroPrumo) {
    log(`erro: ${e.message}`);
    process.exitCode = SAIDA.uso;
  } else {
    log(`erro inesperado: ${(e as Error).message}${verboso ? `\n${(e as Error).stack}` : '\nRode de novo com --verboso para ver os detalhes.'}`);
    process.exitCode = SAIDA.inesperado;
  }
}
