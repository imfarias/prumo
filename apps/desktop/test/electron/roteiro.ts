/**
 * Roda dentro do Electron (processo principal): exercita o NavegadorElectron e grava o resultado em JSON.
 * Uso: electron roteiro.mjs <resultado.json> <pasta-de-trabalho> <pasta-do-exemplo>
 */
import { cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { gerarECapturar, gerarPdf, paginasDosDestinos } from '@prumo/motor';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { NavegadorElectron } from '../../src/principal/navegador-electron.js';

const [resultado, trabalho, exemplo] = process.argv.slice(-3) as [string, string, string];
const REFERENCIAS = ['01_Portal/02_Portal_Lista_Parceiras.png', '03_Cadastro/01_Parceira_Cadastrar.png', '04_Gestão/01_Gestão_Parceiras.png', '01_Portal/03_Portal_Contato.png'];

async function executar() {
  const saida: Record<string, unknown> = {};
  const specs = path.join(trabalho, 'specs');
  await cp(exemplo, specs, { recursive: true, filter: (s) => !s.endsWith('.png') });

  // CT-N01: os 7 PNGs do exemplo, comparados com a referência aprovada.
  const nav = new NavegadorElectron();
  const r = await gerarECapturar(specs, { saida: path.join(trabalho, 'html'), navegador: nav });
  saida.capturas = r.capturas.map((c) => c.situacao);
  saida.bloqueadosExemplo = r.bloqueados;
  saida.diferencas = {} as Record<string, unknown>;
  for (const rel of REFERENCIAS) {
    const ref = PNG.sync.read(await readFile(path.join(exemplo, rel)));
    const novo = PNG.sync.read(await readFile(path.join(specs, rel)));
    const mesmoTamanho = ref.width === novo.width && ref.height === novo.height;
    (saida.diferencas as Record<string, unknown>)[rel] = {
      largura: novo.width,
      altura: [ref.height, novo.height],
      porcento: mesmoTamanho ? (pixelmatch(ref.data, novo.data, null, ref.width, ref.height, { threshold: 0.1 }) / (ref.width * ref.height)) * 100 : 100,
    };
  }

  // CT-N02: página de 12.000 px capturada inteira, com o bloco vermelho no fim.
  await nav.abrir();
  const alta = 'data:text/html;charset=utf-8,' + encodeURIComponent('<body style="margin:0"><div style="height:11900px;background:#fff"></div><div style="height:100px;background:#f00"></div></body>');
  const png = PNG.sync.read(await nav.capturar(alta, { largura: 800 }));
  const i = ((png.height - 50) * png.width + 400) * 4;
  saida.alta = { altura: png.height, fim: [png.data[i], png.data[i + 1], png.data[i + 2]] };

  // CT-N04: axe devolve violações no formato da porta.
  const ruim = 'data:text/html;charset=utf-8,' + encodeURIComponent('<html><body><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><button></button></body></html>');
  const axe = await nav.axe(ruim);
  saida.axe = axe.violacoes.map((v) => v.id).sort();

  // CT-N05: página que pede https:// → bloqueado e registrado.
  const externa = 'data:text/html;charset=utf-8,' + encodeURIComponent('<img src="https://exemplo.invalid/rastreio.png"><p>x</p>');
  await nav.capturar(externa, { largura: 400, altura: 200 });
  saida.bloqueados = nav.bloqueados();
  await nav.fechar();

  // CT-N03: PDF com sumário igual aos destinos nomeados.
  const pdf = path.join(trabalho, 'portal.pdf');
  const p = await gerarPdf(specs, { saida: pdf, recorte: { modulos: ['01_Portal'] }, navegador: new NavegadorElectron() });
  const destinos = (await paginasDosDestinos(await readFile(pdf))) as Map<string, number>;
  saida.pdf = { paginas: p.paginas, sumario: [...p.sumario], destinos: [...destinos].filter(([k]) => k.startsWith('f-')) };
  return saida;
}

// Sem janela principal: fechar as janelas fora da tela não deve encerrar o roteiro.
app.on('window-all-closed', () => undefined);
void app.whenReady().then(async () => {
  try {
    await writeFile(resultado, JSON.stringify({ ok: true, ...(await executar()) }, null, 2));
  } catch (e) {
    await writeFile(resultado, JSON.stringify({ ok: false, erro: String((e as Error).stack ?? e) }));
  }
  app.exit(0);
});
