import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { criarProjeto, type ProjetoTemp } from './projeto.js';
import { fabricaFeature } from './feature.js';

export interface RepositorioTemp extends ProjetoTemp {
  raizGit: string;
  git(...args: string[]): string;
}

/**
 * Repositório Git com o exemplo em dois commits:
 * 1º = exemplo original; 2º = 1 funcionalidade nova, 1 alterada (cenário mudado e cenário removido),
 * 1 removida (API) e 1 renomeada (Gestão → arquivo com outro nome, mesmo conteúdo).
 */
export async function criarRepositorio(): Promise<RepositorioTemp> {
  const p = await criarProjeto();
  const raizGit = path.resolve(p.dir, '..');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: raizGit, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Teste', GIT_AUTHOR_EMAIL: 'teste@exemplo.com.br', GIT_COMMITTER_NAME: 'Teste', GIT_COMMITTER_EMAIL: 'teste@exemplo.com.br' } });
  git('init', '-q', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  git('add', '-A');
  git('commit', '-q', '-m', 'versão 1');
  git('tag', 'v1');
  await aplicarMudancas(p);
  git('add', '-A');
  git('commit', '-q', '-m', 'versão 2');
  return { ...p, raizGit, git };
}

/** As mudanças da "versão 2" (também usadas na comparação por pasta). */
export async function aplicarMudancas(p: ProjetoTemp) {
  await p.escrever('01_Portal/04_Portal_Ajuda.feature', fabricaFeature({ nome: '04_Portal_Ajuda', tipo: 'Consulta', campos: [{ nome: 'Pergunta', editavel: false }] }));
  await p.substituir('01_Portal/03_Portal_Contato.feature', 'Quando o visitante aciona a opção **Enviar**', 'Quando o visitante aciona a opção **Enviar mensagem**');
  await p.substituir('01_Portal/03_Portal_Contato.feature', /\n {2}@validacao\n {2}Cenário: 02\. E-mails diferentes\n(?: {4}.*\n)+/, '\n');
  await p.remover('05_API');
  const gestao = await p.ler('04_Gestão/01_Gestão_Parceiras.feature');
  await p.remover('04_Gestão/01_Gestão_Parceiras.feature');
  await p.remover('04_Gestão/01_Gestão_Parceiras.png');
  await p.escrever('04_Gestão/02_Gestão_Empresas.feature', gestao.replace('Funcionalidade: 01_Gestão_Parceiras', 'Funcionalidade: 02_Gestão_Empresas').replace('01_Gestão_Parceiras.png', '02_Gestão_Empresas.png'));
}
