import { execFileSync, spawn } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_DESKTOP, caminhoDoElectron } from '../fabricas/electron.js';
import { abrirPrograma, type Programa } from '../fabricas/programa.js';
import { servirRelease, type ReleaseFalsa } from '../fabricas/release.js';
import { criarEspecificacaoGrande } from '../../../../packages/motor/test/fabricas/especificacao-grande.js';
import { criarRepositorio } from '../../../../packages/motor/test/fabricas/repositorio-git.js';

const LONGO = 120_000;
let p: Programa | undefined;
let rel: ReleaseFalsa | undefined;
afterEach(async () => {
  await p?.fechar();
  await rel?.fechar();
  p = undefined;
  rel = undefined;
});

const esperarMensagem = (re: RegExp, timeout = 60_000) => expect.poll(() => p!.mensagem().catch(() => ''), { timeout, interval: 100 }).toMatch(re);
/** Só o que a janela pode pedir: o próprio programa, os arquivos do projeto e conteúdo embutido. */
const LOCAL = /^(file|prumo-arquivo|data|blob|devtools):/;

describe('programa de computador (E2E)', () => {
  it('CT-E01/E13/E16: abre o exemplo, grava o recente, é blindado e não usa a rede', async () => {
    p = await abrirPrograma();
    await p.abrirExemplo();
    await esperarMensagem(/Projeto aberto: Programa Exemplo 1\.0 · 7 telas · 0 erros, 0 avisos/);
    const prefs = JSON.parse(readFileSync(path.join(p.userData, 'preferencias.json'), 'utf8'));
    expect(prefs.recentes[0].caminho).toBe(p.specs);

    // Segurança: nada de Node na janela, canal fora da lista recusado, navegação externa bloqueada.
    expect(await p.w.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined');
    expect(await p.w.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe('undefined');
    const recusa = await p.w.evaluate(() => (window as unknown as { prumo: { invocar: (c: string) => Promise<unknown> } }).prumo.invocar('fs:apagarTudo').then(() => 'aceitou', (e: Error) => e.message));
    expect(recusa).not.toBe('aceitou');
    for (const t of ['verificacao', 'prototipos', 'configuracao', 'documentacao', 'comparar', 'preferencias']) await p.ir(t);
    expect(p.pedidos.filter((u) => !LOCAL.test(u))).toEqual([]);
    expect(p.erros).toEqual([]);

    // Por último: a navegação bloqueada deixa o Playwright esperando por ela.
    const antes = p.w.url();
    void p.w.evaluate(() => {
      location.href = 'https://exemplo.invalid/';
    }).catch(() => undefined);
    await new Promise((ok) => setTimeout(ok, 800));
    expect(await p.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.getURL())).toBe(antes);
  }, LONGO);

  it('CT-E02/E11: muda versão e cor primária, avisa ao sair sem salvar, salva com Ctrl+S preservando o arquivo', async () => {
    p = await abrirPrograma();
    await p.abrirExemplo();
    const original = await readFile(path.join(p.specs, 'projeto.yml'), 'utf8');
    await p.ir('configuracao');
    await p.w.fill('[data-testid="config-projeto-versao"]', '2.0');
    await p.w.fill('[data-testid="config-cor-primaria-hex"]', '#0B6E4F');
    await expect.poll(() => p!.w.locator('[data-testid="config-diff"]').textContent()).toContain('#0B6E4F');
    await expect.poll(() => p!.w.locator('[data-testid="config-contraste"]').textContent()).toMatch(/\d+(\.\d+)?:1/);

    // DSK-04: sair sem salvar pede confirmação; recusar mantém na tela.
    const avisos: string[] = [];
    p.w.once('dialog', (d) => {
      avisos.push(d.message());
      void d.dismiss();
    });
    await p.w.click('[data-testid="app-menu-verificacao"]');
    await expect.poll(() => avisos).toEqual([expect.stringContaining('mudanças não salvas')]);
    expect(await p.w.getAttribute('[data-testid="app-menu-configuracao"]', 'aria-current')).toBe('page');

    await p.w.focus('[data-testid="config-projeto-versao"]');
    await p.w.keyboard.press('Control+s');
    await esperarMensagem(/Configuração salva\. 2 linhas alteradas/);
    const novo = await readFile(path.join(p.specs, 'projeto.yml'), 'utf8');
    const [a, b] = [original.split('\n'), novo.split('\n')];
    expect(b).toHaveLength(a.length);
    const mudadas = b.filter((l, i) => l !== a[i]);
    expect(mudadas).toHaveLength(2);
    expect(mudadas.join('\n')).toMatch(/2\.0/);
    expect(mudadas.join('\n')).toMatch(/#0B6E4F/);
    expect(novo.split('\n').filter((l) => l.trim().startsWith('#'))).toEqual(original.split('\n').filter((l) => l.trim().startsWith('#')));
  }, LONGO);

  it('CT-E03: achado de link quebrado abre o editor no arquivo e linha certos', async () => {
    p = await abrirPrograma({
      preparar: async (specs) => {
        const f = path.join(specs, '01_Portal', '03_Portal_Contato.feature');
        const t = await readFile(f, 'utf8');
        await writeFile(f, t.replace('[RNG-04](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/4)', '[RNG-04](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/99)'));
      },
    });
    await p.abrirExemplo();
    await p.ir('verificacao');
    await p.w.click('[data-testid="verificacao-verificar"]');
    await expect.poll(() => p!.w.locator('[data-testid="verificacao-resumo"]').textContent()).toMatch(/1 erro/);
    await p.w.click('[data-testid="verificacao-achado-0"]');
    await expect.poll(() => (existsSync(p!.editorSaida) ? readFileSync(p!.editorSaida, 'utf8') : ''), { timeout: 10_000 }).toMatch(/03_Portal_Contato\.feature:28\n$/);
  }, LONGO);

  it('CT-E04/E05: PNGs de um módulo, painel com sinais e ajuste de campo salvo no overrides', async () => {
    p = await abrirPrograma({
      preparar: async (specs) => {
        for (const n of await readdir(path.join(specs, '01_Portal'))) if (n.endsWith('.png')) await rm(path.join(specs, '01_Portal', n));
      },
    });
    await p.abrirExemplo();
    await p.ir('prototipos');
    await p.w.selectOption('[data-testid="prototipos-modulo"]', '01_Portal');
    await p.w.click('[data-testid="prototipos-gerar-modulo"]');
    await p.w.waitForSelector('[data-testid="tarefa-andamento"]');
    await esperarMensagem(/Módulo 01_Portal: 3 PNGs gravados, 0 sem mudança/);
    expect((await readdir(path.join(p.specs, '01_Portal'))).filter((n) => n.endsWith('.png'))).toHaveLength(3);

    await p.w.selectOption('[data-testid="prototipos-modulo"]', '');
    await p.w.click('[data-testid="prototipos-tela-03_Portal_Contato"]');
    await p.w.waitForSelector('[data-testid="prototipos-sinais"]');
    expect(await p.w.locator('[data-testid="prototipos-sinais"]').textContent()).toContain('Fone');
    const overrides = path.join(p.specs, 'telas.overrides.yml');
    const antes = await readFile(overrides, 'utf8');
    await p.w.selectOption('[data-testid="prototipos-override-componente-Fone"]', 'tel');
    await expect.poll(() => p!.w.locator('[data-testid="prototipos-override-diff"]').textContent()).toContain('tel');
    await p.w.click('[data-testid="prototipos-override-salvar"]');
    await esperarMensagem(/Ajuste salvo no telas\.overrides\.yml/);
    const depois = await readFile(overrides, 'utf8');
    expect(depois.split('\n')[0]).toBe(antes.split('\n')[0]);
    expect(depois).toMatch(/03_Portal_Contato:[\s\S]*Fone: \{[^}]*componente: tel/);
    expect(depois.split('\n').filter((l, i) => l !== antes.split('\n')[i])).toHaveLength(1);
  }, LONGO);

  it('CT-E06: documentação em pasta, arquivo único, "Ver aqui" e PDF no caminho escolhido', async () => {
    // O PDF vai para fora da pasta do projeto: só é aceito porque veio do diálogo "Salvar como".
    p = await abrirPrograma({ dialogos: ({ raiz }) => ({ salvarComo: [path.join(raiz, 'fora', 'Programa-Exemplo-1.0.pdf')] }) });
    const destinoPdf = path.join(p.raiz, 'fora', 'Programa-Exemplo-1.0.pdf');
    await p.abrirExemplo();
    await p.ir('documentacao');

    const html = path.join(p.specs, '..', 'html');
    await p.w.click('[data-testid="docs-gerar"]');
    await esperarMensagem(/Documentação gerada em .*html/);
    expect(existsSync(path.join(html, 'index.html'))).toBe(true);
    expect(existsSync(path.join(html, 'recursos', 'dados.js'))).toBe(true);
    for (const n of await readdir(html, { recursive: true })) expect(String(n)).not.toMatch(/\.tmp/);

    await p.w.click('[data-testid="docs-ver-aqui"]');
    const quadro = p.w.frameLocator('[data-testid="docs-iframe"]');
    await expect.poll(() => quadro.locator('h1:visible').first().textContent({ timeout: 10_000 }).catch(() => ''), { timeout: 15_000 }).toContain('Programa Exemplo');

    const anterior = await p.mensagem();
    await p.w.click('[data-testid="docs-modo-unico"]');
    await p.w.click('[data-testid="docs-gerar"]');
    await expect.poll(() => p!.mensagem().catch(() => ''), { timeout: 60_000 }).not.toBe(anterior);
    await esperarMensagem(/Documentação gerada em .*\(\d+ KB\)/);

    await p.w.click('[data-testid="pdf-gerar"]');
    await esperarMensagem(/PDF gerado: \d+ páginas/, 90_000);
    expect(readFileSync(destinoPdf).subarray(0, 5).toString()).toBe('%PDF-');
  }, 240_000);

  it('CT-E08: cancelar a documentação de uma especificação grande', async () => {
    const grande = await criarEspecificacaoGrande();
    p = await abrirPrograma({
      semProjeto: true,
      preparar: async (specs) => {
        await cp(grande.dir, specs, { recursive: true });
      },
    });
    await grande.limpar();
    await p.abrirExemplo();
    await p.ir('documentacao');
    await p.w.click('[data-testid="docs-gerar"]');
    await p.w.click('[data-testid="tarefa-cancelar"]', { timeout: 10_000 });
    await esperarMensagem(/^Cancelado\./);
    expect(await p.w.locator('[data-testid="tarefa-andamento"]').textContent()).toContain('Cancelado');
    const html = path.join(p.specs, '..', 'html');
    if (existsSync(html)) for (const n of await readdir(html, { recursive: true })) expect(String(n)).not.toMatch(/\.tmp/);
  }, LONGO);

  it('CT-E07: comparar com pasta anterior lista nova, alterada e removida e abre a alterada', async () => {
    p = await abrirPrograma({
      dialogos: ({ raiz }) => ({ escolherPasta: [path.join(raiz, 'anterior')] }),
      preparar: async (specs) => {
        const anterior = path.join(specs, '..', '..', 'anterior');
        await cp(specs, anterior, { recursive: true });
        // removida: a API só existe na anterior
        await rm(path.join(specs, '05_API'), { recursive: true });
        // alterada: um dado de exemplo muda no Contato
        const contato = path.join(specs, '01_Portal', '03_Portal_Contato.feature');
        await writeFile(contato, (await readFile(contato, 'utf8')).replace('(61) 3322-4400', '(61) 3322-9999'));
        // nova: uma funcionalidade a mais na atual
        const nova = await readFile(path.join(specs, '02_Acesso', '01_Acesso_Entrar.feature'), 'utf8');
        await writeFile(path.join(specs, '02_Acesso', '02_Acesso_Recuperar.feature'), nova.replace('Funcionalidade: 01_Acesso_Entrar', 'Funcionalidade: 02_Acesso_Recuperar'));
      },
    });
    await p.abrirExemplo();
    await p.ir('comparar');
    await p.w.click('[data-testid="comparar-tipo-pasta"]');
    await p.w.click('[data-testid="comparar-pasta"]');
    await p.w.click('[data-testid="comparar-executar"]');
    await esperarMensagem(/Comparado com .*: 1 novas, 1 alteradas, 1 removidas/);
    await p.w.locator('[data-testid^="comparar-item-"]', { hasText: 'cenário' }).first().click();
    const quadro = p.w.frameLocator('[data-testid="comparar-iframe"]');
    await expect.poll(() => quadro.locator('body').textContent({ timeout: 10_000 }).catch(() => ''), { timeout: 15_000 }).toContain('3322-9999');
  }, LONGO);

  it('CT-E07: comparar com uma tag do Git, sem checkout', async () => {
    const repo = await criarRepositorio();
    p = await abrirPrograma({
      semProjeto: true,
      preparar: async (specs) => {
        await cp(repo.raizGit, path.dirname(specs), { recursive: true });
      },
    });
    await repo.limpar();
    await p.abrirExemplo();
    await p.ir('comparar');
    await p.w.click('[data-testid="comparar-tipo-ref"]');
    await p.w.fill('[data-testid="comparar-ref"]', 'v1');
    await p.w.click('[data-testid="comparar-executar"]');
    // Mesmas mudanças da fábrica da 0002: Ajuda e Empresas novas, Contato alterada, API e Parceiras removidas (renomeação sugerida).
    await esperarMensagem(/Comparado com v1: 2 novas, 1 alteradas, 2 removidas/);
    // Sem checkout: a branch e a árvore de trabalho continuam como estavam.
    const git = (...a: string[]) => execFileSync('git', a, { cwd: path.dirname(p!.specs), encoding: 'utf8' }).trim();
    expect(git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(git('status', '--porcelain', '--', path.basename(p.specs))).toBe('');
  }, LONGO);

  it('CT-E09: prévia ao vivo atualiza a verificação quando o .feature muda fora do programa', async () => {
    p = await abrirPrograma();
    await p.abrirExemplo();
    await p.ir('verificacao');
    const f = path.join(p.specs, '01_Portal', '03_Portal_Contato.feature');
    const t = await readFile(f, 'utf8');
    const inicio = Date.now();
    await writeFile(f, t.replace('[RNG-04](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/4)', '[RNG-04](#/scenario/Regras_de_negócio_EXEMPLO_Regras_de_negócio/99)'));
    await expect.poll(() => p!.w.locator('[data-testid="app-projeto"]').textContent(), { timeout: 5000, interval: 100 }).toMatch(/1 erro/);
    expect(Date.now() - inicio).toBeLessThanOrEqual(3000);
  }, LONGO);

  it('CT-E10: cria projeto novo, abre e verifica sem erros', async () => {
    const pasta = path.join(await mkdtemp(path.join(tmpdir(), 'prumo-novo-')), 'Meu Sistema');
    p = await abrirPrograma({ semProjeto: true, dialogos: { escolherPasta: [pasta] } });
    await p.w.click('[data-testid="projetos-criar"]');
    await p.w.fill('[data-testid="projetos-novo-nome"]', 'Meu Sistema');
    await p.w.click('[data-testid="projetos-novo-pasta"]');
    await p.w.click('[data-testid="projetos-novo-criar"]');
    await esperarMensagem(/Meu Sistema .* 0 erros/);
    expect(existsSync(path.join(pasta, 'projeto.yml')) || (await readdir(pasta, { recursive: true })).some((n) => String(n).endsWith('projeto.yml'))).toBe(true);
    await rm(path.dirname(pasta), { recursive: true, force: true });
  }, LONGO);

  it('CT-E12: segunda instância com pasta entrega a pasta à janela aberta', async () => {
    p = await abrirPrograma();
    const segunda = spawn(caminhoDoElectron(), [APP_DESKTOP, p.specs], { env: { ...process.env, PRUMO_USERDATA: p.userData, PRUMO_ATUALIZACAO: 'desligada' }, stdio: 'ignore' });
    const saiu = new Promise<number | null>((ok) => segunda.once('exit', ok));
    await expect.poll(() => p!.w.locator('[data-testid="app-projeto"]').textContent().catch(() => ''), { timeout: 30_000 }).toContain('Programa Exemplo');
    await expect.poll(() => p!.w.getAttribute('[data-testid="app-menu-verificacao"]', 'aria-current')).toBe('page');
    expect(await Promise.race([saiu, new Promise((ok) => setTimeout(() => ok('viva'), 15_000))])).not.toBe('viva');
  }, LONGO);

  it('CT-E14: axe sem violações sérias ou críticas em todas as telas; teclado pelo menu', async () => {
    p = await abrirPrograma();
    const graves = async (tela: string) => (await p!.axe()).filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${tela}: ${v.id} (${v.nodes})`);
    const achados = await graves('projetos');
    await p.abrirExemplo();
    for (const t of ['configuracao', 'verificacao', 'prototipos', 'documentacao', 'comparar', 'preferencias']) {
      await p.ir(t);
      await p.w.waitForTimeout(300);
      achados.push(...(await graves(t)));
    }
    expect(achados).toEqual([]);

    // Teclado: Tab chega ao menu, Enter abre a tela, o foco fica visível.
    await p.ir('projetos');
    // Trocar de tela leva o foco ao conteúdo (depois da renderização); só então o teste assume o teclado.
    await p.w.waitForFunction(() => (document.activeElement as HTMLElement | null)?.dataset.testid === 'app-conteudo');
    await p.w.focus('[data-testid="app-menu-verificacao"]');
    await p.w.keyboard.press('Tab');
    await p.w.keyboard.press('Shift+Tab');
    expect(await p.w.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid)).toBe('app-menu-verificacao');
    const contorno = await p.w.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(contorno).not.toBe('none');
    await p.w.keyboard.press('Enter');
    expect(await p.w.getAttribute('[data-testid="app-menu-verificacao"]', 'aria-current')).toBe('page');
  }, LONGO);

  it('CT-E15: atualização com versão maior: aviso, baixa e confere, "Lembrar depois" some por 7 dias', async () => {
    rel = await servirRelease({ versao: '99.0.0' });
    p = await abrirPrograma({ env: { PRUMO_ATUALIZACAO: '', PRUMO_ATUALIZACAO_URL: rel.url, PRUMO_FORMATO: 'nsis' } });
    await p.w.waitForSelector('[data-testid="atualizacao-aviso"]', { timeout: 15_000 });
    expect(await p.w.locator('[data-testid="atualizacao-aviso"]').textContent()).toContain('99.0.0');
    const perguntas: string[] = [];
    p.w.on('dialog', (d) => {
      perguntas.push(d.message());
      void d.dismiss(); // nunca instala no teste
    });
    await p.w.click('[data-testid="atualizacao-baixar"]');
    await expect.poll(() => perguntas, { timeout: 30_000 }).toEqual([expect.stringContaining('Instalar agora?')]);
    const baixado = path.join(p.userData, 'atualizacoes', 'Prumo-Setup-99.0.0.exe');
    expect(readFileSync(baixado).equals(rel.conteudo)).toBe(true);
    await p.w.click('[data-testid="atualizacao-depois"]');
    await p.w.waitForSelector('[data-testid="atualizacao-aviso"]', { state: 'detached' });
    const prefs = JSON.parse(readFileSync(path.join(p.userData, 'preferencias.json'), 'utf8'));
    const dias = (Date.parse(prefs.atualizacao.lembrarDepoisAte) - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(6.9);
    expect(dias).toBeLessThanOrEqual(7);
  }, LONGO);

  it('CT-E16: atualização desligada não faz nenhuma requisição', async () => {
    rel = await servirRelease({ versao: '99.0.0' });
    p = await abrirPrograma({ env: { PRUMO_ATUALIZACAO_URL: rel.url } });
    await p.abrirExemplo();
    await p.ir('preferencias');
    await p.w.waitForTimeout(1500);
    expect(rel.pedidos).toEqual([]);
    expect(p.pedidos.filter((u) => !LOCAL.test(u))).toEqual([]);
  }, LONGO);
});
